from app import app
from models import db, Student, Subject, Section, Enrollment, User
from datetime import datetime, timedelta
import random
from sqlalchemy import text

PAST_TERMS = [
    ("1st Year", "1st Semester", -910),
    ("1st Year", "2nd Semester", -730),
    ("2nd Year", "1st Semester", -545),
    ("2nd Year", "2nd Semester", -365),
    ("3rd Year", "1st Semester", -180) 
]

PENDING_STUDENTS = [
    {"name": "Alice Grace Johnson", "program": "BSCpE"},
    {"name": "Bob Williams", "program": "BSCpE"},
    {"name": "Charlie Brown", "program": "BSCpE"},
    {"name": "Diana Prince", "program": "BSCpE"},
    {"name": "Evan Wright", "program": "BSCpE"},
]

def get_faculty():
    faculty = User.query.filter_by(role='faculty').first()
    if not faculty:
        faculty = User(email='prof@test.com', password='x', name='Prof. History', role='faculty')
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

def seed_history():
    with app.app_context():
        print("--- Generating Detailed Student History ---")
        faculty = get_faculty()

        now = datetime.now()
        start_yr, end_yr = (str(now.year - 1)[-2:], str(now.year)[-2:]) if now.month < 6 else (str(now.year)[-2:], str(now.year + 1)[-2:])
        sy_prefix = f"02-{start_yr}{end_yr}-"

        mock_barangays = ["Carmen, Cagayan de Oro City", "Lapasan, Cagayan de Oro City", "Bulua, Cagayan de Oro City"]

        for idx, data in enumerate(PENDING_STUDENTS, start=100): # Starts at 00100
            s_id = f"{sy_prefix}{idx:05d}"
            smart_email = generate_smart_email(data['name'])

            raw_query = f"SELECT * FROM students WHERE id = '{s_id}'"
            student = db.session.query(Student).from_statement(text(raw_query)).first()
            
            if not student:
                student = Student(
                    id=s_id,
                    name=data['name'],
                    program=data['program'],
                    year_level="3rd Year",
                    status="Pending",
                    email=smart_email,
                    contact_number=f"09{random.randint(100000000, 999999999)}",
                    address=random.choice(mock_barangays),
                    birthdate=f"{random.randint(2002, 2004)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                    gender=random.choice(["Male", "Female"])
                )
                db.session.add(student)
                print(f"Created: {data['name']} ({s_id}) -> {smart_email}")
            else:
                student.status, student.year_level = "Pending", "3rd Year"
                print(f"Updating: {data['name']} ({s_id})")

            for year, sem, days_ago in PAST_TERMS:
                subjects = Subject.query.filter_by(year_level=year, semester=sem).all()
                past_date = datetime.utcnow() + timedelta(days=days_ago)

                for sub in subjects:
                    sec_name = f"{sub.code}-HIST-{year[0]}{sem[0]}"
                    section = Section.query.filter_by(name=sec_name).first()
                    if not section:
                        section = Section(name=sec_name, subject_code=sub.code, faculty_id=faculty.id, room="History Rm", schedule="Completed")
                        db.session.add(section)
                        db.session.commit()

                    if not Enrollment.query.filter_by(student_id=student.id, section_id=section.id).first():
                        choices = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0]
                        p1_grade, p2_grade, p3_grade = random.choice(choices), random.choice(choices), random.choice(choices)
                        enrollment = Enrollment(
                            student_id=student.id, section_id=section.id,
                            grade=round(((p1_grade + p2_grade + p3_grade) / 3.0), 2),
                            p1_grade=p1_grade, p2_grade=p2_grade, p3_grade=p3_grade, 
                            status='Passed', date_enrolled=past_date
                        )
                        db.session.add(enrollment)
            db.session.commit()

        print("--- Success! Students are ready for 3rd Year, 2nd Semester Enrollment. ---")

if __name__ == '__main__':
    seed_history()