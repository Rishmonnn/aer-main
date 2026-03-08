from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from functools import wraps
import os
from config import get_config
import random
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime # Make sure to import datetime
from models import db, User, Student, Subject, Section, Enrollment, ScheduleEvent, AdvisingRecord
from dotenv import load_dotenv
from groq import Groq
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load the environment variables from the .env file BEFORE configuring the API
load_dotenv()
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Configure the Gemini API


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
INSTRUCTORS_DATA = []

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
        # Provide real defaults until you build a dynamic stats API for the faculty home page
        'stats': {'classes': 0, 'total_students': 0, 'grading_status': '0%'} 
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
    """Fetches the actual classes assigned to the logged-in faculty member."""
    try:
        user_email = session.get('user')
        user = User.query.filter_by(email=user_email).first()
        
        if not user:
            return jsonify([])

        # Find all sections assigned to this faculty member
        sections = Section.query.filter_by(faculty_id=user.id).all()
        output = []
        
        for sec in sections:
            # Get subject details for the description
            subject = db.session.get(Subject, sec.subject_code)
            
            # Count how many students are enrolled in this specific section
            student_count = Enrollment.query.filter_by(section_id=sec.id).count()
            
            output.append({
                'id': sec.id,
                'code': f"{sec.subject_code} ({sec.name})",
                'name': subject.description if subject else 'Unknown Subject',
                'students': student_count
            })
            
        return jsonify(output)
    except Exception as e:
        print(f"Error fetching faculty classes: {e}")
        return jsonify([])

@app.route('/api/faculty/inc', methods=['GET'])
@login_required
def get_inc_requests():
    return jsonify([{'id': 1, 'student_name': 'Juan Dela Cruz', 'subject': 'CE101', 'status': 'pending'}])

# ==================== GENERIC/STUB APIs ====================

@app.route('/api/advising/<string:student_id>', methods=['GET'])
@login_required
def get_student_advising(student_id):
    """Fetches advising history for a specific student."""
    records = AdvisingRecord.query.filter_by(student_id=student_id).order_by(AdvisingRecord.id.desc()).all()
    return jsonify([{
        'id': r.id,
        'date': r.date,
        'category': r.category or 'Uncategorized',
        'notes': r.notes,
        'action_plan': r.action_plan or 'None specified',
        'status': r.status or 'Open',                     # <--- NEW
        'follow_up_date': r.follow_up_date or 'None'      # <--- NEW
    } for r in records])

@app.route('/api/advising/<string:student_id>', methods=['POST'])
@login_required
def add_advising_record(student_id):
    """Saves a new advising session note."""
    data = request.get_json()
    notes = data.get('notes')
    category = data.get('category')
    action_plan = data.get('action_plan')
    status = data.get('status', 'Open')                   # <--- NEW
    follow_up_date = data.get('follow_up_date')           # <--- NEW
    
    if not notes:
        return jsonify({'success': False, 'message': 'Notes are required'}), 400
        
    try:
        record = AdvisingRecord(
            student_id=student_id,
            date=datetime.now().strftime("%b %d, %Y %I:%M %p"),
            category=category,
            notes=notes,
            action_plan=action_plan,
            status=status,                                # <--- NEW
            follow_up_date=follow_up_date                 # <--- NEW
        )
        db.session.add(record)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    
# --- NEW: Instructors API ---
@app.route('/api/instructors', methods=['GET'])
@login_required
def get_instructors():
    """Dynamically builds the instructors list based on imported schedules and registered accounts."""
    try:
        events = ScheduleEvent.query.all()
        faculty_loads = {}
        
        for ev in events:
            fac_name = ev.faculty_name
            if not fac_name or fac_name.strip() == '' or fac_name.upper() == 'TBA':
                continue
                
            fac_name = fac_name.strip().upper()
            
            if fac_name not in faculty_loads:
                faculty_loads[fac_name] = {
                    'id': fac_name, 
                    'name': fac_name,
                    'department': 'Unassigned',
                    'classes': 0,
                    'lec': 0,
                    'lab': 0,
                    'schedule': [] # <--- NEW: This holds the actual classes for the modal
                }
            
            # 1. Calculate hours (3 hours of lab = 1 unit)
            try:
                start_dt = datetime.fromisoformat(ev.start_time.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(ev.end_time.replace('Z', '+00:00'))
                hours = (end_dt - start_dt).total_seconds() / 3600
            except:
                hours = 0
            
            is_lab = ev.type and 'lab' in ev.type.lower()
            
            if is_lab:
                faculty_loads[fac_name]['lab'] += (hours / 3) if hours > 0 else 1
            else:
                faculty_loads[fac_name]['lec'] += hours if hours > 0 else 3
                
            faculty_loads[fac_name]['classes'] += 1
            
            # --- 2. NEW: Build the Schedule Data for the Modal ---
            day_idx = 0
            start_time_str = "TBA"
            end_time_str = "TBA"
            day_long = "Unknown"
            days_long_map = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            
            if ev.start_time and 'T' in ev.start_time:
                try:
                    s_dt = datetime.fromisoformat(ev.start_time.replace('Z', '+00:00'))
                    e_dt = datetime.fromisoformat(ev.end_time.replace('Z', '+00:00'))
                    
                    day_idx = s_dt.weekday() # 0 = Monday, 6 = Sunday
                    if day_idx < len(days_long_map):
                        day_long = days_long_map[day_idx]
                        
                    # Format to 12-hour AM/PM (e.g. "8:00 AM")
                    start_time_str = s_dt.strftime('%I:%M %p').lstrip('0')
                    end_time_str = e_dt.strftime('%I:%M %p').lstrip('0')
                except Exception as e:
                    pass
            else:
                # Fallback for raw imports without timestamps
                start_time_str = ev.start_time or "TBA"
                end_time_str = ev.end_time or "TBA"

            # Attach this specific class to the instructor's schedule list
            faculty_loads[fac_name]['schedule'].append({
                'subjectCode': ev.subject_code or 'TBA',
                'subjectDesc': ev.title or 'Unknown Subject',
                'room': ev.room or 'TBA',
                'startTime': start_time_str,
                'endTime': end_time_str,
                'dayIndex': day_idx,
                'dayLong': day_long,
                'type': 'Lab' if is_lab else 'Lec'
            })
            # ------------------------------------------------------

        # 3. Merge with registered faculty accounts
        registered_faculty = User.query.filter(User.role.ilike('faculty')).all()
        
        for user in registered_faculty:
            fac_name = user.name.upper()
            if fac_name in faculty_loads:
                faculty_loads[fac_name]['id'] = user.id
                faculty_loads[fac_name]['department'] = getattr(user, 'department', 'Unassigned')
            else:
                faculty_loads[fac_name] = {
                    'id': user.id,
                    'name': fac_name,
                    'department': getattr(user, 'department', 'Unassigned'),
                    'classes': 0,
                    'lec': 0,
                    'lab': 0,
                    'schedule': []
                }
                
        return jsonify(list(faculty_loads.values()))

    except Exception as e:
        print(f"Error generating instructors list: {e}")
        return jsonify([])

@app.route('/api/enrollment', methods=['POST'])
@login_required
def enroll_students():
    data = request.get_json()
    if not data:
        return jsonify({'status': 'error', 'message': 'No data received'}), 400
    
    success_count = 0
    
    try:
        # Calculate the dynamic School Year Prefix (e.g., "2526" for 2025-2026)
        now = datetime.now()
        if now.month < 6:
            start_yr = str(now.year - 1)[-2:]
            end_yr = str(now.year)[-2:]
        else:
            start_yr = str(now.year)[-2:]
            end_yr = str(now.year + 1)[-2:]
            
        sy_prefix = f"02-{start_yr}{end_yr}-"
        
        # Fetch the highest sequence number in the database for this prefix
        latest_student = Student.query.filter(Student.id.like(f"{sy_prefix}%")).order_by(Student.id.desc()).first()
        
        current_sequence = 0
        if latest_student:
            try:
                last_id_parts = latest_student.id.split('-')
                if len(last_id_parts) == 3:
                    current_sequence = int(last_id_parts[2])
            except ValueError:
                current_sequence = 0
                
        for row in data:
            # 1. Handle ID
            student_id = row.get('student_id')
            if not student_id or str(student_id).strip() == '':
                current_sequence += 1
                student_id = f"{sy_prefix}{current_sequence:05d}"
            
            # 2. Extract Names Cleanly
            fn_raw = row.get('firstname', '').strip()
            mn_raw = row.get('middlename', '').strip()
            ln_raw = row.get('lastname', '').strip()

            # Create standard display name (e.g., "Ajias, Richard D.")
            full_name = f"{ln_raw}, {fn_raw}"
            if mn_raw:
                full_name += f" {mn_raw[0]}."
                
            # --- NEW: SMART EMAIL GENERATOR ---
            # Remove spaces and convert to lowercase for email formatting
            fn_clean = fn_raw.lower().replace(' ', '')
            mn_clean = mn_raw.lower().replace(' ', '')
            ln_clean = ln_raw.lower().replace(' ', '')
            
            # Extract first 2 letters (falls back safely if name is only 1 letter)
            fn_prefix = fn_clean[:2] if fn_clean else ""
            mn_prefix = mn_clean[:2] if mn_clean else ""
            
            # Format: ridu.ajias.coc@phinmaed.com
            generated_email = f"{fn_prefix}{mn_prefix}.{ln_clean}.coc@phinmaed.com"
            # ----------------------------------
            
            student = Student.query.get(student_id)
            if not student:
                # Create New Student
                student = Student(
                    id=str(student_id),
                    name=full_name,
                    program=row.get('program', 'BSCpE'),
                    email=generated_email, # <--- USES THE GENERATED EMAIL
                    year_level='1st Year',
                    status='Regular',
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
                
                # --- NEW RISK EVALUATION LOGIC ---
                major_fail_count = 0
                failed_subjects = []
                failed_major_is_prereq = False
                
                for f in failed_records:
                    if not f.section: continue
                    sub = db.session.get(Subject, f.section.subject_code)
                    if not sub: continue
                    
                    failed_subjects.append(sub.code)
                    
                    # Determine if it's a Major subject (either categorized as Major or 3+ units)
                    is_major = getattr(sub, 'category', '') == 'Major' or sub.units >= 3
                    if is_major:
                        major_fail_count += 1
                        # Check if this subject is a prerequisite for any future subject
                        is_prereq = Subject.query.filter_by(prerequisite=sub.code).first() is not None
                        if is_prereq:
                            failed_major_is_prereq = True

                # --- APPLY NEW STANDARDS ---
                is_critical = False
                
                if failed_major_is_prereq:
                    is_critical = True
                    risk_reason = f"Failed Prerequisite Major: {', '.join(failed_subjects)}"
                elif major_fail_count >= 2:
                    is_critical = True
                    risk_reason = f"Failed {major_fail_count} Major Subjects"
                elif fail_count >= 3:
                    is_critical = True
                    risk_reason = f"Failed {fail_count} Subjects (Critical Threshold Reached)"
                else:
                    # High Risk: Failed 1-2 minor/non-prerequisite subjects
                    is_critical = False
                    risk_reason = f"Failed {fail_count} Minor/Non-Prerequisite Subject(s)"
                    
                # Assign Classes
                if is_critical:
                    risk_level = "Critical Risk"
                    risk_class = "critical"
                    critical_risk_count += 1
                else:
                    risk_level = "High Risk"
                    risk_class = "high"
                    high_risk_count += 1
                    
                at_risk_students.append({
                    'id': s.id,
                    'name': s.name,
                    'program': s.program,
                    'year_level': s.year_level,
                    'risk_level': risk_level,
                    'risk_class': risk_class,
                    'risk_reason': risk_reason
                })
            else:
                regular_count += 1

        return jsonify({
            'stats': {
                'total': active_students,
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
    
@app.route('/api/advising/record/<int:record_id>', methods=['PUT'])
@login_required
def update_advising_record(record_id):
    """Updates an existing advising session record."""
    data = request.get_json()
    record = AdvisingRecord.query.get(record_id)
    
    if not record:
        return jsonify({'success': False, 'message': 'Record not found'}), 404
        
    try:
        # Overwrite the old data with the newly submitted data
        record.category = data.get('category', record.category)
        record.notes = data.get('notes', record.notes)
        record.action_plan = data.get('action_plan', record.action_plan)
        record.status = data.get('status', record.status)
        record.follow_up_date = data.get('follow_up_date', record.follow_up_date)
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    

@app.route('/api/enlistment', methods=['GET'])
@login_required
def get_enlistment(): return jsonify([])

@app.route('/api/schedules', methods=['GET'])
@login_required
def get_all_schedules():
    """Fetches schedules filtered by the requested academic term."""
    # Default to 2nd Sem if the frontend doesn't specify
    term = request.args.get('term', 'AY2025-2026-Sem2') 
    
    # ONLY grab events for this specific term
    events = ScheduleEvent.query.filter_by(academic_term=term).all()
    output = []
    
    for ev in events:
        start_str = ev.start_time
        end_str = ev.end_time
        if hasattr(start_str, 'isoformat'): start_str = start_str.isoformat()
        if hasattr(end_str, 'isoformat'): end_str = end_str.isoformat()

        output.append({
            'id': ev.id,
            'title': ev.title,
            'start': start_str,
            'end': end_str,
            'backgroundColor': getattr(ev, 'color', '#3b82f6'),
            'borderColor': getattr(ev, 'color', '#3b82f6'),
            'extendedProps': {
                'code': getattr(ev, 'subject_code', ''),
                'sectionCode': getattr(ev, 'section_code', ''),
                'faculty': getattr(ev, 'faculty_name', 'TBA'),
                'room': getattr(ev, 'room', 'TBA'),
                'type': getattr(ev, 'type', 'lecture'),
                'year': getattr(ev, 'year_level', '1')
            }
        })
    return jsonify(output)

@app.route('/api/schedules/bulk', methods=['POST'])
@login_required
def save_bulk_schedules():
    """Saves classes to the DB without wiping historical data from older terms."""
    payload = request.get_json()
    if not payload:
        return jsonify({'success': False, 'message': 'No data provided'}), 400
        
    # We now expect a dictionary containing both the 'term' and the 'events'
    term = payload.get('term', 'AY2025-2026-Sem2')
    data = payload.get('events', [])
        
    try:
        # THE MAGIC: Delete ONLY the old imported schedules for THIS specific term. 
        # Last semester's schedule is completely safe!
        ScheduleEvent.query.filter_by(academic_term=term).delete() 
        
        for item in data:
            # --- THE FIX: Safely extract extendedProps to prevent KeyErrors ---
            props = item.get('extendedProps', {})
            
            event = ScheduleEvent(
                title=item.get('title', 'Unknown'),
                subject_code=props.get('code', ''),
                section_code=props.get('sectionCode', ''),
                faculty_name=props.get('faculty', 'TBA'),
                room=props.get('room', 'TBA'),
                type=props.get('type', 'lecture'),
                year_level=str(props.get('year', '1')),
                start_time=item.get('start'),
                end_time=item.get('end'),
                color=item.get('backgroundColor', '#3b82f6'),
                academic_term=term # <--- Link the class to the term
            )
            db.session.add(event)
            
        db.session.commit()
        return jsonify({'success': True, 'count': len(data)})
    except Exception as e:
        db.session.rollback()
        print(f"Bulk Import Error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

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
    
# --- NEW: Fetch Sections for the Dropdown ---
@app.route('/api/faculty/sections', methods=['GET'])
@login_required
def get_faculty_sections():
    try:
        user_email = session.get('user')
        user = User.query.filter_by(email=user_email).first()
        if not user: return jsonify([])

        # Program Heads see all sections, Faculty see only their own
        if session.get('role') == 'head':
            sections = Section.query.all()
        else:
            sections = Section.query.filter_by(faculty_id=user.id).all()

        output = []
        for sec in sections:
            subject = db.session.get(Subject, sec.subject_code)
            
            # Figure out the instructor name securely
            instructor_name = "TBA"
            if sec.instructor:
                instructor_name = sec.instructor.name
            elif session.get('role') == 'faculty':
                instructor_name = user.name

            output.append({
                'id': sec.id,
                'name': sec.name,
                'subject_code': sec.subject_code,
                'subject_title': subject.description if subject else 'Unknown Subject',
                'faculty_name': instructor_name
            })
        return jsonify(output)
    except Exception as e:
        print(f"Error fetching sections: {e}")
        return jsonify([])

# --- NEW: Fetch Enrolled Students for a specific Section ---
@app.route('/api/faculty/class-records/sections/<int:section_id>/students', methods=['GET'])
@login_required
def get_section_students(section_id):
    try:
        # Get enrollments for this specific section ID
        enrollments = Enrollment.query.filter_by(section_id=section_id).all()
        student_list = []
        
        for e in enrollments:
            s = db.session.get(Student, e.student_id)
            if s and s.status not in ['Dropped', 'Transferred']:
                student_list.append({
                    'id': s.id,
                    'name': s.name,
                    'program': s.program,
                    'year_level': s.year_level,
                    'email': s.email
                })
        return jsonify(student_list)
    except Exception as e:
        print(f"Error fetching section students: {e}")
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

  # # 5. Determine Regular/Irregular Status Dynamically
    failed_records = Enrollment.query.filter_by(student_id=student_id)\
        .filter((Enrollment.grade > 3.0) | (Enrollment.status == 'Failed')).all()
    
    academic_status = 'Irregular' if len(failed_records) > 0 else 'Regular'

    # --- NEW: Fetch Advising History for this Student ---
    advising_records = AdvisingRecord.query.filter_by(student_id=student_id).order_by(AdvisingRecord.id.desc()).all()
    advising_list = []
    for r in advising_records:
        advising_list.append({
            'id': r.id,
            'date': r.date,
            'category': r.category or 'Uncategorized',
            'status': r.status or 'Open',
            'notes': r.notes,
            'action_plan': r.action_plan or 'None specified',
            'follow_up_date': r.follow_up_date or 'None'
        })

    # Final JSON Structure
    return jsonify({
        'student_info': {
            'id': student.id,
            'name': student.name,
            'program': student.program,
            'year_level': student.year_level,
            'status': academic_status,
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
        'grades': grades_data,
        'advising_records': advising_list  # <--- NEW: Send it to the frontend
    })
    
    
    # ==================== ENROLLMENT & ENLISTMENT WORKFLOW ====================

@app.route('/api/enrollment/pending', methods=['GET'])
@login_required
def get_pending_enrollment():
    """Evaluates students waiting for enrollment confirmation based on robust standards."""
    students = Student.query.filter_by(status='Pending').all()
    
    output = []
    for s in students:
        # Get all recent/active enrollments to calculate total units
        recent_enrollments = Enrollment.query.filter_by(student_id=s.id).all()
        
        total_units_taken = 0
        failed_units = 0
        failed_subjects = []
        has_major_failure = False
        
        for enroll in recent_enrollments:
            if enroll.status in ['Pending', 'Enrolled', 'Enlisting']:
                continue
            
            section = db.session.get(Section, enroll.section_id)
            if not section: continue
            
            subject = db.session.get(Subject, section.subject_code)
            if not subject: continue
            
            total_units_taken += subject.units
            
            # Check if this subject is failed
            if (enroll.grade and enroll.grade > 3.0) or (enroll.status == 'Failed'):
                failed_units += subject.units
                failed_subjects.append(subject.code)
                
                # Flag if it's a bottleneck Major
                if subject.category == 'Major':
                    has_major_failure = True

        # --- THE NEW RETENTION & PROMOTION ALGORITHM ---
        
        # --- THE STRICT ENGINEERING RETENTION ALGORITHM ---
        
        # Determine Academic Status
        academic_status = 'Irregular' if len(failed_subjects) > 0 else 'Regular'
        
        # Determine Promotion Decision
        decision = 'Promoted'
        is_retained = False
        
        if total_units_taken > 0:
            failure_ratio = failed_units / total_units_taken
            
            # 1. Automatic Retention: Failed more than 50% of units
            if failure_ratio > 0.50:
                decision = 'Retained (Academic Probation)'
                is_retained = True
            
            # 2. STRICT RULE: Failed ANY Major Subject (Prerequisite Bottleneck)
            elif has_major_failure:
                decision = 'Retained (Major Deficiency)'
                is_retained = True 
                
            # 3. Standard Promotion: Failed only Minors/GenEds
            elif len(failed_subjects) > 0:
                decision = 'Promoted (Retake Minors)'
                is_retained = False
        
        output.append({
            'id': s.id,
            'name': s.name,
            'program': s.program,
            'year_level': s.year_level,
            'status': s.status,
            'type': academic_status,
            'decision': decision,
            'hasWarnings': is_retained or len(failed_subjects) > 0,
            'email': s.email or 'No email provided',
            'contact': s.contact_number or 'No contact provided',
            'failed_subjects': failed_subjects
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

        # Re-evaluate retention logic based on the strict rule
        all_enrollments = Enrollment.query.filter_by(student_id=student.id).all()
        total_units = 0
        failed_units = 0
        has_major_failure = False
        
        for enroll in all_enrollments:
            # --- THE MATH BUG FIX: Skip unfinished subjects ---
            if enroll.status in ['Pending', 'Enrolled', 'Enlisting']:
                continue
                
            if enroll.section and enroll.section.subject:
                sub = enroll.section.subject
                total_units += sub.units
                if (enroll.grade and enroll.grade > 3.0) or (enroll.status == 'Failed'):
                    failed_units += sub.units
                    # Flag if it is a major prerequisite bottleneck
                    if sub.category == 'Major':
                        has_major_failure = True
                    
        # --- THE STRICT ENGINEERING RULE ---
        # Check if they failed > 50% OR failed ANY Major subject
        ratio_failed = (failed_units / total_units > 0.50) if total_units > 0 else False
        is_retained = ratio_failed or has_major_failure
        
        # Advance them to Enlisting
        student.status = 'Enlisting'

        # Bump Year Level only if they are Promoted (not retained)
        if not is_retained:
            if student.year_level == '1st Year': student.year_level = '2nd Year'
            elif student.year_level == '2nd Year': student.year_level = '3rd Year'
            elif student.year_level == '3rd Year': student.year_level = '4th Year'
            
        success_count += 1
        
    db.session.commit()
    
    return jsonify({'success': True, 'count': success_count})
    
    
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
        # --- THE STRICT ENGINEERING RULE FOR SINGLE ENROLLMENT ---
        all_enrollments = Enrollment.query.filter_by(student_id=student.id).all()
        total_units = 0
        failed_units = 0
        has_major_failure = False
        
        for enroll in all_enrollments:
            if enroll.status in ['Pending', 'Enrolled', 'Enlisting']:
                continue
                
            if enroll.section and enroll.section.subject:
                sub = enroll.section.subject
                total_units += sub.units
                if (enroll.grade and enroll.grade > 3.0) or (enroll.status == 'Failed'):
                    failed_units += sub.units
                    if sub.category == 'Major':
                        has_major_failure = True
                        
        ratio_failed = (failed_units / total_units > 0.50) if total_units > 0 else False
        is_retained = ratio_failed or has_major_failure
        
        # Update status to move them to the next step
        student.status = 'Enlisting'

        # Bump Year Level if promoted
        if not is_retained:
            # Note: You have this commented out for 2nd Sem, which is perfectly fine!
            pass
            # if student.year_level == '1st Year': student.year_level = '2nd Year'
            # elif student.year_level == '2nd Year': student.year_level = '3rd Year'
            # elif student.year_level == '3rd Year': student.year_level = '4th Year'
            
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
    students = Student.query.filter_by(status='Enlisting').all()
    
    # Define the standard progression order to find their exact next semester
    term_order = [
        ("1st Year", "1st Semester"),
        ("1st Year", "2nd Semester"),
        ("2nd Year", "1st Semester"),
        ("2nd Year", "2nd Semester"),
        ("3rd Year", "1st Semester"),
        ("3rd Year", "2nd Semester"),
        ("4th Year", "1st Semester"),
        ("4th Year", "2nd Semester")
    ]
    
    output = []
    for s in students:
        # --- CALCULATE DYNAMIC MAX UNITS BASED ON TARGET SEMESTER ---
        enrollments = Enrollment.query.filter_by(student_id=s.id).all()
        latest_index = -1
        
        for enroll in enrollments:
            section = db.session.get(Section, enroll.section_id)
            if section:
                subject = db.session.get(Subject, section.subject_code)
                if subject:
                    term_tuple = (subject.year_level, subject.semester)
                    if term_tuple in term_order:
                        idx = term_order.index(term_tuple)
                        if idx > latest_index:
                            latest_index = idx

        # Calculate the target (next) semester
        if latest_index == -1:
            target_year = "1st Year"
            target_sem = "1st Semester"
        elif latest_index < len(term_order) - 1:
            target_year = term_order[latest_index + 1][0]
            target_sem = term_order[latest_index + 1][1]
        else:
            target_year = term_order[-1][0]
            target_sem = term_order[-1][1]
            
        # Fetch ONLY the regular subjects prescribed for this specific target term
        regular_subjects = Subject.query.filter_by(
            year_level=target_year, 
            semester=target_sem
        ).all()
        
        # Calculate the exact unit limit for this semester
        dynamic_max_units = sum(sub.units for sub in regular_subjects)
        
        # Fallback just in case the query returns 0 (e.g., incomplete curriculum data)
        if dynamic_max_units == 0:
            dynamic_max_units = 23
        # ------------------------------------------------------------

        output.append({
            'id': s.id,
            'name': s.name,
            'program': s.program,
            'year_level': s.year_level, 
            'status': 'Regular',         
            'units': 0,
            'maxUnits': dynamic_max_units,  # <--- INJECT DYNAMIC UNIT CAP
            'retained': False
        })
        
    return jsonify(output)
@app.route('/api/send-otp', methods=['POST'])
def send_otp():
    data = request.get_json()
    email_addr = data.get('email')
    
    if not email_addr:
        return jsonify({'success': False, 'message': 'Email is required'}), 400

    # 1. Generate a 6-digit random OTP
    otp = str(random.randint(100000, 999999))
    
    # 2. Store OTP and the associated email in the session
    session['reg_otp'] = otp
    session['reg_email'] = email_addr.lower()

    # 3. Setup Email Sender (Uses environment variables from your .env)
    SMTP_SERVER = "smtp.gmail.com"
    SMTP_PORT = 587
    SENDER_EMAIL = os.environ.get("MAIL_USERNAME")
    SENDER_PASSWORD = os.environ.get("MAIL_PASSWORD")

    if not SENDER_EMAIL or not SENDER_PASSWORD:
        return jsonify({'success': False, 'message': 'System email is not configured.'}), 500

    try:
        msg = MIMEMultipart()
        msg['From'] = f"AERIS System <{SENDER_EMAIL}>"
        msg['To'] = email_addr
        msg['Subject'] = "AERIS Account Creation - OTP Verification"
        
        # HTML Email Template
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #7a001e; margin: 0; letter-spacing: 2px;">A E R I S</h2>
                    <p style="font-size: 12px; color: #666; margin: 5px 0 0 0; text-transform: uppercase;">College of Engineering and Architecture</p>
                </div>
                
                <p>Hello,</p>
                
                <p>You recently requested to create an account on the AERIS portal. Please use the following One-Time Password (OTP) to complete your registration:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <span style="display: inline-block; font-size: 32px; font-weight: bold; color: #7a001e; letter-spacing: 5px; padding: 15px 30px; background-color: #f5f5f5; border-radius: 8px; border: 1px dashed #7a001e;">
                        {otp}
                    </span>
                </div>
                
                <p style="font-size: 14px; color: #555;"><strong>Note:</strong> This code is valid for a limited time. Please do not share this code with anyone. If you did not request this, you can safely ignore this email.</p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                
                <p style="font-size: 12px; color: #999; text-align: center;">
                    This is an automated message from the Academic Evaluation, Records & Information Systems. Please do not reply to this email.
                </p>
            </body>
        </html>
        """
        
        # Attach as HTML instead of plain text
        msg.attach(MIMEText(html_body, 'html'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        return jsonify({'success': True, 'message': 'OTP sent successfully!'})
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        return jsonify({'success': True, 'message': 'OTP sent successfully!'})
    except Exception as e:
        print(f"Error sending OTP: {e}")
        return jsonify({'success': False, 'message': 'Failed to send OTP. Please try again.'}), 500

@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    """Checks the OTP in the background before allowing the form to submit."""
    data = request.get_json()
    email = data.get('email', '').lower()
    otp_input = data.get('otp', '')
    
    stored_otp = session.get('reg_otp')
    stored_email = session.get('reg_email')
    
    if not stored_otp or stored_otp != otp_input or stored_email != email:
        return jsonify({'success': False, 'message': 'Incorrect OTP. Please try again.'})
        
    return jsonify({'success': True})

@app.route('/register', methods=['POST'])
def register():
    # Get data from the form
    name = request.form.get('name')
    email = request.form.get('email')
    role = request.form.get('role')
    department = request.form.get('department')
    password = request.form.get('password')
    otp_input = request.form.get('otp') # <--- Get the OTP input

    if email:
        email = email.lower()

    # --- NEW: Verify OTP ---
    stored_otp = session.get('reg_otp')
    stored_email = session.get('reg_email')

    if not stored_otp or stored_otp != otp_input or stored_email != email:
        return render_template('index.html', error="Invalid or expired OTP. Please try again.")
    # -----------------------

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

        # --- NEW: Clear OTP from session after successful registration ---
        session.pop('reg_otp', None)
        session.pop('reg_email', None)

        # Automatically log them in after registration
        session['user'] = email
        session['role'] = role
        
        if role == 'head':
            return redirect(url_for('program_head_dashboard'))
        else:
            return redirect(url_for('faculty_dashboard'))

    except Exception as e:
        db.session.rollback()
        print(f"\n❌ REGISTRATION ERROR: {str(e)}\n") 
        return render_template('index.html', error=f"Registration failed: {str(e)}")

# ==================== ENLISTMENT API (REAL CURRICULUM) ====================
@app.route('/api/enlistment/subjects/<string:student_id>', methods=['GET'])
@login_required
def get_student_available_subjects(student_id):
    student = Student.query.get(student_id)
    if not student: return jsonify([])

    # --- NEW LOGIC: DETECT NEXT SEMESTER BASED ON STUDENT JOURNEY ---
    # Define the standard progression order
    term_order = [
        ("1st Year", "1st Semester"),
        ("1st Year", "2nd Semester"),
        ("2nd Year", "1st Semester"),
        ("2nd Year", "2nd Semester"),
        ("3rd Year", "1st Semester"),
        ("3rd Year", "2nd Semester"),
        ("4th Year", "1st Semester"),
        ("4th Year", "2nd Semester")
    ]

    # Fetch all previous enrollments to find their current standing
    enrollments = Enrollment.query.filter_by(student_id=student_id).all()
    latest_index = -1

    for enroll in enrollments:
        section = db.session.get(Section, enroll.section_id)
        if section:
            subject = db.session.get(Subject, section.subject_code)
            if subject:
                term_tuple = (subject.year_level, subject.semester)
                if term_tuple in term_order:
                    idx = term_order.index(term_tuple)
                    if idx > latest_index:
                        latest_index = idx

    # Calculate the target (next) semester
    if latest_index == -1:
        target_year = "1st Year"
        target_sem = "1st Semester"
    elif latest_index < len(term_order) - 1:
        target_year = term_order[latest_index + 1][0]
        target_sem = term_order[latest_index + 1][1]
    else:
        # If they are already at the end of the progression
        target_year = term_order[-1][0]
        target_sem = term_order[-1][1]

    print(f"DEBUG: Enlistment for {student.name}. Detected target term: {target_year} - {target_sem}")
    # ----------------------------------------------------------------

    # 1. Fetch Failed Subjects for Retakes
    failed_records = Enrollment.query.filter_by(student_id=student_id)\
        .filter((Enrollment.grade > 3.0) | (Enrollment.status == 'Failed')).all()
    
    failed_codes = [f.section.subject_code for f in failed_records if f.section]

    # 2. Fetch Regular Subjects based on dynamically detected Year and Semester
    regular_subjects = Subject.query.filter_by(
        year_level=target_year, 
        semester=target_sem
    ).all()

    # 3. Fetch Back Subjects (Retakes)
    back_subjects = []
    if failed_codes:
        # We fetch all failed subjects regardless of semester so they can be shown as options
        back_subjects = Subject.query.filter(
            Subject.code.in_(failed_codes)
        ).all()

    # Combine lists (Use a dictionary comp to remove duplicates based on code)
    combined = regular_subjects + back_subjects
    unique_subjects = {s.code: s for s in combined}.values()
    all_subjects = list(unique_subjects)
    
    output = []
    for sub in all_subjects:
        # --- NEW: Fetch Sections from the Scheduling System (ScheduleEvent) ---
        all_events = ScheduleEvent.query.all()
        events = []
        
        for ev in all_events:
            ev_string = str(ev.subject_code or "") + " " + str(ev.title or "")
            if ev_string and sub.code:
                clean_ev_string = ev_string.replace(" ", "").lower()
                clean_sub_code = sub.code.replace(" ", "").lower()
                
                if clean_sub_code in clean_ev_string:
                    events.append(ev)
                    
        unique_sections = {}
        
        for ev in events:
            sec_val = ev.section_code if ev.section_code else "A" 
            
            start_str = str(ev.start_time or "")
            end_str = str(ev.end_time or "")
            day_name = ""
            time_span = ""
            
            if "T" in start_str:
                try:
                    clean_start = start_str.split('+')[0].split('Z')[0].split('.')[0]
                    clean_end = end_str.split('+')[0].split('Z')[0].split('.')[0]
                    
                    dt_start = datetime.strptime(clean_start, "%Y-%m-%dT%H:%M:%S")
                    dt_end = datetime.strptime(clean_end, "%Y-%m-%dT%H:%M:%S")
                    
                    day_name = dt_start.strftime("%a").upper() 
                    time_span = f"{dt_start.strftime('%I:%M%p')}-{dt_end.strftime('%I:%M%p')}"
                except Exception as e:
                    time_span = "TBA"
            else:
                if "-" in start_str and any(d in end_str.upper() for d in ['MON','TUE','WED','THU','FRI','SAT']):
                    time_span = start_str
                    day_name = end_str.upper()
                else:
                    time_span = f"{start_str}-{end_str}"
            
            if sec_val not in unique_sections:
                unique_sections[sec_val] = {
                    'id': sec_val, 
                    'name': sec_val,
                    'faculty': ev.faculty_name or "TBA",
                    'room': ev.room or "TBA",
                    'days': day_name,
                    'time': time_span
                }
            else:
                if day_name and day_name not in unique_sections[sec_val].get('days', ''):
                    if unique_sections[sec_val].get('days'):
                        unique_sections[sec_val]['days'] += f" / {day_name}"
                    else:
                        unique_sections[sec_val]['days'] = day_name
                
        section_list = list(unique_sections.values())
        
        if not section_list:
            section_list.append({
                'id': 'Unscheduled',
                'name': 'Not Yet Scheduled',
                'faculty': 'No Instructor Assigned',
                'room': 'No Room'
            })

        # --- NEW: Check if actually offered (No events = Not Offered) ---
        is_offered = len(events) > 0

        # --- CRITICAL LOGIC: CHECK PREREQUISITES & AVAILABILITY ---
        is_locked = False
        warning_msg = None
        
        # 1. Lock if Prerequisite is failed
        if sub.prerequisite and sub.prerequisite not in ['None', '', 'nan']:
            if sub.prerequisite in failed_codes:
                is_locked = True
                warning_msg = f"Prereq {sub.prerequisite} Failed"

        is_retake = sub.code in failed_codes
        
        # 2. Lock if it's a Retake but NOT offered this term (e.g., Summer only)
        if is_retake and not is_offered:
            is_locked = True
            warning_msg = "Not Offered This Term"

        # --- NEW: Check exact database category instead of guessing by units ---
        if is_retake:
            type_tag = 'critical'
        else:
            # Safely check if the category explicitly says 'Major'
            is_major = getattr(sub, 'category', '') == 'Major'
            type_tag = 'major' if is_major else 'minor'

        # --- NEW: Calculate Priority Score ---
        if is_retake:
            # Check if this failed subject is blocking future subjects
            is_blocking_others = Subject.query.filter_by(prerequisite=sub.code).first() is not None
            priority_score = 1 if is_blocking_others else 2
        else:
            # Uses the newly corrected type_tag!
            priority_score = 3 if type_tag == 'major' else 4

        output.append({
            'code': sub.code,
            'name': sub.description,
            'units': sub.units,
            'type': type_tag,
            'sections': section_list,
            'locked': is_locked,   
            'warning': warning_msg,
            'priority': priority_score # Send priority to frontend
        })
    
    # Sort output: Unlocked subjects first, then order by Priority (1 -> 4)
    output.sort(key=lambda x: (x['locked'], x['priority']))
    
    return jsonify(output)


@app.route('/api/enlistment/submit', methods=['POST'])
@login_required
def submit_student_enlistment():
    data = request.get_json()
    student_id = data.get('student_id')
    subjects_data = data.get('subjects') # [{'code': 'CPE 101', 'section_id': 'A'}, ...]
    
    student = Student.query.get(student_id)
    if not student:
        return jsonify({'success': False, 'message': 'Student not found'}), 404

    try:
        # 1. Update Student Status
        student.status = 'Enrolled' 
        
        # --- NEW: DYNAMICALLY UPDATE YEAR LEVEL ---
        # Scan the subjects they just enlisted in to find their new year level.
        # We use weights to ensure we only promote them (never demote if they take lower-year retakes).
        year_weights = {"1st Year": 1, "2nd Year": 2, "3rd Year": 3, "4th Year": 4, "5th Year": 5}
        new_year_level = student.year_level
        
        for item in subjects_data:
            code = item.get('code')
            subject = db.session.get(Subject, code) 
            
            if subject and subject.year_level in year_weights:
                if year_weights[subject.year_level] > year_weights.get(new_year_level, 0):
                    new_year_level = subject.year_level
                    
        # Apply the new year level
        student.year_level = new_year_level
        print(f"DEBUG: Promoted {student.name} to {new_year_level} upon enlistment.")
        # ------------------------------------------
        
        # 2. Process each subject
        for item in subjects_data:
            code = item.get('code')
            section_code = item.get('section_id') # E.g., 'A', 'B'
            
            # Check if this exact section already exists in the Section table
            section = Section.query.filter_by(subject_code=code, name=section_code).first()
            
            if not section:
                # --- ULTRA SAFE MATCHING V2: Fetch real scheduling data ---
                all_scheduled = ScheduleEvent.query.all()
                schedule_events = []
                
                for ev in all_scheduled:
                    ev_string = str(ev.subject_code or "") + " " + str(ev.title or "")
                    
                    if ev_string and code:
                        clean_ev_string = ev_string.replace(" ", "").lower()
                        clean_code = code.replace(" ", "").lower()
                        
                        clean_ev_sec = str(ev.section_code or "A").replace(" ", "").lower()
                        clean_sec = str(section_code or "A").replace(" ", "").lower()
                        
                        if (clean_code in clean_ev_string) and (clean_sec == clean_ev_sec):
                            schedule_events.append(ev)
                
                room_val = "TBA"
                schedule_val = "TBA"
                faculty_id_val = None
                
                if schedule_events:
                    # Use the first schedule block for base info
                    primary_event = schedule_events[0]
                    room_val = primary_event.room or "TBA"
                    
                    # Extract time from FullCalendar ISO format (e.g., "2024-01-01T10:00:00" -> "10:00")
                    def get_time(ts):
                        return ts.split('T')[1][:5] if 'T' in ts else ts
                    
                    start = get_time(primary_event.start_time)
                    end = get_time(primary_event.end_time)
                    schedule_val = f"{start} - {end}"
                    
                    # Try to link the actual Faculty User account by name
                    if primary_event.faculty_name:
                        faculty_user = User.query.filter(User.name.ilike(f"%{primary_event.faculty_name}%")).first()
                        if faculty_user:
                            faculty_id_val = faculty_user.id
                
                # Sync it to the Section table using the REAL schedule data
                section = Section(
                    name=section_code or "Unscheduled", 
                    subject_code=code, 
                    room=room_val, 
                    schedule=schedule_val,
                    faculty_id=faculty_id_val
                )
                db.session.add(section)
                db.session.commit() # Commit needed to generate section.id
            
            if section:
                # Check if already enrolled to avoid duplicates
                exists = Enrollment.query.filter_by(student_id=student_id, section_id=section.id).first()
                if not exists:
                    enrollment = Enrollment(
                        student_id=student_id,
                        section_id=section.id,
                        grade=None,
                        status='Enrolled'
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
    
    
@app.route('/api/advising/generate-plan/<string:student_id>', methods=['POST'])
@login_required
def generate_action_plan(student_id):
    # 1. Get the current context the advisor typed in so far
    data = request.get_json()
    category = data.get('category', 'Uncategorized Issue')
    notes = data.get('notes', 'No specific notes provided.')

    # 2. Fetch Student Data
    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    # 3. Gather Academic History (Failures & Risk Level)
    failed_records = Enrollment.query.filter_by(student_id=student_id)\
        .filter((Enrollment.grade > 3.0) | (Enrollment.status == 'Failed')).all()
    
    fail_count = len(failed_records)
    risk_level = "Regular/Low Risk"
    failed_subjects = []
    
    if fail_count > 0:
        major_fail_count = 0
        failed_major_is_prereq = False
        
        for f in failed_records:
            if not f.section: continue
            sub = db.session.get(Subject, f.section.subject_code)
            if not sub: continue
            
            failed_subjects.append(sub.code)
            is_major = getattr(sub, 'category', '') == 'Major' or sub.units >= 3
            if is_major:
                major_fail_count += 1
                if Subject.query.filter_by(prerequisite=sub.code).first() is not None:
                    failed_major_is_prereq = True
                    
        # Apply the exact same logic for the AI Context
        if failed_major_is_prereq or major_fail_count >= 2 or fail_count >= 3:
            risk_level = "Critical Risk"
        else:
            risk_level = "High Risk"
            
    failed_str = ", ".join(failed_subjects) if failed_subjects else "None"

    # 4. Construct the Prompt
    prompt = f"""
    You are an empathetic and professional academic advisor for a university engineering department. 
    A student needs an action plan based on the following context:
    
    - Program: {student.program}
    - Year Level: {student.year_level}
    - Academic Risk Level: {risk_level}
    - Failed Subjects: {failed_str}
    - Current Issue Category: {category}
    - Advisor's Observation Notes: {notes}

    Generate a brief, empathetic, 3-step actionable recovery plan for this student. 
    Make the steps concrete and achievable. Do not include any introductory or concluding text.
    Format the response exactly like this:
    𝟏: [Actionable advice]
    
    𝟐: [Actionable advice]
    
    𝟑: [Actionable advice]
    """

    try:
        # 5. Call the Groq API
        # Using LLaMA 3 8B - it is completely free and insanely fast
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful academic advisor. Output only the requested 3-step action plan without intro or outro text."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model="llama-3.3-70b-versatile", 
            temperature=0.7,
            max_tokens=250
        )
        
        # Extract the text from the Groq response
        action_plan_text = chat_completion.choices[0].message.content.strip()
        
        return jsonify({
            'success': True, 
            'action_plan': action_plan_text
        })
    except Exception as e:
        print(f"AI Generation Error (Groq): {e}")
        return jsonify({'success': False, 'message': f"System Error: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=app.config['DEBUG'], host='0.0.0.0', port=5001)