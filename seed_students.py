import random
from datetime import datetime # NEW
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

def generate_smart_email(full_name):
    parts = full_name.split()
    if len(parts) >= 3:
        fn = parts[0]
        mn = parts[1]
        ln = "".join(parts[2:])
    elif len(parts) == 2:
        fn = parts[0]
        mn = ""
        ln = parts[1]
    else:
        fn = parts[0]
        mn = ""
        ln = "unknown"
        
    fn_clean = fn.lower().replace(' ', '')
    mn_clean = mn.lower().replace(' ', '')
    ln_clean = ln.lower().replace(' ', '')
    
    fn_prefix = fn_clean[:2] if fn_clean else ""
    mn_prefix = mn_clean[:2] if mn_clean else ""
    return f"{fn_prefix}{mn_prefix}.{ln_clean}.coc@phinmaed.com"

def seed_data():
    with app.app_context():
        print("--- STARTING STUDENT DATA INJECTION ---")
        
        # --- NEW: Academic Year Prefix Generator ---
        now = datetime.now()
        if now.month < 6:
            start_yr = str(now.year - 1)[-2:]
            end_yr = str(now.year)[-2:]
        else:
            start_yr = str(now.year)[-2:]
            end_yr = str(now.year + 1)[-2:]
        sy_prefix = f"02-{start_yr}{end_yr}-"
        
        faculty = get_or_create_faculty()

        # Removed the hardcoded IDs from the tuple
        students_to_create = [
            "Main Student User", 
            "Richmond Ajias",
            "Russel Tagud",
            "Carl Alexes Arcillas",
            "Mary Rose Masayon",
            "Jansteff Soliva"
        ]

        student_objects = []
        
        mock_barangays = [
            "Carmen, Cagayan de Oro City", 
            "Lapasan, Cagayan de Oro City", 
            "Bulua, Cagayan de Oro City", 
            "Macasandig, Cagayan de Oro City", 
            "Kauswagan, Cagayan de Oro City"
        ]

        for idx, s_name in enumerate(students_to_create, start=1):
            s_id = f"{sy_prefix}{idx:05d}"
            smart_email = generate_smart_email(s_name)
            
            # THE FIX: Check by Email or Name instead of ID
            student = Student.query.filter(
                (Student.email == smart_email) | (Student.name == s_name)
            ).first()
            
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
                    email=smart_email,
                    contact_number=random_contact,
                    address=random_address,
                    birthdate=random_birthdate,
                    gender=random_gender
                )
                db.session.add(student)
                print(f"Created Student: {s_name} ({s_id}) -> {smart_email}")
            else:
                # Update existing record
                student.status = "Regular"
                student.year_level = CURRENT_YEAR_LEVEL
                print(f"Student exists (Updated): {s_name} ({student.id})")
            student_objects.append(student)
        
        db.session.commit()

        print("\n--- Generating Past Grades (Randomized) ---")
        for year, sem in PAST_TERMS:
            subjects = Subject.query.filter_by(year_level=year, semester=sem).all()
            if not subjects: continue

            for sub in subjects:
                section_name = f"{sub.code}-SECTION-A"
                section = Section.query.filter_by(name=section_name).first()
                if not section:
                    # --- FIX: Removed faculty_id, set to Archived ---
                    section = Section(
                        name=section_name, subject_code=sub.code,
                        faculty_id=None, room="Archived Rm", schedule="Completed"
                    )
                    db.session.add(section)
                    db.session.commit()

                for student in student_objects:
                    exists = Enrollment.query.filter_by(student_id=student.id, section_id=section.id).first()
                    if not exists:
                        choices = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.0]
                        p1_grade, p2_grade, p3_grade = random.choice(choices), random.choice(choices), random.choice(choices)
                        final_grade = round((p1_grade + p2_grade + p3_grade) / 3.0, 2)
                        status = 'Failed' if final_grade > 3.0 else 'Passed'
                        
                        enrollment = Enrollment(
                            student_id=student.id, section_id=section.id,
                            grade=final_grade, p1_grade=p1_grade, p2_grade=p2_grade, 
                            p3_grade=p3_grade, status=status
                        )
                        db.session.add(enrollment)

        print("\n--- Generating Current Enrollment (Pending) ---")
        for year, sem in CURRENT_TERM:
            subjects = Subject.query.filter_by(year_level=year, semester=sem).all()
            for sub in subjects:
                section_name = f"{sub.code}-SECTION-B" 
                section = Section.query.filter_by(name=section_name).first()
                if not section:
                    # --- NO FIX HERE: Current term needs active faculty to show up on dashboard ---
                    section = Section(
                        name=section_name, subject_code=sub.code,
                        faculty_id=faculty.id, room="Rm 202", schedule="TBA"
                    )
                    db.session.add(section)
                    db.session.commit()

                for student in student_objects:
                    exists = Enrollment.query.filter_by(student_id=student.id, section_id=section.id).first()
                    if not exists:
                        enrollment = Enrollment(
                            student_id=student.id, section_id=section.id,
                            grade=None, status='Pending' 
                        )
                        db.session.add(enrollment)
        
        db.session.commit()
        print("\n--- SUCCESS! Data has been injected. ---")

if __name__ == '__main__':
    seed_data()