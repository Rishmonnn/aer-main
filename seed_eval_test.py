from app import app
from models import db, Student, Subject, Section, Enrollment, User
from datetime import datetime, timedelta
from sqlalchemy import text
import random

def get_or_create_faculty():
    faculty = User.query.filter_by(role='faculty').first()
    if not faculty:
        faculty = User(email='prof_eval@university.edu', password='scrypt:fakehash', name='Engr. Evaluation', role='faculty')
        db.session.add(faculty)
        db.session.commit()
    return faculty

def generate_smart_email(full_name):
    parts = full_name.split()
    if len(parts) >= 2:
        fn, ln = parts[0], parts[-1]
    else:
        fn, ln = parts[0], "unknown"
        
    fn_clean, ln_clean = fn.lower().replace(' ', ''), ln.lower().replace(' ', '')
    return f"{fn_clean[:2]}.{ln_clean}.coc@phinmaed.com"

def seed_eval_scenarios():
    with app.app_context():
        print("--- Injecting End of Semester Evaluation Data ---")
        
        now = datetime.now()
        start_yr, end_yr = (str(now.year - 1)[-2:], str(now.year)[-2:]) if now.month < 6 else (str(now.year)[-2:], str(now.year + 1)[-2:])
        sy_prefix = f"02-{start_yr}{end_yr}-"
        
        faculty = get_or_create_faculty()

        # Define the progression so we can assign past subjects
        sems = [
            ("1st Year", "1st Semester"), ("1st Year", "2nd Semester"),
            ("2nd Year", "1st Semester"), ("2nd Year", "2nd Semester"),
            ("3rd Year", "1st Semester"), ("3rd Year", "2nd Semester"),
            ("4th Year", "1st Semester"), ("4th Year", "2nd Semester")
        ]

        scenarios = [
            {
                "name": "Ronald Ready",
                "year_level": "2nd Year",
                "current_sem": ("2nd Year", "1st Semester"),
                "grade_outcome": "Pass" # Will go to READY TO PROMOTE tab
            },
            {
                "name": "Rachel Ready",
                "year_level": "3rd Year",
                "current_sem": ("3rd Year", "2nd Semester"),
                "grade_outcome": "Pass" # Will go to READY TO PROMOTE tab
            },
            {
                "name": "Walter Waiting",
                "year_level": "1st Year",
                "current_sem": ("1st Year", "2nd Semester"),
                "grade_outcome": "None" # Will go to WAITING FOR GRADES tab
            },
            {
                "name": "Ricky Review",
                "year_level": "2nd Year",
                "current_sem": ("2nd Year", "2nd Semester"),
                "grade_outcome": "Fail" # Will go to NEEDS EVALUATION tab
            }
        ]

        mock_barangays = ["Carmen, Cagayan de Oro City", "Lapasan, Cagayan de Oro City", "Bulua, Cagayan de Oro City", "Macasandig, Cagayan de Oro City"]

        for idx, s_data in enumerate(scenarios, start=800): # Starts at ID 00800
            s_id = f"{sy_prefix}{idx:05d}"
            smart_email = generate_smart_email(s_data['name'])
            
            raw_query = f"SELECT * FROM students WHERE id = '{s_id}'"
            student = db.session.query(Student).from_statement(text(raw_query)).first()
            
            if not student:
                student = Student(
                    id=s_id,
                    name=s_data["name"],
                    program="BSCpE",
                    year_level=s_data["year_level"],
                    status="Enrolled", # VERY IMPORTANT: Must be Enrolled for the Wizard to scan them
                    email=smart_email,
                    contact_number=f"09{random.randint(100000000, 999999999)}",
                    address=random.choice(mock_barangays),
                    birthdate=f"{random.randint(2002, 2005)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                    gender=random.choice(["Male", "Female"])
                )
                db.session.add(student)
                db.session.commit()
            else:
                student.status = "Enrolled"
                db.session.commit()

            # 1. INJECT PAST HISTORY (So the student profile looks full)
            current_idx = sems.index(s_data["current_sem"])
            if current_idx > 0:
                past_sem = sems[current_idx - 1]
                past_subjects = Subject.query.filter_by(year_level=past_sem[0], semester=past_sem[1]).limit(3).all()
                for sub in past_subjects:
                    sec_name = f"{sub.code}-PAST"
                    section = Section.query.filter_by(name=sec_name).first()
                    if not section:
                        section = Section(name=sec_name, subject_code=sub.code, faculty_id=None, schedule="Completed", room="Archived Rm")
                        db.session.add(section)
                        db.session.commit()
                    
                    if not Enrollment.query.filter_by(student_id=s_id, section_id=section.id).first():
                        enrollment = Enrollment(
                            student_id=s_id, section_id=section.id,
                            grade=1.75, p1_grade=1.75, p2_grade=1.75, p3_grade=1.75,
                            status="Passed", date_enrolled=datetime.utcnow() - timedelta(days=150)
                        )
                        db.session.add(enrollment)

            # 2. INJECT CURRENT SEMESTER GRADES
            current_sem = s_data["current_sem"]
            current_subjects = Subject.query.filter_by(year_level=current_sem[0], semester=current_sem[1]).limit(3).all()
            
            for sub in current_subjects:
                sec_name = f"{sub.code}-CURR"
                section = Section.query.filter_by(name=sec_name).first()
                if not section:
                    section = Section(name=sec_name, subject_code=sub.code, faculty_id=faculty.id, schedule="TTh 8:00-9:30AM", room="Lab 1")
                    db.session.add(section)
                    db.session.commit()
                
                if not Enrollment.query.filter_by(student_id=s_id, section_id=section.id).first():
                    # Determine what grade to give them based on the scenario
                    if s_data["grade_outcome"] == "Pass":
                        grade, status = 1.5, "Passed"
                    elif s_data["grade_outcome"] == "Fail":
                        grade, status = 5.0, "Failed"
                    else: # None / Waiting
                        grade, status = None, "Enrolled"
                        
                    enrollment = Enrollment(
                        student_id=s_id, section_id=section.id,
                        grade=grade, p1_grade=grade, p2_grade=grade, p3_grade=grade,
                        status=status, date_enrolled=datetime.utcnow() - timedelta(days=10)
                    )
                    db.session.add(enrollment)

            db.session.commit()
            print(f"-> Created {s_data['name']} ({s_id}) | Expected Tab: [{s_data['grade_outcome'].upper()}]")

        print("\n✅ Success! Run your Flask app, go to Student Journey, and click 'End of Semester Evaluation'.")

if __name__ == '__main__':
    seed_eval_scenarios()