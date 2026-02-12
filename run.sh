#!/bin/bash

# AERIS Flask Application Launcher for Linux/Mac

echo ""
echo "===================================="
echo "AERIS System - Flask Application"
echo "===================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed or not in PATH"
    echo "Please install Python from https://www.python.org/downloads/"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "Error: Could not create virtual environment"
        exit 1
    fi
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install/upgrade requirements
echo "Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt
if [ $? -ne 0 ]; then
    echo "Error: Could not install dependencies"
    echo "Please check your requirements.txt file"
    exit 1
fi

# Run the application
echo ""
echo "Starting AERIS Flask Application..."
echo "Application will be available at: http://127.0.0.1:5000"
echo "Press Ctrl+C to stop the server"
echo ""

python app.py
