#!/usr/bin/env python3
"""
Portfolio Backend Startup Script

This script provides easy startup and management for the portfolio backend API.
"""

import os
import sys
import subprocess
import time
import signal
import argparse
from pathlib import Path

def check_python_version():
    """Ensure we have Python 3.8+"""
    if sys.version_info < (3, 8):
        print("❌ Error: Python 3.8 or higher is required")
        print(f"Current version: {sys.version}")
        sys.exit(1)
    print(f"✅ Python version: {sys.version.split()[0]}")

def install_dependencies():
    """Install required packages"""
    print("📦 Installing dependencies...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                      check=True, capture_output=True)
        print("✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def check_dependencies():
    """Check if required packages are available"""
    required_packages = ['yfinance', 'flask', 'flask_cors', 'requests', 'pandas', 'numpy']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing packages: {', '.join(missing_packages)}")
        return False
    
    print("✅ All required packages are available")
    return True

def setup_environment():
    """Setup environment variables"""
    env_file = Path('.env')
    if not env_file.exists():
        print("⚠️  No .env file found, creating from template...")
        example_file = Path('.env.example')
        if example_file.exists():
            import shutil
            shutil.copy('.env.example', '.env')
            print("✅ Created .env file from template")
        else:
            print("⚠️  No .env.example found, using defaults")
    else:
        print("✅ Environment file found")

def run_development():
    """Run in development mode"""
    print("🚀 Starting development server...")
    print("📍 Backend will be available at: http://localhost:5000")
    print("📍 API endpoints: http://localhost:5000/api/")
    print("📍 Health check: http://localhost:5000/api/health")
    print("\n💡 Tip: Add API keys via the Settings tab in the frontend for better data access")
    print("🛑 Press Ctrl+C to stop the server\n")
    
    try:
        subprocess.run([sys.executable, "api.py"], check=True)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"❌ Server failed to start: {e}")

def run_production():
    """Run in production mode with Gunicorn"""
    print("🚀 Starting production server with Gunicorn...")
    
    try:
        # Check if gunicorn is available
        subprocess.run(["gunicorn", "--version"], check=True, capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ Gunicorn not found. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "gunicorn"], check=True)
    
    cmd = [
        "gunicorn",
        "--workers", "4",
        "--bind", "0.0.0.0:5000",
        "--timeout", "30",
        "--keepalive", "2",
        "--access-logfile", "-",
        "--error-logfile", "-",
        "api:app"
    ]
    
    print("📍 Production server will be available at: http://localhost:5000")
    print("🛑 Press Ctrl+C to stop the server\n")
    
    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"❌ Server failed to start: {e}")

def run_docker():
    """Run with Docker"""
    print("🐳 Starting with Docker...")
    
    try:
        # Check if Docker is available
        subprocess.run(["docker", "--version"], check=True, capture_output=True)
        
        # Build and run
        subprocess.run(["docker-compose", "up", "--build"], check=True)
        
    except FileNotFoundError:
        print("❌ Docker not found. Please install Docker first.")
    except subprocess.CalledProcessError as e:
        print(f"❌ Docker failed: {e}")

def main():
    parser = argparse.ArgumentParser(description="Portfolio Backend Startup Script")
    parser.add_argument("--mode", choices=["dev", "prod", "docker"], default="dev",
                       help="Run mode (default: dev)")
    parser.add_argument("--install", action="store_true",
                       help="Install dependencies before starting")
    parser.add_argument("--check", action="store_true",
                       help="Only check requirements, don't start server")
    
    args = parser.parse_args()
    
    print("🏦 Portfolio Backend API")
    print("=" * 50)
    
    # Check Python version
    check_python_version()
    
    # Install dependencies if requested
    if args.install:
        if not install_dependencies():
            sys.exit(1)
    
    # Check dependencies
    if not check_dependencies():
        if not args.install:
            print("\n💡 Try running with --install to install missing packages")
        sys.exit(1)
    
    # Setup environment
    setup_environment()
    
    if args.check:
        print("✅ All requirements satisfied")
        return
    
    # Run server based on mode
    if args.mode == "dev":
        run_development()
    elif args.mode == "prod":
        run_production()
    elif args.mode == "docker":
        run_docker()

if __name__ == "__main__":
    main()