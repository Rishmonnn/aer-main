from app import app, db

with app.app_context():
    # This will drop ALL tables and recreate them with the newest models.py schema
    db.drop_all()
    db.create_all()
    print("Database tables dropped and recreated with the new columns!")