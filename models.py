from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

# 1. USERS (Faculty & Program Heads only - No Students)
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False) # 'head' or 'faculty'
    department = db.Column(db.String(100), nullable=True)
    
    
    # Relationships
    classes_handled = db.relationship('Section', backref='instructor', lazy=True)

# 2. STUDENTS (Data only - They cannot log in)
class Student(db.Model):
    __tablename__ = 'students'
    id = db.Column(db.String(20), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    program = db.Column(db.String(50), default='BSCpE')
    year_level = db.Column(db.String(20), default='1st Year')
    status = db.Column(db.String(20), default='Regular') 
    email = db.Column(db.String(100), nullable=True)
    
    # --- NEW COLUMNS ---
    contact_number = db.Column(db.String(50), nullable=True)
    address = db.Column(db.String(255), nullable=True)
    birthdate = db.Column(db.String(50), nullable=True)
    gender = db.Column(db.String(20), nullable=True)
    
    # --- ADD THIS LINE FOR DROPOUT TRACKING ---
    dropout_reason = db.Column(db.String(100), nullable=True) 
    dropout_date = db.Column(db.String(50), nullable=True)
    
    # Relationships
    enrollments = db.relationship('Enrollment', backref='student', lazy=True)

# 3. SUBJECTS (The Course Catalog)
class Subject(db.Model):
    __tablename__ = 'subjects'
    code = db.Column(db.String(20), primary_key=True) # e.g. "CPE 038"
    description = db.Column(db.String(200), nullable=False)
    units = db.Column(db.Integer, nullable=False)
    semester = db.Column(db.String(20)) # "1st", "2nd"
    year_level = db.Column(db.String(20)) # "1st Year", etc.
    type = db.Column(db.String(20)) # "Lecture", "Laboratory"
    prerequisite = db.Column(db.String(100), nullable=True)
    category = db.Column(db.String(50), nullable=True, default='Major')

# 4. SECTIONS (Actual Scheduled Classes)
# 4. SECTIONS (Actual Scheduled Classes)
class Section(db.Model):
    __tablename__ = 'sections'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False) # e.g. "CPE-3A"
    subject_code = db.Column(db.String(20), db.ForeignKey('subjects.code'), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Schedule Info
    room = db.Column(db.String(20))
    schedule = db.Column(db.String(50)) # e.g. "MW 10:00-11:30"
    max_seats = db.Column(db.Integer, default=40)

    # --- NEW: Grade Tracking & Auto-Save ---
    grade_status = db.Column(db.String(20), default='Open') # Prevents the approval crash
    draft_scores = db.Column(db.Text, nullable=True) # Silently holds the unfinished JS grades

    # Relationships
    subject = db.relationship('Subject', backref='sections')
    students_enrolled = db.relationship('Enrollment', backref='section', lazy=True)

# 5. ENROLLMENT (The Link: Student <-> Section)
class Enrollment(db.Model):
    __tablename__ = 'enrollments'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(20), db.ForeignKey('students.id'), nullable=False)
    section_id = db.Column(db.Integer, db.ForeignKey('sections.id'), nullable=False)
    date_enrolled = db.Column(db.DateTime, default=datetime.utcnow)
    
    # --- NEW: GRADE BREAKDOWN PERIODS ---
    p1_grade = db.Column(db.Float, nullable=True) 
    p2_grade = db.Column(db.Float, nullable=True)
    p3_grade = db.Column(db.Float, nullable=True)
    
    grade = db.Column(db.Float, nullable=True) # Final Grade
    status = db.Column(db.String(20), default='Enrolled') # Enrolled, Dropped, Passed, Failed
# 6. CREATE ACCOUNT PANEL (The Link: Student <-> Section)

# 7. SCHEDULE EVENTS (Powers the FullCalendar UI)
class ScheduleEvent(db.Model):
    __tablename__ = 'schedule_events'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)        
    subject_code = db.Column(db.String(20), nullable=False)  
    section_code = db.Column(db.String(50), nullable=False)  
    faculty_name = db.Column(db.String(100), nullable=True)  
    room = db.Column(db.String(50), nullable=True)           
    type = db.Column(db.String(20), nullable=False)          
    year_level = db.Column(db.String(20), nullable=False)    
    
    start_time = db.Column(db.String(50), nullable=False)
    end_time = db.Column(db.String(50), nullable=False)
    color = db.Column(db.String(20), nullable=False)
    
    # --- NEW: Tracks which semester this schedule belongs to ---
    academic_term = db.Column(db.String(50), nullable=False, default='AY2025-2026-Sem2')

# 8. ADVISING RECORDS
class AdvisingRecord(db.Model):
    __tablename__ = 'advising_records'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(20), db.ForeignKey('students.id'), nullable=False)
    date = db.Column(db.String(50), nullable=False)
    
    # --- Structured Data ---
    category = db.Column(db.String(50), nullable=True) 
    notes = db.Column(db.Text, nullable=False)
    action_plan = db.Column(db.Text, nullable=True) 
    
    # --- NEW: Follow-up & Status ---
    status = db.Column(db.String(20), default='Open')
    follow_up_date = db.Column(db.String(50), nullable=True)
    
    # Relationship to link records easily
    student = db.relationship('Student', backref='advising_records', lazy=True)

# 9. SYSTEM SETTINGS (For global toggles like active grading period)
class SystemSettings(db.Model):
    __tablename__ = 'system_settings'
    id = db.Column(db.Integer, primary_key=True)
    setting_key = db.Column(db.String(50), unique=True, nullable=False)
    setting_value = db.Column(db.String(255), nullable=True)