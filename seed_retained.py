from app import app
from models import db, Student, Subject, Section, Enrollment, User
from datetime import datetime, timedelta
from sqlalchemy import text
import random

def get_or_create_faculty():
    faculty = User.query.filter_by(role='faculty').first()
    if not faculty:
        faculty = User(email='prof_retained@university.edu', password='scrypt:fakehash', name='Dr. Retained Professor', role='faculty')
        db.session.add(faculty)
        db.session.commit()
    return faculty

def generate_smart_email(full_name):
    parts = full_name.split()
    if len(parts) >= 3:
        fn, mn, ln = parts[0], parts[1], "".join(parts[2:])
    elif len(parts) == 2:
        fn, mn, ln = parts[0], "", parts[1]
    else:
        fn, mn, ln = parts[0], "", "unknown"
        
    fn_clean, mn_clean, ln_clean = fn.lower().replace(' ', ''), mn.lower().replace(' ', ''), ln.lower().replace(' ', '')
    fn_prefix, mn_prefix = fn_clean[:2] if fn_clean else "", mn_clean[:2] if mn_clean else ""
    return f"{fn_prefix}{mn_prefix}.{ln_clean}.coc@phinmaed.com"

def seed_test_scenarios():
    with app.app_context():
        print("--- Injecting Advanced Testing Scenarios with History Data ---")
        
        now = datetime.now()
        start_yr, end_yr = (str(now.year - 1)[-2:], str(now.year)[-2:]) if now.month < 6 else (str(now.year)[-2:], str(now.year + 1)[-2:])
        sy_prefix = f"02-{start_yr}{end_yr}-"
        
        faculty = get_or_create_faculty()

        scenarios = [
            {
                "name": "Mina Minor",
                "year_level": "1st Year",
                "semesters_to_take": [("1st Year", "1st Semester"), ("1st Year", "2nd Semester")],
                "subjects_to_fail": ["NST 021", "ART 002"], 
                "expected_outcome": "Promoted (Retake Minors)"
            },
            {
                "name": "Bobby Bottleneck",
                "year_level": "2nd Year",
                "semesters_to_take": [("2nd Year", "1st Semester"), ("2nd Year", "2nd Semester")],
                "subjects_to_fail": ["CPE 039"], 
                "expected_outcome": "Promoted (Conditional)"
            },
            {
                "name": "Paul Probation",
                "year_level": "1st Year",
                "semesters_to_take": [("1st Year", "1st Semester")],
                "subjects_to_fail": ["MAT 171", "CPE 035", "GEN 003"], 
                "expected_outcome": "Retained (Academic Probation)"
            },
            {
                "name": "Sammy Single",
                "year_level": "1st Year", 
                "semesters_to_take": [("1st Year", "1st Semester")],
                "subjects_to_fail": ["HIS 007"],
                "expected_outcome": "Promoted (Retake Minors)"
            }
        ]

        mock_barangays = ["Carmen, Cagayan de Oro City", "Lapasan, Cagayan de Oro City", "Bulua, Cagayan de Oro City"]

        for idx, s_data in enumerate(scenarios, start=200): # Starts at 00200
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
                    status="Pending",
                    email=smart_email,
                    contact_number=f"09{random.randint(100000000, 999999999)}",
                    address=random.choice(mock_barangays),
                    birthdate=f"{random.randint(2003, 2005)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                    gender=random.choice(["Male", "Female"])
                )
                db.session.add(student)
                db.session.commit()
            else:
                student.status = "Pending"
                db.session.commit()

            for year, sem in s_data["semesters_to_take"]:
                subjects = Subject.query.filter_by(year_level=year, semester=sem).all()
                for sub in subjects:
                    sec_name = f"{sub.code}-TEST-{year[0]}{sem[0]}"
                    section = Section.query.filter_by(name=sec_name).first()
                    
                    if not section:
                        section = Section(name=sec_name, subject_code=sub.code, faculty_id=faculty.id, schedule="Done", room="Rm 101")
                        db.session.add(section)
                        db.session.commit()
                    
                    if not Enrollment.query.filter_by(student_id=s_id, section_id=section.id).first():
                        if sub.code in s_data["subjects_to_fail"]:
                            p1_grade, p2_grade, p3_grade, final_grade, status = 5.0, 5.0, 5.0, 5.0, "Failed"
                        else:
                            choices = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0]
                            p1_grade, p2_grade, p3_grade = random.choice(choices), random.choice(choices), random.choice(choices)
                            final_grade, status = round(((p1_grade + p2_grade + p3_grade) / 3.0), 2), "Passed"
                        
                        enrollment = Enrollment(
                            student_id=s_id, section_id=section.id,
                            grade=final_grade, p1_grade=p1_grade, p2_grade=p2_grade, p3_grade=p3_grade,
                            status=status, date_enrolled=datetime.utcnow() - timedelta(days=90)
                        )
                        db.session.add(enrollment)
            db.session.commit()
            print(f"-> Created {s_data['name']} ({s_id}) [{smart_email}] (Expected: {s_data['expected_outcome']})")

        print("\nSuccess! Run your flask app and check the 'Pending Enrollments' table.")

if __name__ == '__main__':
    seed_test_scenarios()