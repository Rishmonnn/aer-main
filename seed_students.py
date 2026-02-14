import random
from app import app
from models import db, Student, Subject, Section, Enrollment, User

# CONFIGURATION
CURRENT_YEAR_LEVEL = "2nd Year"
CURRENT_SEMESTER = "2nd Semester"

# The terms that verify as "Past History" (Grades will be generated)
PAST_TERMS = [
    ("1st Year", "1st Semester"),
    ("1st Year", "2nd Semester"),
    ("2nd Year", "1st Semester")
]

# The term that verifies as "Current Enrollment" (No grades, Status: Pending)
CURRENT_TERM = [
    ("2nd Year", "2nd Semester")
]

def get_or_create_faculty():
    """Ensures there is at least one faculty member to teach the classes."""
    faculty = User.query.filter_by(role='faculty').first()
    if not faculty:
        faculty = User(
            email='prof@university.edu',
            password='scrypt:fakehash', # Placeholder
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

        # ---------------------------------------------------------
        # 1. DEFINE STUDENTS
        # ---------------------------------------------------------
        # Format: (ID, Name)
        students_to_create = [
            ("2022-0001", "Main Student User"),  # Your main profile
            ("2022-0002", "Richmond Ajias"),
            ("2022-0003", "Russel Tagud"),
            ("2022-0004", "Carl Alexes Arcillas"),
            ("2022-0005", "Mary Rose Masayon"),
            ("2022-0006", "Jansteff Soliva")
        ]

        student_objects = []

        for s_id, s_name in students_to_create:
            # Check if student exists, if not, create them
            student = db.session.get(Student, s_id)
            if not student:
                student = Student(
                    id=s_id,
                    name=s_name,
                    program="BSCpE",
                    year_level=CURRENT_YEAR_LEVEL,
                    status="Regular",
                    email=f"{s_name.split()[0].lower()}@student.edu"
                )
                db.session.add(student)
                print(f"Created Student: {s_name}")
            else:
                print(f"Student exists: {s_name}")
            student_objects.append(student)
        
        db.session.commit()

        # ---------------------------------------------------------
        # 2. GENERATE ACADEMIC HISTORY (Past Grades)
        # ---------------------------------------------------------
        print("\n--- Generating Past Grades (Randomized) ---")
        
        for year, sem in PAST_TERMS:
            # Get all subjects for this specific Year/Sem from the database
            subjects = Subject.query.filter_by(year_level=year, semester=sem).all()
            
            if not subjects:
                print(f"Warning: No subjects found for {year}, {sem}. Did you run seed_curriculum.py?")
                continue

            for sub in subjects:
                # 2a. Ensure a Section exists for this past class
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

                # 2b. Give every student a grade for this subject
                for student in student_objects:
                    # Check if already has a grade (don't duplicate)
                    exists = Enrollment.query.filter_by(student_id=student.id, section_id=section.id).first()
                    
                    if not exists:
                        # Random Grade: 1.0 to 3.0
                        # 1.0, 1.25, 1.5, ... 3.0
                        choices = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0]
                        # Bias towards better grades for "Main Student" if you want?
                        # For now, totally random passing grades.
                        grade = random.choice(choices)
                        
                        enrollment = Enrollment(
                            student_id=student.id,
                            section_id=section.id,
                            grade=grade,
                            status='Passed'
                        )
                        db.session.add(enrollment)
        
        db.session.commit()
        print("Past grades generated.")

        # ---------------------------------------------------------
        # 3. GENERATE CURRENT ENROLLMENT (Pending / No Grade)
        # ---------------------------------------------------------
        print("\n--- Generating Current Enrollment (Pending) ---")
        
        for year, sem in CURRENT_TERM:
            subjects = Subject.query.filter_by(year_level=year, semester=sem).all()

            for sub in subjects:
                # 3a. Create the Current Section
                section_name = f"{sub.code}-SECTION-B" # 'B' for current
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

                # 3b. Enroll students as "Pending"
                for student in student_objects:
                    exists = Enrollment.query.filter_by(student_id=student.id, section_id=section.id).first()
                    
                    if not exists:
                        enrollment = Enrollment(
                            student_id=student.id,
                            section_id=section.id,
                            grade=None,     # No grade yet
                            status='Pending' # Shows up as enrolled/pending
                        )
                        db.session.add(enrollment)
        
        db.session.commit()
        print("\n--- SUCCESS! Data has been injected. ---")

if __name__ == '__main__':
    seed_data()