#!/bin/bash

# Enhanced Portfolio Dashboard - Installation Script
# This script sets up the complete enhanced portfolio dashboard

echo "🏦 Enhanced Portfolio Dashboard - Installation"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ️${NC} $1"
}

# Check if Python is available
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
        print_status "Python 3 found: $(python3 --version)"
    elif command -v python &> /dev/null; then
        PYTHON_VERSION=$(python --version 2>&1)
        if [[ $PYTHON_VERSION == *"Python 3"* ]]; then
            PYTHON_CMD="python"
            print_status "Python 3 found: $PYTHON_VERSION"
        else
            print_error "Python 3 is required but not found"
            return 1
        fi
    else
        print_error "Python is not installed"
        return 1
    fi
    return 0
}

# Check if pip is available
check_pip() {
    if command -v pip3 &> /dev/null; then
        PIP_CMD="pip3"
    elif command -v pip &> /dev/null; then
        PIP_CMD="pip"
    else
        print_error "pip is not installed"
        return 1
    fi
    print_status "pip found: $PIP_CMD"
    return 0
}

# Install backend dependencies
install_backend() {
    print_info "Setting up Python backend..."
    
    if ! check_python; then
        print_warning "Python backend setup skipped - Python 3 not available"
        print_info "Frontend will work with demo data and limited API access"
        return 1
    fi
    
    if ! check_pip; then
        print_warning "pip not found - cannot install backend dependencies"
        return 1
    fi
    
    cd backend
    
    # Create virtual environment (optional but recommended)
    if ! [ -d "venv" ]; then
        print_info "Creating virtual environment..."
        $PYTHON_CMD -m venv venv
    fi
    
    # Activate virtual environment
    if [ -f "venv/bin/activate" ]; then
        print_info "Activating virtual environment..."
        source venv/bin/activate
    fi
    
    # Install dependencies
    print_info "Installing Python dependencies..."
    $PIP_CMD install -r requirements.txt
    
    if [ $? -eq 0 ]; then
        print_status "Backend dependencies installed successfully"
        
        # Make start script executable
        chmod +x start.py
        
        # Create .env file if it doesn't exist
        if [ ! -f ".env" ]; then
            cp .env.example .env
            print_status "Created .env configuration file"
        fi
        
        print_status "Python backend setup complete!"
        print_info "To start backend: cd backend && python start.py"
        cd ..
        return 0
    else
        print_error "Failed to install backend dependencies"
        cd ..
        return 1
    fi
}

# Setup frontend
setup_frontend() {
    print_info "Setting up frontend..."
    
    # Check if all required files exist
    required_files=("index.html" "app.js" "style.css")
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            print_error "Required file $file not found"
            return 1
        fi
    done
    
    print_status "Frontend files verified"
    print_status "Frontend setup complete!"
    return 0
}

# Create startup scripts
create_scripts() {
    print_info "Creating startup scripts..."
    
    # Create start_frontend.sh
    cat > start_frontend.sh << 'EOF'
#!/bin/bash
echo "🌐 Starting Frontend Server..."

if command -v python3 &> /dev/null; then
    echo "📍 Frontend available at: http://localhost:8000"
    echo "🛑 Press Ctrl+C to stop"
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "📍 Frontend available at: http://localhost:8000"
    echo "🛑 Press Ctrl+C to stop"
    python -m http.server 8000
else
    echo "❌ Python not found. Please open index.html directly in your browser."
fi
EOF
    chmod +x start_frontend.sh
    
    # Create start_complete.sh
    cat > start_complete.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Complete Portfolio Dashboard..."

# Function to kill background processes
cleanup() {
    echo "🛑 Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Start backend if available
if [ -f "backend/start.py" ] && command -v python3 &> /dev/null; then
    echo "🔧 Starting backend server..."
    cd backend
    python3 start.py --mode dev &
    BACKEND_PID=$!
    cd ..
    sleep 3
    echo "✅ Backend started (PID: $BACKEND_PID)"
else
    echo "⚠️  Backend not available - frontend will use direct API calls"
fi

# Start frontend
echo "🌐 Starting frontend server..."
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000 &
    FRONTEND_PID=$!
elif command -v python &> /dev/null; then
    python -m http.server 8000 &
    FRONTEND_PID=$!
fi

echo ""
echo "🎉 Portfolio Dashboard is ready!"
echo "📍 Frontend: http://localhost:8000"
echo "📍 Backend:  http://localhost:5000/api (if available)"
echo "📍 Settings: Click Settings tab for configuration"
echo ""
echo "🛑 Press Ctrl+C to stop all servers"

# Wait for processes
wait
EOF
    chmod +x start_complete.sh
    
    print_status "Startup scripts created"
}

# Main installation
main() {
    echo ""
    print_info "Starting installation..."
    echo ""
    
    # Setup frontend (always works)
    if setup_frontend; then
        print_status "Frontend setup successful"
    else
        print_error "Frontend setup failed"
        exit 1
    fi
    
    echo ""
    
    # Setup backend (optional)
    if install_backend; then
        print_status "Backend setup successful"
        BACKEND_AVAILABLE=true
    else
        print_warning "Backend setup failed or skipped"
        BACKEND_AVAILABLE=false
    fi
    
    echo ""
    
    # Create helper scripts
    create_scripts
    
    echo ""
    echo "🎉 Installation Complete!"
    echo "========================"
    echo ""
    
    if [ "$BACKEND_AVAILABLE" = true ]; then
        print_status "Full installation with Python backend"
        echo ""
        print_info "Start options:"
        echo "  • Complete setup:  ./start_complete.sh"
        echo "  • Frontend only:   ./start_frontend.sh"
        echo "  • Backend only:    cd backend && python start.py"
        echo ""
        print_info "Recommended: Use ./start_complete.sh for best experience"
    else
        print_status "Frontend-only installation"
        echo ""
        print_info "Start options:"
        echo "  • Frontend server: ./start_frontend.sh"
        echo "  • Direct browser:  Open index.html"
        echo ""
        print_warning "For full features, install Python 3.8+ and run this script again"
    fi
    
    echo ""
    print_info "After starting, open the Settings tab to:"
    echo "  • Configure API keys for better data access"
    echo "  • Monitor API performance and cache statistics"
    echo "  • Test backend connectivity"
    echo "  • Customize cache and timeout settings"
    echo ""
    print_status "Setup complete! Enjoy your enhanced portfolio dashboard! 🚀"
}

# Run main function
main