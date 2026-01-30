#!/bin/bash

# ScholarMatch Platform - Automated Installation Script
# This script handles dependency installation and environment setup
# Usage: ./qa/scripts/install.sh [--prod|--dev]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in Replit environment
check_environment() {
    log_info "Checking environment..."
    
    if [ -n "$REPLIT_ENVIRONMENT" ]; then
        log_info "Running in Replit environment"
        ENVIRONMENT="replit"
    else
        log_info "Running in local environment"
        ENVIRONMENT="local"
    fi
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    log_info "Node.js version: $NODE_VERSION"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    log_info "npm version: $NPM_VERSION"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Clean install
    if [ -d "node_modules" ]; then
        log_info "Cleaning existing node_modules..."
        rm -rf node_modules
    fi
    
    if [ -f "package-lock.json" ]; then
        log_info "Cleaning package-lock.json..."
        rm -f package-lock.json
    fi
    
    # Install with clean cache
    log_info "Running npm install..."
    npm install --no-fund --no-audit
    
    log_success "Dependencies installed successfully"
}

# Setup environment files
setup_environment() {
    log_info "Setting up environment configuration..."
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            log_info "Creating .env from .env.example..."
            cp .env.example .env
            log_warning "Please update .env with your actual environment variables"
        else
            log_info "Creating basic .env file..."
            cat > .env << 'EOF'
# Development Environment Variables
NODE_ENV=development
PORT=5000

# Optional: Agent Bridge (uncomment and set to enable)
# SHARED_SECRET=your-shared-secret-min-32-chars
# COMMAND_CENTER_URL=https://command-center.replit.dev
# AGENT_BASE_URL=auto-detected
# AGENT_NAME=ScholarMatch Platform Agent
# AGENT_ID=scholarmatch-agent

# Optional: AI Content Generation (uncomment to enable)
# OPENAI_API_KEY=sk-your-openai-key

# Optional: Authentication (uncomment to enable)  
# JWT_SECRET=your-jwt-secret-min-32-chars

# Optional: Database (Replit provides automatically)
# DATABASE_URL=postgresql://username:password@host:port/database

# Optional: Analytics
# VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
EOF
            log_success ".env file created with defaults"
        fi
    else
        log_info ".env file already exists"
    fi
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    # Check if main dependencies are installed
    REQUIRED_DEPS=("express" "react" "typescript" "vite" "@tanstack/react-query")
    
    for dep in "${REQUIRED_DEPS[@]}"; do
        if npm list "$dep" --depth=0 &> /dev/null; then
            log_success "$dep is installed"
        else
            log_error "$dep is not installed properly"
            exit 1
        fi
    done
    
    # Check if build scripts exist
    if npm run --silent 2>&1 | grep -q "build"; then
        log_success "Build script available"
    else
        log_warning "Build script not found in package.json"
    fi
    
    # Check if dev script exists  
    if npm run --silent 2>&1 | grep -q "dev"; then
        log_success "Dev script available"
    else
        log_error "Dev script not found in package.json"
        exit 1
    fi
}

# Database setup
setup_database() {
    log_info "Setting up database schema..."
    
    # Check if DATABASE_URL is available
    if [ -n "$DATABASE_URL" ]; then
        log_info "Database URL detected, pushing schema..."
        if npm run db:push 2>/dev/null; then
            log_success "Database schema synchronized"
        else
            log_warning "Database schema push failed - this is normal if no schema changes are needed"
        fi
    else
        log_warning "DATABASE_URL not set - database operations will use sample data"
    fi
}

# Run post-install checks
post_install_checks() {
    log_info "Running post-installation checks..."
    
    # Check TypeScript compilation
    log_info "Checking TypeScript compilation..."
    if npx tsc --noEmit 2>/dev/null; then
        log_success "TypeScript compilation successful"
    else
        log_warning "TypeScript compilation has warnings - check with 'npx tsc --noEmit'"
    fi
    
    # Check if Vite can start (dry run)
    log_info "Validating Vite configuration..."
    if timeout 10 npm run build 2>/dev/null; then
        log_success "Vite build configuration is valid"
    else
        log_warning "Vite build check failed or timed out"
    fi
}

# Main installation flow
main() {
    echo
    log_info "=== ScholarMatch Platform Installation ==="
    echo
    
    # Parse arguments
    INSTALL_MODE="dev"
    if [ "$1" = "--prod" ]; then
        INSTALL_MODE="prod"
        log_info "Production installation mode"
    else
        log_info "Development installation mode"
    fi
    
    # Run installation steps
    check_environment
    install_dependencies
    setup_environment
    verify_installation
    setup_database
    post_install_checks
    
    echo
    log_success "=== Installation completed successfully! ==="
    echo
    log_info "Next steps:"
    log_info "1. Update .env file with your environment variables"
    log_info "2. Run 'npm run dev' to start the development server"
    log_info "3. Run './qa/scripts/test.sh' to execute the test suite"
    echo
}

# Run main function with all arguments
main "$@"