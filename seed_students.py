import random
from app import app
from models import db, Student, Subject, Section, Enrollment, User
from sqlalchemy import text

CURRENT_YEAR_LEVEL = "2nd Year"
CURRENT_SEMESTER = "2nd Semester"

PAST_TERMS = [
    ("1st Year", "1st Semester"),
    ("1st Year", "2nd Semester"),
    ("2nd Year", "1st Semester")
]

CURRENT_TERM = [
    ("2nd Year", "2nd Semester")
]

def get_or_create_faculty():
    faculty = User.query.filter_by(role='faculty').first()
    if not faculty:
        faculty = User(
            email='prof@university.edu',
            password='scrypt:fakehash',
            name='Dr. Imaginary Professor',
            role='faculty'
        )
        db.session.add(faculty)
        db.session.commit()
    return faculty

def seed_data():
    with app.app_context():
        print("--- STARTING STUDENT DATA INJECTION ---")
        
        faculty = get_or_create_faculty()

        students_to_create = [
            ("2022-0001", "Main Student User"), 
            ("2022-0002", "Richmond Ajias"),
            ("2022-0003", "Russel Tagud"),
            ("2022-0004", "Carl Alexes Arcillas"),
            ("2022-0005", "Mary Rose Masayon"),
            ("2022-0006", "Jansteff Soliva")
        ]

        student_objects = []
        
        mock_barangays = [
            "Carmen, Cagayan de Oro City", 
            "Lapasan, Cagayan de Oro City", 
            "Bulua, Cagayan de Oro City", 
            "Macasandig, Cagayan de Oro City", 
            "Kauswagan, Cagayan de Oro City"
        ]

        for s_id, s_name in students_to_create:
            # INJECTABLE QUERY: With plural 'students' table
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
                    name=s_name,
                    program="BSCpE",
                    year_level=CURRENT_YEAR_LEVEL,
                    status="Regular",
                    email=f"{s_name.split()[0].lower()}@student.edu",
                    contact_number=random_contact,
                    address=random_address,
                    birthdate=random_birthdate,
                    gender=random_gender
                )
                db.session.add(student)
                print(f"Created Student: {s_name} with mock info")
            else:
                print(f"Student exists: {s_name}")
            student_objects.append(student)
        
        db.session.commit()

        print("\n--- Generating Past Grades (Randomized) ---")
        
        for year, sem in PAST_TERMS:
            subjects = Subject.query.filter_by(year_level=year, semester=sem).all()
            
            if not subjects:
                print(f"Warning: No subjects found for {year}, {sem}. Did you run seed_curriculum.py?")
                continue

            for sub in subjects:
                section_name = f"{sub.code}-SECTION-A"
                section = Section.query.filter_by(name=section_name).first()
                if not section:
                    section = Section(
                        name=section_name,
                        subject_code=sub.code,
                        faculty_id=faculty.id,
                        room="Rm 101",
                        schedule="Completed"
                    )
                    db.session.add(section)
                    db.session.commit()

                for student in student_objects:
                    exists = Enrollment.query.filter_by(student_id=student.id, section_id=section.id).first()
                    
                    if not exists:
                        choices = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.0]
                        p1_grade = random.choice(choices)
                        p2_grade = random.choice(choices)
                        p3_grade = random.choice(choices)
                        average_grade = (p1_grade + p2_grade + p3_grade) / 3.0
                        final_grade = round(average_grade, 2)
                        status = 'Failed' if final_grade > 3.0 else 'Passed'
                        
                        enrollment = Enrollment(
                            student_id=student.id,
                            section_id=section.id,
                            grade=final_grade,
                            p1_grade=p1_grade, 
                            p2_grade=p2_grade, 
                            p3_grade=p3_grade, 
                            status=status
                        )
                        db.session.add(enrollment)
        print("Past grades generated.")

        print("\n--- Generating Current Enrollment (Pending) ---")
        
        for year, sem in CURRENT_TERM:
            subjects = Subject.query.filter_by(year_level=year, semester=sem).all()

            for sub in subjects:
                section_name = f"{sub.code}-SECTION-B" 
                section = Section.query.filter_by(name=section_name).first()
                if not section:
                    section = Section(
                        name=section_name,
                        subject_code=sub.code,
                        faculty_id=faculty.id,
                        room="Rm 202",
                        schedule="TBA"
                    )
                    db.session.add(section)
                    db.session.commit()

                for student in student_objects:
                    exists = Enrollment.query.filter_by(student_id=student.id, section_id=section.id).first()
                    
                    if not exists:
                        enrollment = Enrollment(
                            student_id=student.id,
                            section_id=section.id,
                            grade=None,     
                            status='Pending' 
                        )
                        db.session.add(enrollment)
        
        db.session.commit()
        print("\n--- SUCCESS! Data has been injected. ---")

if __name__ == '__main__':
    seed_data()