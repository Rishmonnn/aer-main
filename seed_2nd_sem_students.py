from app import app
from models import db, Student, Subject, Section, Enrollment, User
from datetime import datetime, timedelta
import random

# CONFIGURATION
# We want these students to be finished with 2nd Year 1st Sem, waiting for 2nd Year 2nd Sem.
PAST_TERMS = [
    ("1st Year", "1st Semester", -550), # 1.5 years ago
    ("1st Year", "2nd Semester", -365), # 1 year ago
    ("2nd Year", "1st Semester", -180)  # 6 months ago
]

PENDING_STUDENTS = [
    {"id": "2023-2001", "name": "Fiona Gallagher", "program": "BSCpE"},
    {"id": "2023-2002", "name": "George Miller", "program": "BSCpE"},
    {"id": "2023-2003", "name": "Hannah Abbott", "program": "BSCpE"},
    {"id": "2023-2004", "name": "Ian Malcolm", "program": "BSCpE"},
    {"id": "2023-2005", "name": "Julia Roberts", "program": "BSCpE"},
]

def get_faculty():
    """Gets a faculty member to assign to past sections."""
    faculty = User.query.filter_by(role='faculty').first()
    if not faculty:
        faculty = User(email='prof@test.com', password='x', name='Prof. History', role='faculty')
        db.session.add(faculty)
        db.session.commit()
    return faculty

def seed_history():
    with app.app_context():
        print("--- Generating Detailed Student History (Enrolling for 2nd Year, 2nd Sem) ---")
        faculty = get_faculty()

        mock_barangays = [
            "Carmen, Cagayan de Oro City", 
            "Lapasan, Cagayan de Oro City", 
            "Bulua, Cagayan de Oro City", 
            "Macasandig, Cagayan de Oro City", 
            "Kauswagan, Cagayan de Oro City"
        ]

        for data in PENDING_STUDENTS:
            # 1. Create/Get Student
            student = db.session.get(Student, data['id'])
            if not student:
                random_contact = f"09{random.randint(100000000, 999999999)}"
                random_address = random.choice(mock_barangays)
                random_gender = random.choice(["Male", "Female"])
                
                year = random.randint(2003, 2005)
                month = random.randint(1, 12)
                day = random.randint(1, 28) 
                random_birthdate = f"{year}-{month:02d}-{day:02d}"

                student = Student(
                    id=data['id'],
                    name=data['name'],
                    program=data['program'],
                    year_level="2nd Year",
                    status="Pending",     
                    email=f"{data['name'].split()[0].lower()}@student.edu",
                    contact_number=random_contact,
                    address=random_address,
                    birthdate=random_birthdate,
                    gender=random_gender
                )
                db.session.add(student)
                print(f"Created Student: {data['name']}")
            else:
                student.status = "Pending" 
                student.year_level = "2nd Year"
                print(f"Updating Student: {data['name']}")

            # 2. Generate Grades for Past Terms
            for year, sem, days_ago in PAST_TERMS:
                subjects = Subject.query.filter_by(year_level=year, semester=sem).all()
                past_date = datetime.utcnow() + timedelta(days=days_ago)

                for sub in subjects:
                    sec_name = f"{sub.code}-HIST-{year[0]}{sem[0]}" 
                    section = Section.query.filter_by(name=sec_name).first()
                    if not section:
                        section = Section(
                            name=sec_name,
                            subject_code=sub.code,
                            faculty_id=None,          # <--- FIX: Unassign from active faculty
                            room="History Rm",
                            schedule="Completed"      # <--- FIX: Mark as completed
                        )
                        db.session.add(section)
                        db.session.commit()

                    enrollment = Enrollment.query.filter_by(student_id=student.id, section_id=section.id).first()
                    
                    if not enrollment:
                        choices = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0]
                        
                        p1_grade = random.choice(choices)
                        p2_grade = random.choice(choices)
                        p3_grade = random.choice(choices)
                        
                        average_grade = (p1_grade + p2_grade + p3_grade) / 3.0
                        final_grade = round(average_grade, 2)

                        enrollment = Enrollment(
                            student_id=student.id,
                            section_id=section.id,
                            grade=final_grade,
                            p1_grade=p1_grade, 
                            p2_grade=p2_grade, 
                            p3_grade=p3_grade, 
                            status='Passed',
                            date_enrolled=past_date
                        )
                        db.session.add(enrollment)
            
            db.session.commit()
            print(f" -> History generated for {data['name']}")

        print("--- Success! Students are ready for 2nd Year, 2nd Sem Enrollment. ---")

if __name__ == '__main__':
    seed_history()