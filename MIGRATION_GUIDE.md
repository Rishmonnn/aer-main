# AERIS: PHP to Flask Migration Guide

## Overview
This document outlines the conversion of the AERIS system from PHP to Flask (Python). The frontend UI and JavaScript remain the same, while the backend is now powered by Flask instead of PHP.

## Key Changes

### 1. **File Structure**

**PHP Structure:**
```
includes/
  header.php
  footer.php
  faculty/
    home.php
    grading.php
    classes.php
    inc.php
api/
  faculty_grading.php
  faculty_classes.php
  etc.
```

**Flask Structure:**
```
templates/
  base.html (replaces header.php + footer.php)
  faculty.html
  includes/
    faculty/
      home.html
      grading.html
      classes.html
      inc.html
app.py (main Flask application)
```

### 2. **Server-Side Logic Changes**

#### PHP (Old):
```php
<?php
$pageTitle = 'Faculty Dashboard';
$pageStyles = ['css/dashboard.css','css/faculty.css'];
$pageScripts = ['js/faculty.js','js/faculty-grading.js'];
include 'includes/header.php';
?>
```

#### Flask (New):
```python
@app.route('/faculty')
@login_required
def faculty_dashboard():
    context = {
        'pageTitle': 'Faculty Dashboard',
        'pageStyles': ['dashboard.css', 'faculty.css'],
        'pageScripts': ['faculty.js', 'faculty-grading.js'],
        'user_name': session.get('user', 'Faculty'),
        'stats': FACULTY_DATA
    }
    return render_template('faculty.html', **context)
```

### 3. **Template Syntax Changes**

#### PHP Variables:
```php
<?php echo htmlspecialchars($pageTitle); ?>
<?php foreach($pageStyles as $href): ?>
    <link rel="stylesheet" href="<?php echo htmlspecialchars($href); ?>">
<?php endforeach; ?>
```

#### Jinja2 (Flask) Templates:
```jinja2
{{ pageTitle|default('Aeris') }}
{% for style in pageStyles %}
    <link rel="stylesheet" href="{{ url_for('static', filename=style) }}">
{% endfor %}
```

### 4. **Session/Authentication**

#### PHP (Old):
```php
session_start();
$_SESSION['user'] = $username;
```

#### Flask (New):
```python
from flask import session

session['user'] = username
# Sessions are automatically handled by Flask
```

### 5. **API Endpoints**

#### PHP (Old):
```
/api/faculty_grading.php?action=load&class_id=1
```

#### Flask (New):
```
/api/faculty/grading/1
```

## Migration Checklist

- [x] Convert PHP files to Flask routes
- [x] Convert PHP includes to Jinja2 template inheritance
- [x] Set up session management
- [x] Create RESTful API endpoints
- [x] Update HTML template syntax
- [x] Move static files to `static/` folder
- [x] Create configuration management
- [ ] Integrate real database
- [ ] Implement proper authentication (LDAP, OAuth, etc.)
- [ ] Add form validation
- [ ] Set up logging
- [ ] Add unit tests
- [ ] Configure production deployment

## Running the Application

### Option 1: Using Batch File (Windows)
```bash
run.bat
```

### Option 2: Using Shell Script (Linux/Mac)
```bash
bash run.sh
```

### Option 3: Manual Setup
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run application
python app.py
```

## Database Integration Example

To integrate with a database, install Flask-SQLAlchemy:

```bash
pip install flask-sqlalchemy
```

Then update `app.py`:

```python
from flask_sqlalchemy import SQLAlchemy

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///aeris.db'
db = SQLAlchemy(app)

# Define models
class Faculty(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)

# Replace mock data with database queries
@app.route('/api/faculty/classes', methods=['GET'])
@login_required
def get_faculty_classes():
    classes = ClassRecord.query.filter_by(faculty_id=current_user_id).all()
    return jsonify([c.to_dict() for c in classes])
```

## Frontend Changes

**No frontend changes required!** The JavaScript, CSS, and HTML structure remain the same. The API responses are compatible with the existing JavaScript code.

## Common Issues & Solutions

### Issue: "ModuleNotFoundError: No module named 'flask'"
**Solution:** Install Flask: `pip install -r requirements.txt`

### Issue: Session data not persisting
**Solution:** Ensure `app.secret_key` is set in `app.py`

### Issue: Static files not loading (404 errors)
**Solution:** Ensure files are in the `static/` folder and use `url_for()` in templates

### Issue: Routes not matching
**Solution:** Check that route paths match API calls in JavaScript

## Security Improvements vs PHP

1. **CSRF Protection:** Add Flask-WTF for form protection
2. **Input Validation:** Use stricter validation in routes
3. **SQL Injection:** Use parameterized queries with SQLAlchemy
4. **Template Escaping:** Jinja2 auto-escapes variables by default
5. **Password Security:** Use werkzeug.security for hashing

## Performance Tips

1. Enable caching: `pip install flask-caching`
2. Use database indexes on frequently queried columns
3. Implement pagination for large result sets
4. Cache API responses where appropriate
5. Use production WSGI server (Gunicorn) instead of Flask dev server

## Deployment

### Using Gunicorn (Recommended)
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Using Docker
```dockerfile
FROM python:3.9
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

## Support & References

- Flask Documentation: https://flask.palletsprojects.com/
- Jinja2 Documentation: https://jinja.palletsprojects.com/
- SQLAlchemy Documentation: https://www.sqlalchemy.org/
- Python Official Documentation: https://docs.python.org/3/
