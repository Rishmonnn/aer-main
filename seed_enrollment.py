import random
from app import app
from models import db, Student, Subject, Section, Enrollment, User

def seed_enrollment_data():
    with app.app_context():
        print("--- Starting Enrollment Seeding ---")

        # ==========================================
        # 1. SETUP: Create a Faculty Placeholder
        # ==========================================
        faculty = User.query.filter_by(email='faculty@test.com').first()
        if not faculty:
            faculty = User(
                email='faculty@test.com', 
                password='scrypt:fakehash', 
                name='Faculty Member', 
                role='faculty'
            )
            db.session.add(faculty)
            db.session.commit()
            print("Created placeholder faculty.")
        
        # ==========================================
        # 2. MAIN STUDENT (History of Grades)
        # ==========================================
        main_id = "2022-0001"
        main_student = db.session.get(Student, main_id)
        
        if not main_student:
            main_student = Student(
                id=main_id,
                name="Main User",
                program="BSCpE",
                year_level="2nd Year",
                status="Regular",
                email="main@student.com"
            )
            db.session.add(main_student)
            print(f"Created Main Student: {main_id}")

        # List of past terms to generate grades for
        past_terms = [
            ("1st Year", "1st Semester"), 
            ("1st Year", "2nd Semester"), 
            ("2nd Year", "1st Semester")
        ]

        for year, sem in past_terms:
            # Get subjects for this specific term
            subjects = Subject.query.filter_by(year_level=year, semester=sem).all()
            
            for sub in subjects:
                # Ensure a section exists for this subject
                section_name = f"{sub.code}-A"
                section = Section.query.filter_by(name=section_name).first()
                if not section:
                    section = Section(
                        name=section_name,
                        subject_code=sub.code,
                        faculty_id=None,        # <--- FIX: Unassign from active faculty
                        room="Archived Rm",     # <--- FIX: Mark as archived
                        schedule="Completed"    # <--- FIX: Mark as completed
                    )
                    db.session.add(section)
                    db.session.commit() # Commit to get ID
                
                # Enroll Main Student if not already enrolled
                existing_enrollment = Enrollment.query.filter_by(
                    student_id=main_id, section_id=section.id
                ).first()
                
                if not existing_enrollment:
                    # Random grade between 1.0 and 3.0 (increments of 0.25 for realism)
                    random_grade = random.choice([1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0])
                    
                    enrollment = Enrollment(
                        student_id=main_id,
                        section_id=section.id,
                        grade=random_grade,
                        status="Passed"
                    )
                    db.session.add(enrollment)
        
        print(f"Generated past grades for {main_id}.")

        # ==========================================
        # 3. IMAGINARY STUDENTS (Pending Status)
        # ==========================================
        # Target Term: 2nd Year, 2nd Semester
        target_year = "2nd Year"
        target_sem = "2nd Semester"
        
        pending_names = [
            "Richmond Ajias",
            "Sarah Connor",
            "John Doe",
            "Jane Smith",
            "Michael Jordan"
        ]
        
        current_subjects = Subject.query.filter_by(year_level=target_year, semester=target_sem).all()
        
        # Create sections for current subjects first
        current_sections = []
        for sub in current_subjects:
            sec_name = f"{sub.code}-B" # Section B for current students
            section = Section.query.filter_by(name=sec_name).first()
            if not section:
                section = Section(
                    name=sec_name,
                    subject_code=sub.code,
                    faculty_id=faculty.id, # <--- KEEP active faculty for current classes
                    room="Rm 202",
                    schedule="MW 10:00-12:00"
                )
                db.session.add(section)
                db.session.commit()
            current_sections.append(section)

        # Create Students and Enroll them as Pending
        start_id = 20240001
        for i, name in enumerate(pending_names):
            s_id = f"{start_id + i}" 
            
            student = db.session.get(Student, s_id)
            if not student:
                student = Student(
                    id=s_id,
                    name=name,
                    program="BSCpE",
                    year_level="2nd Year",
                    status="Regular", 
                    email=f"{name.replace(' ', '.').lower()}@student.com"
                )
                db.session.add(student)
                print(f"Created Student: {name}")
            
            # Enroll in all current subjects as Pending
            for sec in current_sections:
                exists = Enrollment.query.filter_by(student_id=s_id, section_id=sec.id).first()
                if not exists:
                    enrollment = Enrollment(
                        student_id=s_id,
                        section_id=sec.id,
                        grade=None, 
                        status="Pending" 
                    )
                    db.session.add(enrollment)

        db.session.commit()
        print("--- Seeding Completed Successfully ---")

if __name__ == '__main__':
    seed_enrollment_data()