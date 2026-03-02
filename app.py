from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from functools import wraps
import os
from config import get_config
import random
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime # Make sure to import datetime

# Change your models import to include AdvisingRecord
from models import db, User, Student, Subject, Section, Enrollment, ScheduleEvent, AdvisingRecord

app = Flask(__name__, 
    template_folder=os.path.join(os.path.dirname(__file__), 'templates'),
    static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# Load configuration
config_env = os.environ.get('FLASK_ENV', 'development')
app.config.from_object(get_config(config_env))

# --- NEW: Initialize Database with the App ---
db.init_app(app)

with app.app_context():
     db.create_all()
     print("Database tables created successfully!")

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
INSTRUCTORS_DATA = [
    { 'id': 1001, 'name': "SANTOS, MARIA CLARA", 'department': "Computer Engineering", 'classes': 2, 'lec': 3.0, 'lab': 0.0 },
    { 'id': 1002, 'name': "REYES, JOHN MICHAEL", 'department': "Computer Engineering", 'classes': 2, 'lec': 3.0, 'lab': 3.0 },
    { 'id': 1003, 'name': "DELA CRUZ, ANNA", 'department': "Computer Engineering", 'classes': 2, 'lec': 0.0, 'lab': 3.0 },
    { 'id': 1004, 'name': "SAMPLE, FULL LOAD", 'department': "Computer Engineering", 'classes': 8, 'lec': 18.0, 'lab': 8.0 },
    { 'id': 1005, 'name': "Engr. Juan Dela Cruz", 'department': "Computer Engineering", 'classes': 0, 'lec': 0, 'lab': 0 },
    { 'id': 1006, 'name': "Dr. Jose Rizal", 'department': "General Education", 'classes': 0, 'lec': 0, 'lab': 0 }
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
    
    # 1. Remove 'role' from the initial empty check
    if not email or not password:
        return redirect(url_for('index'))
    
    # 2. Determine role based on the email address itself
    if 'faculty' in email:
        session['user'] = email
        session['role'] = 'faculty'
        return redirect(url_for('faculty_dashboard'))
        
    elif 'head' in email:
        session['user'] = email
        session['role'] = 'head'
        return redirect(url_for('program_head_dashboard'))
    
    else:
        # If the email doesn't contain 'head' or 'faculty', login fails
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
    
    # --- GET ACTUAL DATA FROM DATABASE ---
    try:
        # Count all active students (Ignore Dropped and Transferred)
        total_students = Student.query.filter(Student.status.notin_(['Dropped', 'Transferred'])).count()
        # Count all faculty (case-insensitive check for 'faculty' role)
        total_faculty = User.query.filter(User.role.ilike('faculty')).count()
        # Set academic year (you can make this dynamic later if you have a Settings table)
        academic_year = "2025-2026"
    except Exception as e:
        print(f"Error fetching stats: {e}")
        total_students = 0
        total_faculty = 0
        academic_year = "2025-2026"

    context = {
        'pageTitle': 'Program Head Dashboard',
        'user_name': session.get('user', 'Program Head'),
        'total_students': total_students,   # Pass to frontend
        'total_faculty': total_faculty,     # Pass to frontend
        'academic_year': academic_year,     # Pass to frontend
        'pageStyles': [
            'program-head.css', 'enrollment.css', 'enlistment.css', 
            'student_journey.css', 'retention.css', 'classrecords.css',
            'instructors.css', 'schedules.css'
        ],
        'pageScripts': [
            'program-head.js', 'enrollment.js', 'enlistment.js', 
            'student_journey.js', 'retention.js', 'classrecords.js',
            'instructors.js', 'schedules.js'
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

@app.route('/api/advising/<string:student_id>', methods=['GET'])

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
                    status='Regular',
                    # --- NEW FIELDS SAVED HERE ---
                    contact_number=row.get('contact'),
                    address=row.get('address'),
                    birthdate=row.get('birthdate'),
                    gender=row.get('gender')
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
    try:
        students = Student.query.all()
        historical_total = len(students) # Everyone who ever enrolled
        
        regular_count = 0
        irregular_count = 0
        year_counts = {'1st Year': 0, '2nd Year': 0, '3rd Year': 0, '4th Year': 0}
        
        at_risk_students = []
        critical_risk_count = 0
        high_risk_count = 0

        # --- UPDATED: Track both Dropped and Transferred ---
        dropped_students = [s for s in students if s.status in ['Dropped', 'Transferred']]
        dropout_count = len(dropped_students)
        
        # --- NEW: Calculate ONLY Active Students ---
        active_students = historical_total - dropout_count
        
        # Calculate Rates using historical total to avoid math errors
        dropout_rate = round((dropout_count / historical_total * 100) if historical_total > 0 else 0, 1)
        retention_rate = round(100 - dropout_rate, 1)

        # TREND CALCULATION
        last_year_retention = 85.0
        last_year_dropout = 15.0
        
        retention_trend = round(retention_rate - last_year_retention, 1)
        dropout_trend = round(dropout_rate - last_year_dropout, 1)

        # Tally up the reasons why they dropped out
        reasons_tally = {}
        for ds in dropped_students:
            reason = ds.dropout_reason or "Other"
            reasons_tally[reason] = reasons_tally.get(reason, 0) + 1
        
        reasons_data = []
        for reason, count in reasons_tally.items():
            pct = round((count / dropout_count) * 100) if dropout_count > 0 else 0
            reasons_data.append({"reason": reason, "percentage": pct})
            
        reasons_data.sort(key=lambda x: x['percentage'], reverse=True)

        for s in students:
            # Skip dropped/transferred students for population metrics
            if s.status in ['Dropped', 'Transferred']:
                continue

            # 1. Tally Population by Year Level
            if s.year_level in year_counts:
                year_counts[s.year_level] += 1
            
            # 2. Check for failing grades
            failed_records = Enrollment.query.filter_by(student_id=s.id)\
                .filter((Enrollment.grade > 3.0) | (Enrollment.status == 'Failed')).all()
            
            fail_count = len(failed_records)
            
            if fail_count > 0:
                irregular_count += 1
                risk_level = "Critical Risk" if fail_count >= 2 else "High Risk"
                risk_class = "critical" if fail_count >= 2 else "high"
                
                if fail_count >= 2: critical_risk_count += 1
                else: high_risk_count += 1
                    
                at_risk_students.append({
                    'id': s.id,
                    'name': s.name,
                    'program': s.program,
                    'year_level': s.year_level,
                    'risk_level': risk_level,
                    'risk_class': risk_class
                })
            else:
                regular_count += 1

        return jsonify({
            'stats': {
                'total': active_students, # <--- NOW SENDS ONLY ACTIVE STUDENTS
                'regular': regular_count,
                'irregular': irregular_count,
                'retention_rate': retention_rate,
                'dropout_rate': dropout_rate,
                'retention_trend': retention_trend, 
                'dropout_trend': dropout_trend      
            },
            'reasons': reasons_data,
            'population': year_counts,
            'risks': {
                'critical_count': critical_risk_count,
                'high_count': high_risk_count
            },
            'at_risk_students': at_risk_students
        })
    except Exception as e:
        print(f"Error loading retention data: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/enlistment', methods=['GET'])
@login_required
def get_enlistment(): return jsonify([])

@app.route('/api/schedules', methods=['GET'])
@login_required
def get_all_schedules():
    """Fetches all schedules from the database formatted for FullCalendar."""
    events = ScheduleEvent.query.all()
    output = []
    for ev in events:
        output.append({
            'id': ev.id,
            'title': ev.title,
            'start': ev.start_time,
            'end': ev.end_time,
            'backgroundColor': ev.color,
            'borderColor': ev.color,
            'extendedProps': {
                'code': ev.subject_code,
                'sectionCode': ev.section_code,
                'faculty': ev.faculty_name,
                'room': ev.room,
                'type': ev.type,
                'year': ev.year_level
            }
        })
    return jsonify(output)

@app.route('/api/schedules', methods=['POST'])
@login_required
def save_schedule():
    """Saves a new class or updates an existing one in the database."""
    data = request.get_json()
    
    try:
        # If an ID is provided, update the existing event
        event_id = data.get('id')
        if event_id:
            event = ScheduleEvent.query.get(event_id)
        else:
            event = ScheduleEvent()
            db.session.add(event)
            
        event.title = data['title']
        event.subject_code = data['extendedProps']['code']
        event.section_code = data['extendedProps']['sectionCode']
        event.faculty_name = data['extendedProps']['faculty']
        event.room = data['extendedProps']['room']
        event.type = data['extendedProps']['type']
        event.year_level = str(data['extendedProps']['year'])
        event.start_time = data['start']
        event.end_time = data['end']
        event.color = data['backgroundColor']
        
        db.session.commit()
        return jsonify({'success': True, 'id': event.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/schedules/<int:event_id>', methods=['DELETE'])
@login_required
def delete_schedule(event_id):
    """Deletes a schedule from the database."""
    event = ScheduleEvent.query.get(event_id)
    if event:
        db.session.delete(event)
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Event not found'}), 404


@app.route('/api/students', methods=['GET'])
@login_required
def get_all_students():
    try:
        # --- NEW: Only fetch active students (Hide Dropped/Transferred) ---
        students = Student.query.filter(Student.status.notin_(['Dropped', 'Transferred'])).all()
        student_list = []
        
        for s in students:
            student_list.append({
                'id': s.id,
                'name': s.name,
                'program': s.program,
                'year_level': s.year_level,
                'status': s.status,
            })
            
        return jsonify(student_list)
    except Exception as e:
        print(f"Error fetching students: {e}")
        return jsonify([])
    
    
# --- 2. NEW ROUTE (Add this for Class Records) ---
@app.route('/api/faculty/class-records/students', methods=['GET'])
@login_required
def get_class_record_students():
    try:
        # --- NEW: Only fetch active students (Hide Dropped/Transferred) ---
        students = Student.query.filter(Student.status.notin_(['Dropped', 'Transferred'])).all()
        student_list = []
        for s in students:
            student_list.append({
                'id': s.id,
                'name': s.name,
                'program': s.program,
                'year_level': s.year_level,
                'email': s.email
            })
        return jsonify(student_list)
    except Exception as e:
        print(f"Error fetching class record students: {e}")
        return jsonify([])

@app.route('/api/students/update/<string:student_id>', methods=['POST'])
@login_required
def update_student_info(student_id):
    data = request.get_json()
    student = Student.query.get(student_id)
    
    if not student:
        return jsonify({'success': False, 'message': 'Student not found'}), 404
        
    try:

        if 'contact_number' in data:
            student.contact_number = str(data['contact_number'])
            
        if 'email' in data:
            student.email = str(data['email'])

        db.session.commit()
        return jsonify({'success': True})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.errorhandler(404)
def not_found(error): return redirect(url_for('index')), 404


# --- PUT THIS RIGHT BELOW /api/students/update/... ---

@app.route('/api/students/drop/<string:student_id>', methods=['POST'])
@login_required
def drop_student(student_id):
    data = request.get_json()
    student = Student.query.get(student_id)
    
    if not student:
        return jsonify({'success': False, 'message': 'Student not found'}), 404
        
    try:
        # Get the status (Dropped or Transferred) from the frontend
        new_status = data.get('status', 'Dropped')
        
        student.status = new_status
        student.dropout_reason = data.get('reason', 'Other')
        student.dropout_date = datetime.now().strftime("%b %d, %Y")
        
        # Remove them from their active classes
        active_enrollments = Enrollment.query.filter_by(student_id=student_id).filter(Enrollment.status.in_(['Enrolled', 'Pending'])).all()
        for enrollment in active_enrollments:
            enrollment.status = 'Dropped'
            
        db.session.commit()
        return jsonify({'success': True})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    
@app.route('/api/retention/history', methods=['GET'])
@login_required
def get_drop_history():
    try:
        # Fetch only students who are Dropped or Transferred
        dropped_students = Student.query.filter(Student.status.in_(['Dropped', 'Transferred'])).all()
        history = []
        for s in dropped_students:
            history.append({
                'id': s.id,
                'name': s.name,
                'status': s.status,
                'reason': s.dropout_reason or 'Not Specified',
                'date': s.dropout_date or 'N/A' # --- NEW: Send date to frontend ---
            })
        return jsonify(history)
    except Exception as e:
        print(f"Error fetching drop history: {e}")
        return jsonify([])
    
# ==================== STUDENT JOURNEY API ====================
@app.route('/api/student_journey/<string:student_id>', methods=['GET'])
@login_required
def get_student_journey_data(student_id):
    # 1. Check if student exists
    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    # 2. Get all enrollments for this student
    enrollments = Enrollment.query.filter_by(student_id=student_id).all()

    # 3. Aggregators
    semesters_map = {} 
    total_earned_units = 0
    total_registered_units = 0
    TOTAL_CURRICULUM_UNITS = 172 # Based on your curriculum file

    for enroll in enrollments:
        # Get related data
        section = db.session.get(Section, enroll.section_id)
        if not section: continue
        subject = db.session.get(Subject, section.subject_code)
        if not subject: continue

        # Group Key: e.g., "1st Year - 1st Semester"
        # We assume database stores "1st Year" and "1st Semester"
        sem_key = f"{subject.year_level} - {subject.semester}"

        # Initialize Semester bucket if missing
        if sem_key not in semesters_map:
            semesters_map[sem_key] = {
                'units_reg': 0,
                'units_earned': 0,
                'gwa_accum': 0, # grade * units
                'gwa_units': 0, # total units for GWA
                'subjects': []
            }

        # Process Grade
        raw_grade = enroll.grade
        grade_display = float(raw_grade) if raw_grade else 0.0
        
        # Add Subject Data to List
        semesters_map[sem_key]['subjects'].append({
            'code': subject.code,
            'desc': subject.description,
            'type': subject.type,
            'units': subject.units,
            'grade': grade_display,
            'remarks': enroll.status,  # Passed, Failed, Pending
            # --- NEW: FETCH PERIOD GRADES ---
            'p1': enroll.p1_grade if enroll.p1_grade else '-',
            'p2': enroll.p2_grade if enroll.p2_grade else '-',
            'p3': enroll.p3_grade if enroll.p3_grade else '-'
        })

        # Calculate Units
        semesters_map[sem_key]['units_reg'] += subject.units
        total_registered_units += subject.units

        if enroll.status == 'Passed' or (raw_grade and raw_grade <= 3.0):
            semesters_map[sem_key]['units_earned'] += subject.units
            total_earned_units += subject.units
            
            # GWA Calculation (Only count if there is a numeric grade)
            if raw_grade:
                semesters_map[sem_key]['gwa_accum'] += (raw_grade * subject.units)
                semesters_map[sem_key]['gwa_units'] += subject.units

    # 4. Format Output for Frontend
    semesters_list = []
    grades_data = {}

    # Sort keys to ensure 1st Year comes before 2nd Year
    sorted_keys = sorted(semesters_map.keys())

    for key in sorted_keys:
        data = semesters_map[key]
        
        # Calculate Final GWA for this semester
        gwa = 0.00
        if data['gwa_units'] > 0:
            gwa = data['gwa_accum'] / data['gwa_units']

        semesters_list.append({
            'name': key,
            'reg': data['units_reg'],
            'earned': data['units_earned'],
            'gwa': round(gwa, 2)
        })
        
        # Assign subjects to the grades dictionary
        grades_data[key] = data['subjects']

  # 5. Determine Regular/Irregular Status Dynamically
    # Check if the student has any failed grades in their history
    failed_records = Enrollment.query.filter_by(student_id=student_id)\
        .filter((Enrollment.grade > 3.0) | (Enrollment.status == 'Failed')).all()
    
    academic_status = 'Irregular' if len(failed_records) > 0 else 'Regular'

    # Final JSON Structure
    return jsonify({
        'student_info': {
            'id': student.id,
            'name': student.name,
            'program': student.program,
            'year_level': student.year_level,
            'status': academic_status, # <--- Now strictly sends Regular or Irregular
            'email': student.email if student.email else 'N/A',
            'contact_number': getattr(student, 'contact_number', 'N/A'),
            'address': getattr(student, 'address', 'N/A'),
            'birthdate': getattr(student, 'birthdate', 'N/A')
        },
        'summary': {
            'earned': total_earned_units,
            'registered': total_registered_units,
            'remaining': TOTAL_CURRICULUM_UNITS - total_earned_units,
            'total': TOTAL_CURRICULUM_UNITS
        },
        'semesters': semesters_list,
        'grades': grades_data
    })
    
    
    # ==================== ENROLLMENT & ENLISTMENT WORKFLOW ====================

@app.route('/api/enrollment/pending', methods=['GET'])
@login_required
def get_pending_enrollment():
    """Fetches students who are waiting to be enrolled (Status: Pending)."""
    students = Student.query.filter_by(status='Pending').all()
    
    output = []
    for s in students:
        # 1. Check for Failures in the Database
        # We look for any failing grade (5.0) or Failed status
        failed_enrollments = Enrollment.query.filter_by(student_id=s.id)\
            .filter( (Enrollment.grade > 3.0) | (Enrollment.status == 'Failed') )\
            .all()
        
        is_retained = len(failed_enrollments) > 0
        
        decision = 'Retained' if is_retained else 'Promoted'
        decision_color = 'retained' if is_retained else 'promoted' # CSS class helper

        output.append({
            'id': s.id,
            'name': s.name,
            'program': s.program,
            'year_level': s.year_level,
            'status': s.status,
            'type': 'Irregular' if is_retained else 'Regular',
            'decision': decision,
            'hasWarnings': is_retained # Triggers the warning icon in frontend
        })
    return jsonify(output)


@app.route('/api/enrollment/confirm_bulk', methods=['POST'])
@login_required
def confirm_bulk_enrollment():
    """Promotes multiple students at once."""
    data = request.get_json()
    student_ids = data.get('ids', [])
    
    if not student_ids:
        return jsonify({'error': 'No students selected'}), 400

    success_count = 0
    for student_id in student_ids:
        student = Student.query.get(student_id)
        if not student:
            continue

        # 1. Check for Failures (Retention Logic)
        failed_enrollments = Enrollment.query.filter_by(student_id=student.id)\
            .filter( (Enrollment.grade > 3.0) | (Enrollment.status == 'Failed') )\
            .all()
        
        is_retained = len(failed_enrollments) > 0
        student.status = 'Enlisting'

        if not is_retained:
            # Bump Year Level if promoted
            if student.year_level == '1st Year': student.year_level = '2nd Year'
            elif student.year_level == '2nd Year': student.year_level = '3rd Year'
            elif student.year_level == '3rd Year': student.year_level = '4th Year'
            
        success_count += 1
        
    db.session.commit()
    
    return jsonify({
        'success': True, 
        'count': success_count
    })
    
    
@app.route('/api/enrollment/confirm', methods=['POST'])
@login_required
def confirm_single_enrollment():
    """Promotes a single student to Enlisting status."""
    data = request.get_json()
    student_id = data.get('id')
    
    if not student_id:
        return jsonify({'success': False, 'error': 'No student ID provided'}), 400

    student = Student.query.get(student_id)
    if not student:
        return jsonify({'success': False, 'error': 'Student not found'}), 404

    try:
        # 1. Check for Failures (Retention Logic)
        failed_enrollments = Enrollment.query.filter_by(student_id=student.id)\
            .filter( (Enrollment.grade > 3.0) | (Enrollment.status == 'Failed') )\
            .all()
        
        is_retained = len(failed_enrollments) > 0
        
        # 2. Update status to move them to the next step
        student.status = 'Enlisting'

        # 3. Bump Year Level if promoted
        if not is_retained:
            if student.year_level == '1st Year': student.year_level = '2nd Year'
            elif student.year_level == '2nd Year': student.year_level = '3rd Year'
            elif student.year_level == '3rd Year': student.year_level = '4th Year'
            
        db.session.commit()
        
        return jsonify({
            'success': True,
            'status': 'Enlisting'
        })

    except Exception as e:
        db.session.rollback()
        print(f"Error confirming enrollment: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/enlistment/pending', methods=['GET'])
@login_required
def get_enlistment_candidates():
    """Fetches students who are ready to pick subjects (Status: Enlisting)."""
    # Fetch students who have been promoted to 'Enlisting'
    students = Student.query.filter_by(status='Enlisting').all()
    
    output = []
    for s in students:
        output.append({
            'id': s.id,
            'name': s.name,
            'program': s.program,
            'year_level': s.year_level,  # <--- CRITICAL: Needed for the accordion
            'status': 'Regular',         # Defaulting to Regular for now
            'units': 0,
            'maxUnits': 23,              # Default max units
            'retained': False
        })
    return jsonify(output)

@app.route('/register', methods=['POST'])
def register():
    # Get data from the form
    name = request.form.get('name')
    email = request.form.get('email')
    role = request.form.get('role')
    department = request.form.get('department')
    password = request.form.get('password')

    if email:
        email = email.lower()

    # Basic check if user already exists
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return render_template('index.html', error="Email already registered.")

    try:
        # Create new User instance
        new_user = User(
            name=name,
            email=email,
            role=role,
            department=department,
            password=generate_password_hash(password) # Hash for security
        )

        # Add and commit to database
        db.session.add(new_user)
        db.session.commit()

        # Automatically log them in after registration
        session['user'] = email
        session['role'] = role
        
        if role == 'head':
            return redirect(url_for('program_head_dashboard'))
        else:
            return redirect(url_for('faculty_dashboard'))

    except Exception as e:
        db.session.rollback()
        # === THIS LINE WILL SHOW THE REAL ERROR IN YOUR TERMINAL ===
        print(f"\n❌ REGISTRATION ERROR: {str(e)}\n") 
        return render_template('index.html', error=f"Registration failed: {str(e)}")

# ==================== ENLISTMENT API (REAL CURRICULUM) ====================
@app.route('/api/enlistment/subjects/<string:student_id>', methods=['GET'])
@login_required
def get_student_available_subjects(student_id):
    student = Student.query.get(student_id)
    if not student: return jsonify([])

    ACTIVE_SEMESTER = "1st Semester" 
  
    failed_records = Enrollment.query.filter_by(student_id=student_id)\
        .filter((Enrollment.grade > 3.0) | (Enrollment.status == 'Failed')).all()
    
    failed_codes = [f.section.subject_code for f in failed_records if f.section]

    # 2. Determine Scope of Subjects to Show
    target_year = student.year_level
    
    print(f"DEBUG: Enlistment for {student.name} ({target_year}) - Active Sem: {ACTIVE_SEMESTER}")

    regular_subjects = Subject.query.filter_by(
        year_level=target_year, 
        semester=ACTIVE_SEMESTER
    ).all()

   
    back_subjects = []
    if failed_codes:
        back_subjects = Subject.query.filter(
            Subject.code.in_(failed_codes),
            Subject.semester == ACTIVE_SEMESTER
        ).all()

    # Combine lists (Use a dictionary comp to remove duplicates based on code)
    combined = regular_subjects + back_subjects
    unique_subjects = {s.code: s for s in combined}.values()
    all_subjects = list(unique_subjects)
    
    output = []
    for sub in all_subjects:
        section = Section.query.filter_by(subject_code=sub.code).first()
        sched = section.schedule if section else "TBA"
        room = section.room if section else "TBA"

        # --- CRITICAL LOGIC: CHECK PREREQUISITES ---
        is_locked = False
        warning_msg = None
        
        # Check if this subject has a prerequisite
        if sub.prerequisite and sub.prerequisite not in ['None', '', 'nan']:
            # If the prerequisite is in the failed list, LOCK this subject
            if sub.prerequisite in failed_codes:
                is_locked = True
                warning_msg = f"Prerequisite {sub.prerequisite} Failed"

        # Check if this subject ITSELF was failed (Must Retake)
        is_retake = sub.code in failed_codes
        type_tag = 'critical' if is_retake else ('major' if sub.units >= 3 else 'minor')

        output.append({
            'code': sub.code,
            'name': sub.description,
            'units': sub.units,
            'type': type_tag,
            'sched': sched,
            'room': room,
            'section': section.name if section else "TBA",
            'locked': is_locked,   
            'warning': warning_msg 
        })
    
    # Sort: Retakes/Unlocked first, Locked last
    output.sort(key=lambda x: x['locked'])
    
    return jsonify(output)


@app.route('/api/enlistment/submit', methods=['POST'])
@login_required
def submit_student_enlistment():
    data = request.get_json()
    student_id = data.get('student_id')
    subjects = data.get('subjects') # List of subject codes
    
    student = Student.query.get(student_id)
    if not student:
        return jsonify({'success': False, 'message': 'Student not found'}), 404

    try:
        # 1. Update Student Status (Removes them from Enlistment Page)
        student.status = 'Enrolled' 
        
        # 2. Create Enrollments for each subject
        for code in subjects:
            # Find the section (or create a default one if missing)
            # In a real app, the student selects a specific Section ID. 
            # Here we auto-assign to Section A for simplicity.
            section = Section.query.filter_by(subject_code=code).first()
            
            if not section:
                # Fail-safe: Create a section if it doesn't exist
                subject = Subject.query.get(code)
                if subject:
                    section = Section(name=f"{code}-A", subject_code=code, room="TBA", schedule="TBA")
                    db.session.add(section)
                    db.session.commit() # Commit needed to get section.id
            
            if section:
                # Check if already enrolled to avoid duplicates
                exists = Enrollment.query.filter_by(student_id=student_id, section_id=section.id).first()
                if not exists:
                    enrollment = Enrollment(
                        student_id=student_id,
                        section_id=section.id,
                        grade=None,      # No grade yet (Currently taking it)
                        status='Enrolled' # Status in the class
                    )
                    db.session.add(enrollment)

        db.session.commit()
        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        print(f"Enlistment Error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500
    
# --- SHARED INSTRUCTORS DATA (Source of Truth) ---
@app.route('/api/users/faculty', methods=['GET'])
@login_required
def get_registered_faculty():
    try:
        # Use .ilike() instead of filter_by so it catches "Faculty", "faculty", or "FACULTY"
        faculty_users = User.query.filter(User.role.ilike('faculty')).all()
        
        output = []
        for user in faculty_users:
            output.append({
                'id': user.id,
                'name': user.name.upper(),
                'department': getattr(user, 'department', 'Unassigned'), 
                'classes': 0,
                'lec': 0.0,
                'lab': 0.0
            })
            
        return jsonify(output)
    except Exception as e:
        print(f"ERROR IN GET_REGISTERED_FACULTY: {e}") 
        return jsonify([])
        
@app.route('/api/subjects', methods=['GET'])
@login_required
def get_all_subjects():
    """Returns the full course catalog for the scheduler."""
    try:
        subjects = Subject.query.all()
        output = []
        for sub in subjects:
            # Safely extract just the number from "1st Year", "2nd Year"
            year_num = "1"
            if sub.year_level and sub.year_level[0].isdigit():
                year_num = sub.year_level[0]
                
            # Convert "1st Semester" to "1"
            sem_num = "1"
            if sub.semester and "2nd" in sub.semester:
                sem_num = "2"
            elif sub.semester and "Summer" in sub.semester:
                sem_num = "Summer"

            # Approximation for schedule Builder: determine if it has lab based on type
            is_lab = 1 if sub.type and 'Lab' in sub.type else 0
            
            output.append({
                'year': year_num,
                'sem': sem_num,
                'code': sub.code,
                'title': sub.description,
                'lec': sub.units if not is_lab else 0,
                'lab': sub.units if is_lab else 0
            })
        return jsonify(output)
    except Exception as e:
        print(f"Error fetching subjects: {e}")
        return jsonify([])

# ==================== DASHBOARD APIs ====================
@app.route('/api/dashboard/activities', methods=['GET'])
@login_required
def get_dashboard_activities():
    """Generates ALL dynamic recent activities and suggested actions based on DB state."""
    try:
        activities = []
        actions = []
        
        # --- 1. Fetch ALL Recent Activities ---
        
        # A. Fetch ALL Enrolled and Enlisting students
        recent_students = Student.query.filter(Student.status.in_(['Enrolled', 'Enlisting'])).all()
        
        for s in reversed(recent_students):
            action_type = "Enlisted" if s.status == 'Enrolled' else "Enrolled"
            activities.append({
                'type': action_type,
                'message': f"{s.name} ({s.id})",
                'time': "Recently Updated" # Used because Student table has no timestamp col
            })
            
        # B. Add Grading Activities (Aggregated by Section)
        graded_enrollments = Enrollment.query.filter(Enrollment.grade.isnot(None)).all()
        
        # Keep track of which sections we've already added an activity for 
        # so we don't spam the dashboard for every single student in that section.
        processed_sections = set()
        
        for eg in reversed(graded_enrollments):
            if eg.section_id not in processed_sections:
                processed_sections.add(eg.section_id)
                
                section = db.session.get(Section, eg.section_id)
                if section:
                    activities.append({
                        'type': "Grades Approved",
                        'message': f"{section.subject_code} - Section {section.name}",
                        'time': "Recently Updated"
                    })

        # --- 2. Generate Suggested Actions ---
        
        # Check for Pending Enrollments
        pending_enroll = Student.query.filter_by(status='Pending').count()
        if pending_enroll > 0:
            actions.append({
                'type': 'enrollment',
                'title': 'Pending Enrollments',
                'description': f"{pending_enroll} student(s) waiting for enrollment confirmation.",
                'btn_text': 'Review Enrollments'
            })
            
        # Check for Pending Enlistments
        pending_enlist = Student.query.filter_by(status='Enlisting').count()
        if pending_enlist > 0:
            actions.append({
                'type': 'enlistment',
                'title': 'Pending Enlistments',
                'description': f"{pending_enlist} student(s) waiting for subject selection.",
                'btn_text': 'Proceed to Enlistment'
            })
            
        # Check for failed grades (Retention risk)
        failed_count = Enrollment.query.filter( (Enrollment.grade > 3.0) | (Enrollment.status == 'Failed') ).count()
        if failed_count > 0:
            actions.append({
                'type': 'retention',
                'title': 'Retention Risks Detected',
                'description': f"{failed_count} failing grades recorded. Review student standings.",
                'btn_text': 'View Retention'
            })
            
        # Default action if everything is clear
        if not actions:
             actions.append({
                'type': 'clear',
                'title': 'All Clear',
                'description': "No pending actions required at this time.",
                'btn_text': 'View Dashboard'
            })

        return jsonify({
            'activities': activities,
            'actions': actions
        })

    except Exception as e:
        print(f"Error fetching dashboard data: {e}")
        return jsonify({'activities': [], 'actions': []}), 500


if __name__ == '__main__':
    app.run(debug=app.config['DEBUG'], host='0.0.0.0', port=5001)