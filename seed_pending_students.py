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
    {"id": "2022-1001", "name": "Alice Johnson", "program": "BSCpE"},
    {"id": "2022-1002", "name": "Bob Williams", "program": "BSCpE"},
    {"id": "2022-1003", "name": "Charlie Brown", "program": "BSCpE"},
    {"id": "2022-1004", "name": "Diana Prince", "program": "BSCpE"},
    {"id": "2022-1005", "name": "Evan Wright", "program": "BSCpE"},
]

def get_faculty():
    faculty = User.query.filter_by(role='faculty').first()
    if not faculty:
        faculty = User(email='prof@test.com', password='x', name='Prof. History', role='faculty')
        db.session.add(faculty)
        db.session.commit()
    return faculty

def seed_history():
    with app.app_context():
        print("--- Generating Detailed Student History ---")
        faculty = get_faculty()

        mock_barangays = [
            "Carmen, Cagayan de Oro City", 
            "Lapasan, Cagayan de Oro City", 
            "Bulua, Cagayan de Oro City", 
            "Macasandig, Cagayan de Oro City", 
            "Kauswagan, Cagayan de Oro City"
        ]

        for data in PENDING_STUDENTS:
            # INJECTABLE QUERY: With plural 'students' table
            raw_query = f"SELECT * FROM students WHERE id = '{data['id']}'"
            student = db.session.query(Student).from_statement(text(raw_query)).first()
            
            if not student:
                random_contact = f"09{random.randint(100000000, 999999999)}"
                random_address = random.choice(mock_barangays)
                random_gender = random.choice(["Male", "Female"])
                
                year = random.randint(2002, 2004)
                month = random.randint(1, 12)
                day = random.randint(1, 28)
                random_birthdate = f"{year}-{month:02d}-{day:02d}"

                student = Student(
                    id=data['id'],
                    name=data['name'],
                    program=data['program'],
                    year_level="3rd Year",
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
                student.year_level = "3rd Year"
                print(f"Updating Student: {data['name']}")

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
                            faculty_id=faculty.id,
                            room="History Rm",
                            schedule="Completed"
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

        print("--- Success! Students are ready for 3rd Year, 2nd Semester Enrollment. ---")

if __name__ == '__main__':
    seed_history()