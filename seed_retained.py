from app import app
from models import db, Student, Subject, Section, Enrollment, User
from datetime import datetime, timedelta

def seed_retained_student():
    with app.app_context():
        print("--- Creating Retained Student ---")
        
        # 1. Create the Student
        s_id = "2023-9999"
        student = db.session.get(Student, s_id)
        if not student:
            student = Student(
                id=s_id,
                name="Johnny Retained",
                program="BSCpE",
                year_level="1st Year", # Still 1st Year because he failed
                status="Pending",      # Waiting for enrollment advice
                email="johnny@fail.com"
            )
            db.session.add(student)
        
        # 2. Get Faculty
        faculty = User.query.filter_by(role='faculty').first()

        # 3. Assign Grades (1st Year, 1st Sem)
        # We will FAIL him in Calculus 1 (MAT 171)
        subjects = Subject.query.filter_by(year_level="1st Year", semester="1st Semester").all()
        
        for sub in subjects:
            # Create/Find Section
            sec_name = f"{sub.code}-HIST-1A"
            section = Section.query.filter_by(name=sec_name).first()
            if not section:
                section = Section(name=sec_name, subject_code=sub.code, faculty_id=faculty.id, schedule="Done")
                db.session.add(section)
                db.session.commit()
            
            # Check enrollment
            exists = Enrollment.query.filter_by(student_id=s_id, section_id=section.id).first()
            if not exists:
                # LOGIC: Fail MAT 171, Pass others
                if sub.code == "MAT 171": 
                    grade = 5.00
                    status = "Failed"
                    print(f" -> Failing {sub.code}...")
                else:
                    grade = 1.75
                    status = "Passed"
                
                enrollment = Enrollment(
                    student_id=s_id,
                    section_id=section.id,
                    grade=grade,
                    status=status,
                    date_enrolled=datetime.utcnow() - timedelta(days=200)
                )
                db.session.add(enrollment)

        db.session.commit()
        print(f"Success! Created {student.name} with a failing grade in MAT 171.")

if __name__ == '__main__':
    seed_retained_student()