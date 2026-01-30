#!/bin/bash

# ScholarMatch Platform - Run Script
# This script handles running the application in different modes
# Usage: ./qa/scripts/run.sh [--dev|--prod|--serve|--debug]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
RUN_MODE="dev"
SERVER_PID=""
PORT=${PORT:-5000}

# Parse arguments
parse_arguments() {
    case "${1:-dev}" in
        "--dev")
            RUN_MODE="dev"
            log_info "Running in development mode"
            ;;
        "--prod")
            RUN_MODE="prod"
            log_info "Running in production mode"
            ;;
        "--serve")
            RUN_MODE="serve"
            log_info "Serving built application"
            ;;
        "--debug")
            RUN_MODE="debug"
            log_info "Running in debug mode"
            ;;
        *)
            RUN_MODE="dev"
            log_info "Default development mode"
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check package.json
    if [ ! -f "package.json" ]; then
        log_error "package.json not found"
        exit 1
    fi
    
    # Check node_modules
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules not found - running npm install"
        npm install
    fi
    
    log_success "Prerequisites check passed"
}

# Setup environment
setup_environment() {
    log_info "Setting up environment..."
    
    # Load .env file if it exists
    if [ -f ".env" ]; then
        log_info "Loading environment variables from .env"
        export $(grep -v '^#' .env | grep -v '^$' | xargs)
    fi
    
    # Set default environment variables
    export NODE_ENV=${NODE_ENV:-development}
    export PORT=${PORT:-5000}
    
    if [ "$RUN_MODE" = "prod" ]; then
        export NODE_ENV=production
        log_info "Environment set to production"
    else
        export NODE_ENV=development
        log_info "Environment set to development"
    fi
    
    log_info "Server will run on port: $PORT"
}

# Check port availability
check_port() {
    log_info "Checking if port $PORT is available..."
    
    if command -v lsof >/dev/null 2>&1; then
        if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
            log_warning "Port $PORT is already in use"
            
            # Try to kill existing process
            EXISTING_PID=$(lsof -Pi :$PORT -sTCP:LISTEN -t)
            log_info "Found existing process on port $PORT (PID: $EXISTING_PID)"
            
            read -p "Kill existing process? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                kill $EXISTING_PID
                sleep 2
                log_info "Existing process killed"
            else
                log_error "Cannot start server - port $PORT is in use"
                exit 1
            fi
        fi
    elif command -v netstat >/dev/null 2>&1; then
        if netstat -ln | grep ":$PORT " >/dev/null 2>&1; then
            log_warning "Port $PORT appears to be in use"
        fi
    else
        log_warning "Cannot check port availability - lsof and netstat not available"
    fi
}

# Run development server
run_dev() {
    log_info "Starting development server..."
    
    # Check if dev script exists
    if ! npm run --silent 2>&1 | grep -q "dev"; then
        log_error "Dev script not found in package.json"
        exit 1
    fi
    
    # Pre-flight checks
    log_info "Running pre-flight checks..."
    
    # Basic TypeScript check
    if [ -f "tsconfig.json" ]; then
        log_info "Checking TypeScript configuration..."
        if ! npx tsc --noEmit --skipLibCheck; then
            log_warning "TypeScript check failed - continuing anyway"
        fi
    fi
    
    # Start development server
    log_success "Starting development server on port $PORT..."
    log_info "Press Ctrl+C to stop the server"
    echo
    
    npm run dev
}

# Run production server
run_prod() {
    log_info "Starting production server..."
    
    # Check if build exists
    BUILD_DIR=""
    if [ -d "dist" ]; then
        BUILD_DIR="dist"
    elif [ -d "build" ]; then
        BUILD_DIR="build"
    else
        log_info "No build found - building first..."
        ./qa/scripts/build.sh --prod
        
        if [ -d "dist" ]; then
            BUILD_DIR="dist"
        elif [ -d "build" ]; then
            BUILD_DIR="build"
        else
            log_error "Build failed or build directory not found"
            exit 1
        fi
    fi
    
    log_info "Using build directory: $BUILD_DIR"
    
    # Check if production start script exists
    if npm run --silent 2>&1 | grep -q "start"; then
        log_info "Using npm start script"
        npm run start
    else
        log_info "No start script found - using node server"
        
        # Find server entry point
        if [ -f "server/index.js" ]; then
            node server/index.js
        elif [ -f "dist/server/index.js" ]; then
            node dist/server/index.js
        elif [ -f "index.js" ]; then
            node index.js
        else
            log_error "Server entry point not found"
            exit 1
        fi
    fi
}

# Serve built application
run_serve() {
    log_info "Serving built application..."
    
    # Find build directory
    BUILD_DIR=""
    if [ -d "dist" ]; then
        BUILD_DIR="dist"
    elif [ -d "build" ]; then
        BUILD_DIR="build"
    else
        log_error "Build directory not found - run build first"
        log_info "Run: ./qa/scripts/build.sh --prod"
        exit 1
    fi
    
    # Install serve if not available
    if ! command -v serve >/dev/null 2>&1; then
        log_info "Installing serve globally..."
        npm install -g serve
    fi
    
    log_success "Serving from $BUILD_DIR on port $PORT"
    log_info "Open http://localhost:$PORT in your browser"
    log_info "Press Ctrl+C to stop the server"
    echo
    
    serve -s "$BUILD_DIR" -p "$PORT"
}

# Run debug mode
run_debug() {
    log_info "Starting server in debug mode..."
    
    # Check if debug script exists
    if npm run --silent 2>&1 | grep -q "debug"; then
        npm run debug
    else
        log_info "No debug script found - using node inspect"
        
        # Find server entry point for debugging
        if [ -f "server/index.ts" ]; then
            npx tsx --inspect server/index.ts
        elif [ -f "server/index.js" ]; then
            node --inspect server/index.js
        else
            log_error "Server entry point not found for debugging"
            exit 1
        fi
    fi
}

# Health check
run_health_check() {
    log_info "Running health check..."
    
    # Wait a moment for server to start
    sleep 3
    
    # Check if server responds
    if command -v curl >/dev/null 2>&1; then
        if curl -f -s http://localhost:$PORT/api/health >/dev/null 2>&1; then
            log_success "Health check passed - server is responding"
        elif curl -f -s http://localhost:$PORT >/dev/null 2>&1; then
            log_success "Server is responding (health endpoint not available)"
        else
            log_warning "Health check failed - server may not be ready yet"
        fi
    elif command -v wget >/dev/null 2>&1; then
        if wget -q --spider http://localhost:$PORT/api/health 2>/dev/null; then
            log_success "Health check passed - server is responding"
        else
            log_warning "Health check failed - server may not be ready yet"
        fi
    else
        log_warning "Cannot run health check - curl/wget not available"
    fi
}

# Handle shutdown
cleanup() {
    if [ -n "$SERVER_PID" ]; then
        log_info "Stopping server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
    log_info "Cleanup completed"
    exit 0
}

# Setup signal handlers
setup_signal_handlers() {
    trap cleanup SIGINT SIGTERM
}

# Display server information
show_server_info() {
    echo
    log_info "=== Server Information ==="
    log_info "Mode: $RUN_MODE"
    log_info "Environment: $NODE_ENV"
    log_info "Port: $PORT"
    log_info "URL: http://localhost:$PORT"
    
    if [ -n "$DATABASE_URL" ]; then
        log_info "Database: Connected"
    else
        log_info "Database: Sample data mode"
    fi
    
    if [ -n "$OPENAI_API_KEY" ]; then
        log_info "OpenAI: Enabled"
    else
        log_info "OpenAI: Disabled"
    fi
    
    if [ -n "$SHARED_SECRET" ]; then
        log_info "Agent Bridge: Enabled"
    else
        log_info "Agent Bridge: Disabled"
    fi
    
    echo
}

# Main run function
main() {
    echo
    log_info "=== ScholarMatch Platform Server ==="
    echo
    
    parse_arguments "$1"
    check_prerequisites
    setup_environment
    setup_signal_handlers
    check_port
    show_server_info
    
    # Run in appropriate mode
    case "$RUN_MODE" in
        "dev")
            run_dev
            ;;
        "prod")
            run_prod
            ;;
        "serve")
            run_serve
            ;;
        "debug")
            run_debug
            ;;
        *)
            log_error "Invalid run mode: $RUN_MODE"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"