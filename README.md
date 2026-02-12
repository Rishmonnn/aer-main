# AERIS System - Flask Migration

This is the Flask (Python) version of the AERIS system. It replaces the PHP application with a Python/Flask backend while maintaining the same frontend UI/UX.

## Project Structure

```
aeris-system/
├── app.py                          # Main Flask application
├── config.py                      # Configuration settings
├── requirements.txt               # Python dependencies
├── templates/                     # Jinja2 HTML templates
│   ├── base.html                  # Base template
│   ├── index.html                 # Login page
│   ├── faculty.html               # Faculty dashboard
│   ├── program-head.html          # Program head dashboard
│   └── includes/                  # Template partials
│       └── faculty/
│           ├── home.html
│           ├── grading.html
│           ├── classes.html
│           └── inc.html
└── static/                        # Static files (CSS, JS, images)
    ├── css/
    ├── js/
    └── assets/
```

## Setup Instructions

### 1. Install Python (if not already installed)
- Download from https://www.python.org/downloads/
- Ensure Python 3.8+ is installed

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Application
```bash
python app.py
```

The application will start on `http://127.0.0.1:5000`

## Login Credentials

The application uses mock authentication for testing. To log in:

**As Faculty:**
- Email: `faculty@institution.edu`
- Password: Any password
- Select "AS FACULTY"

**As Program Head:**
- Email: `head@institution.edu`
- Password: Any password
- Select "AS HEAD"

## Features Converted from PHP

- ✅ Faculty Dashboard with grading, classes, and INC approval
- ✅ Session-based authentication
- ✅ RESTful API endpoints
- ✅ Jinja2 template inheritance
- ✅ Static file serving

## Database Integration

Currently, the application uses mock data. To integrate with a real database:

1. Install a database driver:
   ```bash
   pip install flask-sqlalchemy
   ```

2. Update `app.py` with SQLAlchemy models and replace mock data queries with actual database queries.

## Configuration

Edit `config.py` to modify:
- Debug mode
- Secret key
- Database connection string
- Session settings

## API Endpoints

### Faculty Routes
- `GET /api/faculty/classes` - Get faculty classes
- `GET /api/faculty/grading/<class_id>` - Get grading records
- `GET /api/faculty/inc` - Get INC requests
- `POST /api/faculty/inc/<inc_id>/approve` - Approve INC
- `POST /api/faculty/inc/<inc_id>/deny` - Deny INC
- `POST /api/faculty/grades/<class_id>/<student_id>` - Update grade

## Next Steps

1. Replace mock data with database queries
2. Implement proper user authentication (e.g., LDAP, database)
3. Add form validation and error handling
4. Set up logging
5. Deploy to production server

## Notes

- The PHP `header.php` and `footer.php` functionality is now in `base.html`
- The JavaScript frontend is unchanged and works the same way
- All CSS files have been moved to `static/css/`
- All JavaScript files have been moved to `static/js/`
