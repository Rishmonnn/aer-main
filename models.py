from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

# 1. USERS (Faculty & Program Heads only - No Students)
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False) # Will store hashed passwords
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False) # 'head' or 'faculty'
    
    # Relationships
    classes_handled = db.relationship('Section', backref='instructor', lazy=True)

# 2. STUDENTS (Data only - They cannot log in)
class Student(db.Model):
    __tablename__ = 'students'
    id = db.Column(db.String(20), primary_key=True) # e.g. "2023-0001"
    name = db.Column(db.String(100), nullable=False)
    program = db.Column(db.String(50), default='BSCpE')
    year_level = db.Column(db.String(20), default='1st Year')
    status = db.Column(db.String(20), default='Regular') # Regular, Irregular
    email = db.Column(db.String(100), nullable=True)
    
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
    grade = db.Column(db.Float, nullable=True) # Final Grade
    status = db.Column(db.String(20), default='Enrolled') # Enrolled, Dropped, Passed, Failed