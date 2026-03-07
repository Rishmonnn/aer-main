from app import app
from models import db, Student, Subject, Section, Enrollment, User
from datetime import datetime, timedelta
from sqlalchemy import text
import random

def get_or_create_faculty():
    faculty = User.query.filter_by(role='faculty').first()
    if not faculty:
        faculty = User(
            email='prof_retained@university.edu',
            password='scrypt:fakehash',
            name='Dr. Retained Professor',
            role='faculty'
        )
        db.session.add(faculty)
        db.session.commit()
    return faculty

def seed_test_scenarios():
    with app.app_context():
        print("--- Injecting Advanced Testing Scenarios with History Data ---")
        faculty = get_or_create_faculty()

        # Define our Test Students and their exact conditions
        scenarios = [
            {
                "id": "2023-T001",
                "name": "Mina Minor",
                "email": "mina@test.com",
                "year_level": "1st Year", # Just finished 1st Year
                "semesters_to_take": [("1st Year", "1st Semester"), ("1st Year", "2nd Semester")],
                "subjects_to_fail": ["NST 021", "ART 002"], # Minors only
                "expected_outcome": "Promoted (Retake Minors)"
            },
            {
                "id": "2023-T002",
                "name": "Bobby Bottleneck",
                "email": "bobby@test.com",
                "year_level": "2nd Year", # Just finished 2nd Year
                "semesters_to_take": [("2nd Year", "1st Semester"), ("2nd Year", "2nd Semester")],
                "subjects_to_fail": ["CPE 039"], # 1 Major (Fundamentals of Electronic Circuits - heavy prereq!)
                "expected_outcome": "Promoted (Conditional)"
            },
            {
                "id": "2023-T003",
                "name": "Paul Probation",
                "email": "paul@test.com",
                "year_level": "1st Year", # Just finished 1st Year, 1st Sem
                "semesters_to_take": [("1st Year", "1st Semester")],
                "subjects_to_fail": ["MAT 171", "CPE 035", "GEN 003"], # Fails > 50% of the units!
                "expected_outcome": "Retained (Academic Probation)"
            },
            {
                "id": "2023-T004",
                "name": "Sammy Single",
                "email": "sammy@test.com",
                "year_level": "1st Year", 
                "semesters_to_take": [("1st Year", "1st Semester")],
                "subjects_to_fail": ["HIS 007"], # Fails just 1 Minor
                "expected_outcome": "Promoted (Retake Minors)"
            }
        ]

        mock_barangays = [
            "Carmen, Cagayan de Oro City", 
            "Lapasan, Cagayan de Oro City", 
            "Bulua, Cagayan de Oro City", 
            "Macasandig, Cagayan de Oro City", 
            "Kauswagan, Cagayan de Oro City"
        ]

        for s_data in scenarios:
            s_id = s_data["id"]
            
            # 1. Create Student
            raw_query = f"SELECT * FROM students WHERE id = '{s_id}'"
            student = db.session.query(Student).from_statement(text(raw_query)).first()
            
            if not student:
                random_contact = f"09{random.randint(100000000, 999999999)}"
                random_address = random.choice(mock_barangays)
                random_gender = random.choice(["Male", "Female"])
                
                year = random.randint(2003, 2005)
                month = random.randint(1, 12)
                day = random.randint(1, 28)
                random_birthdate = f"{year}-{month:02d}-{day:02d}"

                student = Student(
                    id=s_id,
                    name=s_data["name"],
                    program="BSCpE",
                    year_level=s_data["year_level"],
                    status="Pending", # Set to pending so they appear on the Enrollment Dashboard
                    email=s_data["email"],
                    contact_number=random_contact,
                    address=random_address,
                    birthdate=random_birthdate,
                    gender=random_gender
                )
                db.session.add(student)
                db.session.commit()
            else:
                student.status = "Pending"
                db.session.commit()

            # 2. Enroll them in their past subjects and apply grades
            for year, sem in s_data["semesters_to_take"]:
                subjects = Subject.query.filter_by(year_level=year, semester=sem).all()
                
                for sub in subjects:
                    # Create a mock section for the past
                    sec_name = f"{sub.code}-TEST-{year[0]}{sem[0]}"
                    section = Section.query.filter_by(name=sec_name).first()
                    
                    if not section:
                        section = Section(
                            name=sec_name, 
                            subject_code=sub.code, 
                            faculty_id=faculty.id, 
                            schedule="Done",
                            room="Rm 101"
                        )
                        db.session.add(section)
                        db.session.commit()
                    
                    # Enroll student
                    exists = Enrollment.query.filter_by(student_id=s_id, section_id=section.id).first()
                    if not exists:
                        # Check if this subject is in their "Fail" list
                        if sub.code in s_data["subjects_to_fail"]:
                            p1_grade = 5.0
                            p2_grade = 5.0
                            p3_grade = 5.0
                            final_grade = 5.0
                            status = "Failed"
                        else:
                            # Generate random passing grades
                            choices = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0]
                            p1_grade = random.choice(choices)
                            p2_grade = random.choice(choices)
                            p3_grade = random.choice(choices)
                            average_grade = (p1_grade + p2_grade + p3_grade) / 3.0
                            final_grade = round(average_grade, 2)
                            status = "Passed"
                        
                        enrollment = Enrollment(
                            student_id=s_id,
                            section_id=section.id,
                            grade=final_grade,
                            p1_grade=p1_grade,
                            p2_grade=p2_grade,
                            p3_grade=p3_grade,
                            status=status,
                            date_enrolled=datetime.utcnow() - timedelta(days=90)
                        )
                        db.session.add(enrollment)

            db.session.commit()
            print(f"-> Created {s_data['name']} (Expected: {s_data['expected_outcome']})")

        print("\nSuccess! Run your flask app and check the 'Pending Enrollments' table.")

if __name__ == '__main__':
    seed_test_scenarios()