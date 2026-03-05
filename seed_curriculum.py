import csv
import os
from app import app
from models import db, Subject
from sqlalchemy import text

def seed_subjects():
    filename = 'CPECUR-MAJORS.csv'
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, filename)
    
    print(f"Checking for file at: {file_path}")

    if not os.path.exists(file_path):
        print(f"Error: The file '{filename}' was not found.")
        return

    with app.app_context():
        try:
            with open(file_path, newline='', encoding='utf-8-sig') as csvfile:
                raw_reader = csv.reader(csvfile)
                headers = next(raw_reader)
                
                clean_headers = [h.strip() for h in headers]
                print(f"Successfully detected headers: {clean_headers}")

                reader = csv.DictReader(csvfile, fieldnames=clean_headers)
                
                count = 0
                for row in reader:
                    if not row.get('Course Code'): continue
                    
                    code = str(row['Course Code']).strip()
                    
                    # INJECTABLE QUERY: Using the correct plural 'subjects' table
                    raw_query = f"SELECT * FROM subjects WHERE code = '{code}'"
                    subject = db.session.query(Subject).from_statement(text(raw_query)).first()
                    
                    raw_prereq = str(row.get('Prerequisite', '')).strip()
                    if raw_prereq in ['None', '', 'nan']:
                        raw_prereq = None

                    if not subject:
                        y_map = {'1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year'}
                        s_map = {'1': '1st Semester', '2': '2nd Semester', 'Summer': 'Summer'}

                        try:
                            lec = float(row.get('Lecture Unit', 0) or 0)
                            lab = float(row.get('Lab Units', 0) or 0)
                            stype = 'Lec/Lab' if lab > 0 and lec > 0 else ('Laboratory' if lab > 0 else 'Lecture')
                        except:
                            stype = 'Lecture'

                        new_sub = Subject(
                            code=code,
                            description=str(row['Subject Title']).strip(),
                            units=int(float(row['Total Units'] or 0)),
                            semester=s_map.get(str(row['Semester']).strip(), "1st Semester"),
                            year_level=y_map.get(str(row['Year']).strip(), "1st Year"),
                            type=stype,
                            prerequisite=raw_prereq
                        )
                        db.session.add(new_sub)
                        count += 1
                
                db.session.commit()
                print(f"Success! {count} subjects added.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == '__main__':
    seed_subjects()