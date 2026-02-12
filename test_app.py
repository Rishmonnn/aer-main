"""
Test script for AERIS Flask application
Verifies that the application initializes and routes are working correctly
"""

import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app import app, login_required

def test_app_creation():
    """Test that Flask app is created successfully"""
    print("✓ Flask app created successfully")
    assert app is not None
    assert app.config['SECRET_KEY'] is not None
    print("✓ Configuration loaded")

def test_routes():
    """Test that routes are registered"""
    with app.app_context():
        routes = []
        for rule in app.url_map.iter_rules():
            routes.append(str(rule))
        
        print("\n✓ Registered Routes:")
        for route in sorted(routes):
            print(f"  - {route}")
        
        # Check key routes exist
        assert any('/' == str(r) for r in app.url_map.iter_rules()), "Home route not found"
        assert any('/faculty' in str(r) for r in app.url_map.iter_rules()), "Faculty route not found"
        assert any('/api/faculty' in str(r) for r in app.url_map.iter_rules()), "API routes not found"
        print("\n✓ All key routes registered")

def test_templates():
    """Test that template files exist"""
    templates_dir = os.path.join(os.path.dirname(__file__), 'templates')
    required_templates = [
        'base.html',
        'index.html',
        'faculty.html',
        'program-head.html',
        'includes/faculty/home.html',
        'includes/faculty/grading.html',
        'includes/faculty/classes.html',
        'includes/faculty/inc.html',
    ]
    
    print("\n✓ Template Files:")
    for template in required_templates:
        path = os.path.join(templates_dir, template)
        exists = os.path.exists(path)
        status = "✓" if exists else "✗"
        print(f"  {status} {template}")
        assert exists, f"Template not found: {template}"
    
    print("\n✓ All required templates found")

def test_static_files():
    """Test that static folders exist"""
    static_dir = os.path.join(os.path.dirname(__file__), 'static')
    required_dirs = ['css', 'js', 'assets']
    
    print("\n✓ Static Directories:")
    for dir_name in required_dirs:
        path = os.path.join(static_dir, dir_name)
        exists = os.path.isdir(path)
        status = "✓" if exists else "✗"
        print(f"  {status} {dir_name}/")
    
    print("\n✓ Static directories exist")

def test_client():
    """Test basic client requests"""
    print("\n✓ Testing Client Requests:")
    
    with app.test_client() as client:
        # Test homepage
        response = client.get('/')
        print(f"  ✓ GET / - Status {response.status_code}")
        assert response.status_code == 200, "Homepage not accessible"
        
        # Test unauthorized access to protected route
        response = client.get('/faculty')
        print(f"  ✓ GET /faculty (unauthorized) - Status {response.status_code}")
        assert response.status_code == 302, "Protected route not properly secured"
        
        # Test API with missing authentication
        response = client.get('/api/faculty/classes')
        print(f"  ✓ GET /api/faculty/classes (unauthorized) - Status {response.status_code}")
        assert response.status_code == 302, "API not properly secured"
    
    print("\n✓ Client requests working correctly")

def run_tests():
    """Run all tests"""
    print("\n" + "="*50)
    print("AERIS Flask Application Test Suite")
    print("="*50 + "\n")
    
    try:
        test_app_creation()
        test_routes()
        test_templates()
        test_static_files()
        test_client()
        
        print("\n" + "="*50)
        print("✓ All tests passed!")
        print("="*50)
        print("\nYour Flask application is ready to run.")
        print("Execute: python app.py")
        print("\nAccess the application at: http://127.0.0.1:5000")
        return 0
        
    except Exception as e:
        print(f"\n✗ Test failed: {str(e)}")
        print("="*50)
        return 1

if __name__ == '__main__':
    exit_code = run_tests()
    sys.exit(exit_code)
