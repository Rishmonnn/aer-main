from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from functools import wraps
import os
from config import get_config
import random

# --- NEW: Import the Database and Models ---
from models import db, User, Student, Subject, Section, Enrollment

app = Flask(__name__, 
    template_folder=os.path.join(os.path.dirname(__file__), 'templates'),
    static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# Load configuration
config_env = os.environ.get('FLASK_ENV', 'development')
app.config.from_object(get_config(config_env))

# --- NEW: Initialize Database with the App ---
#db.init_app(app)

# --- NEW: Create Tables Automatically (Run once on startup) ---
#with app.app_context():
    # This creates the tables defined in models.py if they don't exist
 #   db.create_all()
  #  print("Database tables created successfully!")

# ==================== FACULTY MOCK DATA (Minimal) ====================
FACULTY_DATA = {
    'classes': 3,
    'total_students': 45,
    'grading_status': '67%'
}

FACULTY_CLASS_LIST = [
    {'id': 1, 'code': 'CE101', 'name': 'Introduction to Civil Engineering', 'students': 35},
    {'id': 2, 'code': 'CE102', 'name': 'Structural Analysis', 'students': 40},
    {'id': 3, 'code': 'CE103', 'name': 'Fluid Mechanics', 'students': 38}
]

# --- SHARED INSTRUCTORS DATA (Source of Truth) ---
INSTRUCTORS_DATA = [
    { 'id': 1, 'name': "SANTOS, MARIA CLARA", 'department': "Computer Engineering", 'classes': 2, 'lec': 3.0, 'lab': 0.0 },
    { 'id': 2, 'name': "REYES, JOHN MICHAEL", 'department': "Computer Engineering", 'classes': 2, 'lec': 3.0, 'lab': 3.0 },
    { 'id': 3, 'name': "DELA CRUZ, ANNA", 'department': "Computer Engineering", 'classes': 2, 'lec': 0.0, 'lab': 3.0 },
    { 'id': 4, 'name': "GARCIA, PEDRO", 'department': "Computer Engineering", 'classes': 5, 'lec': 9.0, 'lab': 0.0 },
    { 'id': 5, 'name': "VILLANUEVA, JOSE", 'department': "Computer Engineering", 'classes': 2, 'lec': 3.0, 'lab': 1.5 },
    { 'id': 6, 'name': "SAMPLE, FULL LOAD", 'department': "Computer Engineering", 'classes': 8, 'lec': 18.0, 'lab': 8.0 },
    { 'id': 7, 'name': "Engr. Juan Dela Cruz", 'department': "Computer Engineering", 'classes': 0, 'lec': 0, 'lab': 0 },
    { 'id': 8, 'name': "Dr. Jose Rizal", 'department': "General Education", 'classes': 0, 'lec': 0, 'lab': 0 }
]

# ==================== AUTH & ROUTES ====================

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    if 'user' in session:
        role = session.get('role')
        if role == 'faculty': return redirect(url_for('faculty_dashboard'))
        if role == 'head': return redirect(url_for('program_head_dashboard'))
    return render_template('index.html')

@app.route('/login', methods=['POST'])
def login():
    email = request.form.get('email', '').lower()
    password = request.form.get('password', '')
    role = request.form.get('role', '')
    
    if not email or not password or not role:
        return redirect(url_for('index'))
    
    # TODO: In Phase 2, we will replace this with a Database Check (User.query.filter_by...)
    if role == 'faculty' and 'faculty' in email:
        session['user'] = email
        session['role'] = 'faculty'
        return redirect(url_for('faculty_dashboard'))
    elif role == 'head' and 'head' in email:
        session['user'] = email
        session['role'] = 'head'
        return redirect(url_for('program_head_dashboard'))
    else:
        return redirect(url_for('index'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/faculty')
@login_required
def faculty_dashboard():
    if session.get('role') != 'faculty': return redirect(url_for('index'))
    
    # INTEGRATION: Added classrecords CSS and JS
    context = {
        'pageTitle': 'Faculty Dashboard',
        'pageStyles': ['dashboard.css', 'faculty.css', 'classrecords.css'],
        'pageScripts': ['faculty.js', 'faculty-grading.js', 'faculty-classes.js', 'faculty-inc.js', 'classrecords.js'],
        'user_name': session.get('user', 'Faculty'),
        'stats': FACULTY_DATA
    }
    return render_template('faculty.html', **context)

@app.route('/program-head')
@login_required
def program_head_dashboard():
    if session.get('role') != 'head': return redirect(url_for('index'))
    
    context = {
        'pageTitle': 'Program Head Dashboard',
        'user_name': session.get('user', 'Program Head'),
        'pageStyles': [
            'program-head.css', 
            'enrollment.css', 
            'enlistment.css', 
            'student_journey.css', 
            'retention.css', 
            'classrecords.css',
            'instructors.css', 
            'schedules.css'
        ],
        'pageScripts': [
            'program-head.js', 
            'enrollment.js', 
            'enlistment.js', 
            'student_journey.js', 
            'retention.js', 
            'classrecords.js',
            'instructors.js',
            'schedules.js'
        ]
    }
    return render_template('program-head.html', **context)

# ==================== FACULTY APIs ====================

@app.route('/api/faculty/classes', methods=['GET'])
@login_required
def get_faculty_classes():
    return jsonify(FACULTY_CLASS_LIST)

@app.route('/api/faculty/inc', methods=['GET'])
@login_required
def get_inc_requests():
    return jsonify([{'id': 1, 'student_name': 'Juan Dela Cruz', 'subject': 'CE101', 'status': 'pending'}])

# ==================== GENERIC/STUB APIs ====================

# --- NEW: Instructors API ---
@app.route('/api/instructors', methods=['GET'])
@login_required
def get_instructors():
    """Returns the central list of instructors for both modules."""
    return jsonify(INSTRUCTORS_DATA)

@app.route('/api/enrollment', methods=['POST'])
@login_required
def enroll_students():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'No data received'}), 400
    
    success_count = 0
    
    try:
        for row in data:
            # 1. Handle ID (Use provided ID or Generate Temp one if missing)
            student_id = row.get('student_id')
            if not student_id:
                # Fallback: Generate ID (e.g., 2024-XXXX)
                student_id = f"2024-{random.randint(10000, 99999)}"
            
            # 2. Check if student exists
            student = Student.query.get(student_id)
            
            # 3. Create Name String
            full_name = f"{row.get('lastname', '')}, {row.get('firstname', '')}"
            if row.get('middlename'):
                full_name += f" {row.get('middlename')[0]}."
            
            if not student:
                # Create New Student
                student = Student(
                    id=str(student_id),
                    name=full_name,
                    program=row.get('program', 'BSCpE'),
                    email=row.get('email'),
                    year_level='1st Year',
                    status='Regular'
                )
                db.session.add(student)
                success_count += 1
            else:
                # Optional: Update existing student data if needed
                pass

        db.session.commit()
        return jsonify({'status': 'success', 'count': success_count})

    except Exception as e:
        db.session.rollback()
        print(f"Error: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/advising', methods=['GET'])
@login_required
def get_advising(): return jsonify([])

@app.route('/api/retention', methods=['GET'])
@login_required
def get_retention_data(): 
    return jsonify({'good': 45, 'warning': 12, 'probation': 8, 'critical': 3, 'students': []})

@app.route('/api/enlistment', methods=['GET'])
@login_required
def get_enlistment(): return jsonify([])

@app.route('/api/schedules', methods=['GET'])
@login_required
def get_schedules():
    return jsonify([{'id': 1, 'title': 'Class Schedule A', 'times': 'MWF 9:00-10:30'}])

@app.errorhandler(404)
def not_found(error): return redirect(url_for('index')), 404

if __name__ == '__main__':
    app.run(debug=app.config['DEBUG'], host='127.0.0.1', port=5000)