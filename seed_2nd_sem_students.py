from app import app
from models import db, Student, Subject, Section, Enrollment
from datetime import datetime, timedelta
import random
from sqlalchemy import text

# They have completed exactly these three semesters
PAST_TERMS = [
    ("1st Year", "1st Semester", -550), # Approx 1.5 years ago
    ("1st Year", "2nd Semester", -365), # Approx 1 year ago
    ("2nd Year", "1st Semester", -180)  # Approx 6 months ago
]

PENDING_STUDENTS = [
    {"name": "Ethan Hunt", "program": "BSCpE"},
    {"name": "Natasha Romanoff", "program": "BSCpE"},
    {"name": "Bruce Wayne", "program": "BSCpE"},
    {"name": "Clark Kent", "program": "BSCpE"}
]

def generate_smart_email(full_name):
    """Generates standard university emails based on names."""
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

def seed_2nd_year_pending():
    with app.app_context():
        print("--- Generating 2nd Year Students (Pending for 2nd Sem) ---")
        
        now = datetime.now()
        start_yr, end_yr = (str(now.year - 1)[-2:], str(now.year)[-2:]) if now.month < 6 else (str(now.year)[-2:], str(now.year + 1)[-2:])
        sy_prefix = f"02-{start_yr}{end_yr}-"

        mock_barangays = ["Carmen, Cagayan de Oro City", "Lapasan, Cagayan de Oro City", "Bulua, Cagayan de Oro City"]

        # Starts at 400 to avoid ID clashes with your other seed scripts
        for idx, data in enumerate(PENDING_STUDENTS, start=400): 
            s_id = f"{sy_prefix}{idx:05d}"
            smart_email = generate_smart_email(data['name'])

            # Check if student exists
            raw_query = f"SELECT * FROM students WHERE email = '{smart_email}' OR name = '{data['name']}'"
            student = db.session.query(Student).from_statement(text(raw_query)).first()
            
            if not student:
                student = Student(
                    id=s_id,
                    name=data['name'],
                    program=data['program'],
                    year_level="2nd Year",  # Still technically a 2nd Year
                    status="Pending",       # Waiting to be moved to 'Enlisting'
                    email=smart_email,
                    contact_number=f"09{random.randint(100000000, 999999999)}",
                    address=random.choice(mock_barangays),
                    birthdate=f"{random.randint(2004, 2005)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
                    gender=random.choice(["Male", "Female"])
                )
                db.session.add(student)
                print(f"Created: {data['name']} ({s_id}) -> {smart_email}")
            else:
                student.status, student.year_level = "Pending", "2nd Year"
                print(f"Updating: {data['name']} ({s_id})")

            # Generate their passed history
            for year, sem, days_ago in PAST_TERMS:
                subjects = Subject.query.filter_by(year_level=year, semester=sem).all()
                past_date = datetime.utcnow() + timedelta(days=days_ago)

                for sub in subjects:
                    sec_name = f"{sub.code}-HIST-{year[0]}{sem[0]}"
                    section = Section.query.filter_by(name=sec_name).first()
                    
                    if not section:
                        # HIDDEN from active views: faculty_id=None, schedule="Completed"
                        section = Section(name=sec_name, subject_code=sub.code, faculty_id=None, room="Archived Rm", schedule="Completed")
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

        print("--- Success! Students are ready for 2nd Year, 2nd Semester Enrollment. ---")

if __name__ == '__main__':
    seed_2nd_year_pending()