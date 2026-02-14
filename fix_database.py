from app import app
from models import db, Subject, Section, Enrollment

def reset_database():
    with app.app_context():
        print("--- Resetting Academic Tables ---")
        
        # 1. Drop Enrollment first (because it points to Section)
        try:
            Enrollment.__table__.drop(db.engine)
            print("Dropped 'enrollments' table.")
        except Exception as e:
            print(f"Note: Could not drop 'enrollments' (might not exist). {e}")

        # 2. Drop Section next (because it points to Subject)
        try:
            Section.__table__.drop(db.engine)
            print("Dropped 'sections' table.")
        except Exception as e:
            print(f"Note: Could not drop 'sections' (might not exist). {e}")

        # 3. Finally, Drop Subject
        try:
            Subject.__table__.drop(db.engine)
            print("Dropped 'subjects' table.")
        except Exception as e:
            print(f"Error dropping 'subjects': {e}")

        # 4. Recreate everything
        db.create_all()
        print("--- Success! All tables recreated with new schema. ---")

if __name__ == '__main__':
    reset_database()