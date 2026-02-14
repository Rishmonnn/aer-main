from app import app
from models import db, Student

def seed_pending_students():
    with app.app_context():
        print("--- Creating Pending Students for Enrollment ---")
        
        # We will create 5 students who are "2nd Year" but status is "Pending"
        # This simulates them waiting to be enrolled into 3rd Year
        pending_students = [
            {"id": "2022-1001", "name": "Alice Johnson", "program": "BSCpE"},
            {"id": "2022-1002", "name": "Bob Williams", "program": "BSCpE"},
            {"id": "2022-1003", "name": "Charlie Brown", "program": "BSCpE"},
            {"id": "2022-1004", "name": "Diana Prince", "program": "BSCpE"},
            {"id": "2022-1005", "name": "Evan Wright", "program": "BSCpE"},
        ]

        count = 0
        for data in pending_students:
            student = db.session.get(Student, data['id'])
            if not student:
                student = Student(
                    id=data['id'],
                    name=data['name'],
                    program=data['program'],
                    year_level="2nd Year", # Currently 2nd Year
                    status="Pending",      # Waiting for approval
                    email=f"{data['name'].split()[0].lower()}@student.edu"
                )
                db.session.add(student)
                count += 1
            else:
                # Force reset them to pending for this demo
                student.status = "Pending"
                student.year_level = "2nd Year"
        
        db.session.commit()
        print(f"Success! {count} pending students ready for enrollment.")

if __name__ == '__main__':
    seed_pending_students()