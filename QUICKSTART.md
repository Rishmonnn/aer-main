# AERIS Flask Conversion - Quick Start Guide

## What Has Been Converted?

Your AERIS system has been successfully converted from PHP to Flask (Python). Here's what was done:

### ✅ Converted:
- **PHP Files** → **Flask Routes** in `app.py`
- **PHP Includes** → **Jinja2 Templates** with inheritance
- **header.php & footer.php** → **base.html**
- **Session Management** → **Flask Session Handling**
- **API Endpoints** → **RESTful Flask Routes**
- **Configuration** → **config.py** with environment support

### ✅ Preserved:
- **All Frontend Code** (HTML, CSS, JavaScript) - completely unchanged
- **UI/UX Design** - exactly the same
- **API Response Format** - compatible with existing JavaScript
- **Database Logic** - ready to be integrated

---

## Quick Start (3 Steps)

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Run the Application
**Windows:**
```bash
run.bat
```

**Mac/Linux:**
```bash
bash run.sh
```

**Or manually:**
```bash
python app.py
```

### Step 3: Open in Browser
```
http://127.0.0.1:5000
```

---

## Login Testing Credentials

The application uses mock authentication for testing:

| Role | Email | Password | Role Selection |
|------|-------|----------|---|
| Faculty | `faculty@example.com` | Any | AS FACULTY |
| Program Head | `head@example.com` | Any | AS HEAD |

---

## Files Overview

| File | Purpose |
|------|---------|
| `app.py` | Main Flask application with routes |
| `config.py` | Configuration management |
| `requirements.txt` | Python dependencies |
| `test_app.py` | Application test script |
| `run.bat` | Windows launcher script |
| `run.sh` | Linux/Mac launcher script |
| `templates/` | HTML templates with Jinja2 |
| `static/` | CSS, JavaScript, Images |

---

## Key Differences from PHP

### Before (PHP):
```php
<?php
$pageTitle = 'Faculty Dashboard';
include 'includes/header.php';
?>
<div>...</div>
<?php include 'includes/footer.php'; ?>
```

### After (Flask):
```python
@app.route('/faculty')
def faculty_dashboard():
    return render_template('faculty.html', pageTitle='Faculty Dashboard')
```

---

## API Endpoints Available

### Faculty Routes
```
GET  /api/faculty/classes              - Get faculty classes
GET  /api/faculty/grading/<class_id>   - Get grading records
GET  /api/faculty/inc                  - Get INC requests
POST /api/faculty/inc/<id>/approve     - Approve INC
POST /api/faculty/inc/<id>/deny        - Deny INC
POST /api/faculty/grades/<class>/<student> - Update grade
```

---

## Common Tasks

### Add a New Route
```python
@app.route('/page-name')
@login_required
def page_name():
    return render_template('page-name.html')
```

### Add a New Template
Create file in `templates/page-name.html`:
```jinja2
{% extends 'base.html' %}
{% block content %}
  <!-- Your content here -->
{% endblock %}
```

### Update Style or Script
Files are served from `static/` directory:
```
static/css/style.css
static/js/main.js
static/assets/logo.png
```

### Connect to a Database
```bash
pip install flask-sqlalchemy
```

Then in `app.py`:
```python
from flask_sqlalchemy import SQLAlchemy
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///aeris.db'
db = SQLAlchemy(app)
```

---

## Troubleshooting

### Problem: "Port 5000 already in use"
```python
# In app.py, change the port:
app.run(debug=True, host='127.0.0.1', port=5001)
```

### Problem: Static files not loading (CSS/JS broken)
Ensure files exist in `static/` folder:
```
static/
  ├── css/
  ├── js/
  └── assets/
```

### Problem: Templates not found
Ensure `templates/` folder exists in the same directory as `app.py`.

### Problem: Login not working
- Make sure role is selected before clicking "Sign In"
- Check browser console for JavaScript errors
- Verify form data is being sent correctly

---

## Next Steps

1. **Integrate Real Database** - Replace mock data with actual database
2. **Implement Authentication** - Use LDAP, OAuth, or database for real authentication
3. **Add More Routes** - Convert remaining PHP files to Flask routes
4. **Deploy to Production** - Use Gunicorn and nginx
5. **Add Tests** - Create unit tests for your routes

---

## Documentation Files

- **README.md** - Detailed setup and features
- **MIGRATION_GUIDE.md** - Complete PHP to Flask conversion guide
- **test_app.py** - Application verification script

---

## Support Resources

- Flask Documentation: https://flask.palletsprojects.com/
- Jinja2 Templates: https://jinja.palletsprojects.com/
- Python Official Docs: https://docs.python.org/3/

---

## Version Info

- Flask Version: 2.3.0+
- Python Version: 3.8+
- Conversion Date: February 2026

---

**Questions?** Refer to the detailed documentation:
- **Installation Help** → README.md
- **Migration Details** → MIGRATION_GUIDE.md
- **Testing & Verification** → test_app.py
