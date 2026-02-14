from app import app
from models import db, Student, Subject, Section, Enrollment, User
from datetime import datetime, timedelta
import random

# CONFIGURATION
# We want these students to be finished with 2nd Year, waiting for 3rd Year.
PAST_TERMS = [
    ("1st Year", "1st Semester", -730), # 2 years ago
    ("1st Year", "2nd Semester", -550), # 1.5 years ago
    ("2nd Year", "1st Semester", -365), # 1 year ago
    ("2nd Year", "2nd Semester", -180)  # 6 months ago
]

PENDING_STUDENTS = [
    {"id": "2022-1001", "name": "Alice Johnson", "program": "BSCpE"},
    {"id": "2022-1002", "name": "Bob Williams", "program": "BSCpE"},
    {"id": "2022-1003", "name": "Charlie Brown", "program": "BSCpE"},
    {"id": "2022-1004", "name": "Diana Prince", "program": "BSCpE"},
    {"id": "2022-1005", "name": "Evan Wright", "program": "BSCpE"},
]

def get_faculty():
    """Gets a faculty member to assign to past sections."""
    faculty = User.query.filter_by(role='faculty').first()
    if not faculty:
        # Fallback if no faculty exists
        faculty = User(email='prof@test.com', password='x', name='Prof. History', role='faculty')
        db.session.add(faculty)
        db.session.commit()
    return faculty

def seed_history():
    with app.app_context():
        print("--- Generating Detailed Student History ---")
        faculty = get_faculty()

        for data in PENDING_STUDENTS:
            # 1. Create/Get Student
            student = db.session.get(Student, data['id'])
            if not student:
                student = Student(
                    id=data['id'],
                    name=data['name'],
                    program=data['program'],
                    year_level="2nd Year", # They just finished this
                    status="Pending",      # Pending enrollment for 3rd Year
                    email=f"{data['name'].split()[0].lower()}@student.edu"
                )
                db.session.add(student)
                print(f"Created Student: {data['name']}")
            else:
                # Reset status for testing
                student.status = "Pending" 
                student.year_level = "2nd Year"
                print(f"Updating Student: {data['name']}")

            # 2. Generate Grades for Past Terms
            for year, sem, days_ago in PAST_TERMS:
                # Get subjects for this term
                subjects = Subject.query.filter_by(year_level=year, semester=sem).all()
                
                # Calculate a fake past date
                past_date = datetime.utcnow() + timedelta(days=days_ago)

                for sub in subjects:
                    # Find or Create Section
                    sec_name = f"{sub.code}-HIST-{year[0]}{sem[0]}" # e.g., CPE101-HIST-11
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

                    # Check if grade exists
                    enrollment = Enrollment.query.filter_by(student_id=student.id, section_id=section.id).first()
                    
                    if not enrollment:
                        # Random Passing Grade (1.0 - 3.0)
                        grade = random.choice([1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0])
                        
                        enrollment = Enrollment(
                            student_id=student.id,
                            section_id=section.id,
                            grade=grade,
                            status='Passed',
                            date_enrolled=past_date
                        )
                        db.session.add(enrollment)
            
            db.session.commit()
            print(f" -> History generated for {data['name']}")

        print("--- Success! Students are ready for Enrollment & Journey. ---")

if __name__ == '__main__':
    seed_history()