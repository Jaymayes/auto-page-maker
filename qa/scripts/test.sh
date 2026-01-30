#!/bin/bash

# ScholarMatch Platform - Automated Testing Script
# This script runs comprehensive testing including unit tests, linting, and integration tests
# Usage: ./qa/scripts/test.sh [--unit|--lint|--integration|--all]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
START_TIME=$(date +%s)

# Track test results
track_test_result() {
    if [ $1 -eq 0 ]; then
        ((TESTS_PASSED++))
        log_success "$2"
    else
        ((TESTS_FAILED++))
        log_error "$2"
    fi
}

# TypeScript type checking
run_type_check() {
    log_info "Running TypeScript type checking..."
    
    if npx tsc --noEmit; then
        track_test_result 0 "TypeScript type checking passed"
    else
        track_test_result 1 "TypeScript type checking failed"
        return 1
    fi
}

# ESLint linting
run_linting() {
    log_info "Running ESLint..."
    
    # Check if ESLint is installed
    if ! npm list eslint --depth=0 &> /dev/null; then
        log_warning "ESLint not installed - installing basic configuration"
        npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
    fi
    
    # Create basic ESLint config if it doesn't exist
    if [ ! -f ".eslintrc.js" ] && [ ! -f ".eslintrc.json" ] && [ ! -f "eslint.config.js" ]; then
        log_info "Creating basic ESLint configuration..."
        cat > .eslintrc.json << 'EOF'
{
  "extends": [
    "@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "root": true,
  "rules": {
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
EOF
    fi
    
    if npx eslint "**/*.{ts,tsx}" --max-warnings 10; then
        track_test_result 0 "ESLint passed (max 10 warnings allowed)"
    else
        track_test_result 1 "ESLint failed or too many warnings"
        return 1
    fi
}

# Unit tests (Jest or Vitest)
run_unit_tests() {
    log_info "Running unit tests..."
    
    # Check if Jest is configured
    if [ -f "jest.config.js" ] || [ -f "jest.config.ts" ] || npm list jest --depth=0 &> /dev/null 2>&1; then
        log_info "Running Jest unit tests..."
        if npm test 2>/dev/null; then
            track_test_result 0 "Jest unit tests passed"
        else
            track_test_result 1 "Jest unit tests failed"
            return 1
        fi
    # Check if Vitest is configured  
    elif npm list vitest --depth=0 &> /dev/null 2>&1; then
        log_info "Running Vitest unit tests..."
        if npx vitest run; then
            track_test_result 0 "Vitest unit tests passed"
        else
            track_test_result 1 "Vitest unit tests failed"
            return 1
        fi
    else
        log_warning "No unit test framework detected - skipping unit tests"
        log_info "To add unit tests, install Jest or Vitest"
    fi
}

# Build tests
run_build_tests() {
    log_info "Testing build process..."
    
    # Clean previous build
    if [ -d "dist" ]; then
        rm -rf dist
    fi
    
    # Test build
    if npm run build; then
        track_test_result 0 "Build process completed successfully"
        
        # Check if build outputs exist
        if [ -d "dist" ] || [ -d "build" ]; then
            track_test_result 0 "Build artifacts created"
        else
            track_test_result 1 "Build artifacts not found"
            return 1
        fi
    else
        track_test_result 1 "Build process failed"
        return 1
    fi
}

# Integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    
    # Check if server can start
    log_info "Testing server startup..."
    
    # Start server in background
    npm run dev &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 5
    
    # Test if server responds
    if curl -f -s http://localhost:5000/api/health > /dev/null 2>&1; then
        track_test_result 0 "Server health check passed"
    else
        track_test_result 1 "Server health check failed"
    fi
    
    # Test API endpoints
    if curl -f -s http://localhost:5000/api/scholarships/stats > /dev/null 2>&1; then
        track_test_result 0 "API endpoint test passed"
    else
        track_test_result 1 "API endpoint test failed"
    fi
    
    # Kill server
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
}

# Security tests
run_security_tests() {
    log_info "Running basic security tests..."
    
    # Check for common vulnerabilities in dependencies
    log_info "Checking for dependency vulnerabilities..."
    if npm audit --audit-level=high; then
        track_test_result 0 "No high-severity vulnerabilities found"
    else
        track_test_result 1 "High-severity vulnerabilities detected"
        log_warning "Run 'npm audit fix' to resolve vulnerabilities"
    fi
    
    # Check for hardcoded secrets (basic)
    log_info "Scanning for potential secrets in code..."
    SECRET_PATTERNS=("password" "secret" "key" "token" "api_key")
    SECRETS_FOUND=false
    
    for pattern in "${SECRET_PATTERNS[@]}"; do
        if grep -r -i "$pattern.*=" --include="*.ts" --include="*.js" --exclude-dir="node_modules" --exclude-dir="dist" . | grep -v "console.log\|// " | grep -v ".env" > /dev/null 2>&1; then
            SECRETS_FOUND=true
            log_warning "Potential secret pattern found: $pattern"
        fi
    done
    
    if [ "$SECRETS_FOUND" = false ]; then
        track_test_result 0 "No obvious secret patterns found in code"
    else
        track_test_result 1 "Potential secrets found in code - review needed"
    fi
}

# Performance tests
run_performance_tests() {
    log_info "Running basic performance tests..."
    
    # Bundle size check
    if [ -f "package.json" ]; then
        log_info "Checking bundle size..."
        
        # Build first
        npm run build > /dev/null 2>&1 || true
        
        # Check if build directory exists and get size
        if [ -d "dist" ]; then
            BUNDLE_SIZE=$(du -sh dist 2>/dev/null | cut -f1 2>/dev/null || echo "unknown")
            log_info "Bundle size: $BUNDLE_SIZE"
            track_test_result 0 "Bundle size check completed"
        elif [ -d "build" ]; then
            BUNDLE_SIZE=$(du -sh build 2>/dev/null | cut -f1 2>/dev/null || echo "unknown")  
            log_info "Bundle size: $BUNDLE_SIZE"
            track_test_result 0 "Bundle size check completed"
        else
            track_test_result 1 "Build directory not found for size check"
        fi
    fi
}

# Generate test report
generate_test_report() {
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    echo
    log_info "=== Test Report ==="
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo "Total Duration: ${DURATION}s"
    echo "Timestamp: $(date)"
    
    # Write to file
    cat > qa/test-report.txt << EOF
ScholarMatch Platform Test Report
Generated: $(date)
Duration: ${DURATION}s

Results:
- Passed: $TESTS_PASSED
- Failed: $TESTS_FAILED
- Success Rate: $(echo "scale=2; $TESTS_PASSED * 100 / ($TESTS_PASSED + $TESTS_FAILED)" | bc 2>/dev/null || echo "N/A")%

Test Categories Executed:
$([ "$RUN_TYPE_CHECK" = true ] && echo "- TypeScript Type Checking")
$([ "$RUN_LINTING" = true ] && echo "- Code Linting (ESLint)")
$([ "$RUN_UNIT_TESTS" = true ] && echo "- Unit Tests")
$([ "$RUN_BUILD_TESTS" = true ] && echo "- Build Tests")
$([ "$RUN_INTEGRATION_TESTS" = true ] && echo "- Integration Tests")
$([ "$RUN_SECURITY_TESTS" = true ] && echo "- Security Tests")
$([ "$RUN_PERFORMANCE_TESTS" = true ] && echo "- Performance Tests")
EOF
    
    log_info "Test report saved to qa/test-report.txt"
}

# Main testing function
main() {
    echo
    log_info "=== ScholarMatch Platform Test Suite ==="
    echo
    
    # Parse arguments
    RUN_TYPE_CHECK=false
    RUN_LINTING=false
    RUN_UNIT_TESTS=false
    RUN_BUILD_TESTS=false
    RUN_INTEGRATION_TESTS=false
    RUN_SECURITY_TESTS=false
    RUN_PERFORMANCE_TESTS=false
    
    case "${1:-all}" in
        "--unit")
            RUN_UNIT_TESTS=true
            log_info "Running unit tests only"
            ;;
        "--lint")
            RUN_TYPE_CHECK=true
            RUN_LINTING=true
            log_info "Running linting tests only"
            ;;
        "--integration")
            RUN_INTEGRATION_TESTS=true
            log_info "Running integration tests only"
            ;;
        "--security")
            RUN_SECURITY_TESTS=true
            log_info "Running security tests only"
            ;;
        "--performance")
            RUN_PERFORMANCE_TESTS=true
            log_info "Running performance tests only"
            ;;
        "--all"|*)
            RUN_TYPE_CHECK=true
            RUN_LINTING=true
            RUN_UNIT_TESTS=true
            RUN_BUILD_TESTS=true
            RUN_INTEGRATION_TESTS=true
            RUN_SECURITY_TESTS=true
            RUN_PERFORMANCE_TESTS=true
            log_info "Running all tests"
            ;;
    esac
    
    # Run selected tests
    OVERALL_SUCCESS=true
    
    [ "$RUN_TYPE_CHECK" = true ] && { run_type_check || OVERALL_SUCCESS=false; }
    [ "$RUN_LINTING" = true ] && { run_linting || OVERALL_SUCCESS=false; }
    [ "$RUN_UNIT_TESTS" = true ] && { run_unit_tests || OVERALL_SUCCESS=false; }
    [ "$RUN_BUILD_TESTS" = true ] && { run_build_tests || OVERALL_SUCCESS=false; }
    [ "$RUN_INTEGRATION_TESTS" = true ] && { run_integration_tests || OVERALL_SUCCESS=false; }
    [ "$RUN_SECURITY_TESTS" = true ] && { run_security_tests || OVERALL_SUCCESS=false; }
    [ "$RUN_PERFORMANCE_TESTS" = true ] && { run_performance_tests || OVERALL_SUCCESS=false; }
    
    # Generate report
    generate_test_report
    
    echo
    if [ "$OVERALL_SUCCESS" = true ] && [ $TESTS_FAILED -eq 0 ]; then
        log_success "=== All tests passed! ==="
        exit 0
    else
        log_error "=== Some tests failed! ==="
        exit 1
    fi
}

# Run main function with all arguments
main "$@"