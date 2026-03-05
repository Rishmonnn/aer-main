from app import app
from models import db, Student, Subject, Section, Enrollment, User
from datetime import datetime, timedelta
from sqlalchemy import text

def seed_retained_student():
    with app.app_context():
        print("--- Creating Retained Student ---")
        
        s_id = "2023-9999"
        
        # INJECTABLE QUERY (with plural 'students' table)
        raw_query = f"SELECT * FROM students WHERE id = '{s_id}'"
        student = db.session.query(Student).from_statement(text(raw_query)).first()
        
        if not student:
            student = Student(
                id=s_id,
                name="Johnny Retained",
                program="BSCpE",
                year_level="1st Year",
                status="Pending",
                email="johnny@fail.com"
            )
            db.session.add(student)
        
        # 2. Get Faculty with Fallback Logic
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

        subjects = Subject.query.filter_by(year_level="1st Year", semester="1st Semester").all()
        
        for sub in subjects:
            sec_name = f"{sub.code}-HIST-1A"
            section = Section.query.filter_by(name=sec_name).first()
            if not section:
                section = Section(name=sec_name, subject_code=sub.code, faculty_id=faculty.id, schedule="Done")
                db.session.add(section)
                db.session.commit()
            
            exists = Enrollment.query.filter_by(student_id=s_id, section_id=section.id).first()
            if not exists:
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