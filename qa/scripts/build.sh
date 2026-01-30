#!/bin/bash

# ScholarMatch Platform - Build Script
# This script handles production and development builds with optimization
# Usage: ./qa/scripts/build.sh [--prod|--dev|--analyze|--clean]

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

# Build configuration
BUILD_MODE="prod"
ANALYZE_BUNDLE=false
CLEAN_FIRST=false
START_TIME=$(date +%s)

# Parse arguments
parse_arguments() {
    case "${1:-prod}" in
        "--prod")
            BUILD_MODE="prod"
            log_info "Production build mode"
            ;;
        "--dev")
            BUILD_MODE="dev"
            log_info "Development build mode"
            ;;
        "--analyze")
            BUILD_MODE="prod"
            ANALYZE_BUNDLE=true
            log_info "Production build with bundle analysis"
            ;;
        "--clean")
            CLEAN_FIRST=true
            BUILD_MODE="prod"
            log_info "Clean production build"
            ;;
        *)
            BUILD_MODE="prod"
            log_info "Default production build mode"
            ;;
    esac
}

# Clean build artifacts
clean_build() {
    log_info "Cleaning previous build artifacts..."
    
    # Remove common build directories
    [ -d "dist" ] && rm -rf dist
    [ -d "build" ] && rm -rf build
    [ -d ".next" ] && rm -rf .next
    [ -d "out" ] && rm -rf out
    
    # Remove TypeScript build cache
    [ -f "tsconfig.tsbuildinfo" ] && rm -f tsconfig.tsbuildinfo
    
    log_success "Build artifacts cleaned"
}

# Check dependencies
check_dependencies() {
    log_info "Checking build dependencies..."
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "package.json not found"
        exit 1
    fi
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_error "node_modules not found - run npm install first"
        exit 1
    fi
    
    # Check for build script
    if ! npm run --silent 2>&1 | grep -q "build"; then
        log_error "Build script not found in package.json"
        exit 1
    fi
    
    # Check TypeScript
    if [ -f "tsconfig.json" ]; then
        log_info "TypeScript project detected"
        if ! npm list typescript --depth=0 &> /dev/null; then
            log_warning "TypeScript not installed as dependency"
        fi
    fi
    
    log_success "Dependencies check passed"
}

# Pre-build checks
run_pre_build_checks() {
    log_info "Running pre-build checks..."
    
    # TypeScript type checking
    if [ -f "tsconfig.json" ]; then
        log_info "Running TypeScript type checking..."
        if npx tsc --noEmit; then
            log_success "TypeScript check passed"
        else
            log_error "TypeScript check failed"
            exit 1
        fi
    fi
    
    # Basic linting (if available)
    if npm list eslint --depth=0 &> /dev/null 2>&1; then
        log_info "Running quick lint check..."
        if npx eslint "**/*.{ts,tsx}" --max-warnings 20 --quiet; then
            log_success "Lint check passed"
        else
            log_warning "Lint check failed - continuing with build"
        fi
    fi
}

# Run build process
run_build() {
    log_info "Starting build process..."
    
    # Set build environment
    if [ "$BUILD_MODE" = "prod" ]; then
        export NODE_ENV=production
        log_info "Building for production..."
    else
        export NODE_ENV=development
        log_info "Building for development..."
    fi
    
    # Run build command
    if npm run build; then
        log_success "Build completed successfully"
    else
        log_error "Build failed"
        exit 1
    fi
}

# Analyze build output
analyze_build() {
    log_info "Analyzing build output..."
    
    # Find build directory
    BUILD_DIR=""
    if [ -d "dist" ]; then
        BUILD_DIR="dist"
    elif [ -d "build" ]; then
        BUILD_DIR="build"
    else
        log_warning "Build directory not found - skipping analysis"
        return
    fi
    
    # Get build size
    if command -v du >/dev/null 2>&1; then
        BUILD_SIZE=$(du -sh "$BUILD_DIR" 2>/dev/null | cut -f1 2>/dev/null || echo "unknown")
        log_info "Total build size: $BUILD_SIZE"
    fi
    
    # Count files
    FILE_COUNT=$(find "$BUILD_DIR" -type f | wc -l)
    log_info "Total files: $FILE_COUNT"
    
    # Analyze JavaScript files
    if [ -d "$BUILD_DIR" ]; then
        log_info "JavaScript bundle analysis:"
        
        # Find JavaScript files and their sizes
        find "$BUILD_DIR" -name "*.js" -type f -exec ls -lh {} \; | awk '{print $5 "\t" $9}' | sort -hr | head -10 | while read -r line; do
            log_info "  $line"
        done
        
        # Find CSS files and their sizes
        CSS_FILES=$(find "$BUILD_DIR" -name "*.css" -type f | wc -l)
        if [ "$CSS_FILES" -gt 0 ]; then
            log_info "CSS files found: $CSS_FILES"
            find "$BUILD_DIR" -name "*.css" -type f -exec ls -lh {} \; | awk '{print $5 "\t" $9}' | sort -hr | head -5 | while read -r line; do
                log_info "  $line"
            done
        fi
    fi
    
    # Check for common optimization issues
    log_info "Checking for optimization opportunities..."
    
    # Large files check
    LARGE_FILES=$(find "$BUILD_DIR" -type f -size +500k 2>/dev/null | wc -l)
    if [ "$LARGE_FILES" -gt 0 ]; then
        log_warning "Found $LARGE_FILES files larger than 500KB"
        find "$BUILD_DIR" -type f -size +500k -exec ls -lh {} \; | head -5 | while read -r line; do
            log_warning "  Large file: $(echo $line | awk '{print $5 "\t" $9}')"
        done
    fi
    
    # Unminified files check (basic)
    if grep -r "console.log" "$BUILD_DIR" --include="*.js" 2>/dev/null | head -1 >/dev/null; then
        log_warning "Found console.log statements in build - check minification"
    fi
}

# Validate build output
validate_build() {
    log_info "Validating build output..."
    
    # Find build directory
    BUILD_DIR=""
    if [ -d "dist" ]; then
        BUILD_DIR="dist"
    elif [ -d "build" ]; then
        BUILD_DIR="build"
    else
        log_error "Build directory not found"
        exit 1
    fi
    
    # Check for essential files
    ESSENTIAL_FILES=("index.html")
    for file in "${ESSENTIAL_FILES[@]}"; do
        if find "$BUILD_DIR" -name "$file" | grep -q "$file"; then
            log_success "Found $file"
        else
            log_warning "$file not found in build output"
        fi
    done
    
    # Check for JavaScript files
    JS_COUNT=$(find "$BUILD_DIR" -name "*.js" | wc -l)
    if [ "$JS_COUNT" -gt 0 ]; then
        log_success "Found $JS_COUNT JavaScript files"
    else
        log_warning "No JavaScript files found in build"
    fi
    
    # Check for CSS files
    CSS_COUNT=$(find "$BUILD_DIR" -name "*.css" | wc -l)
    if [ "$CSS_COUNT" -gt 0 ]; then
        log_success "Found $CSS_COUNT CSS files"
    else
        log_info "No CSS files found (may be inline)"
    fi
    
    # Basic HTML validation
    if find "$BUILD_DIR" -name "*.html" | head -1 | xargs grep -q "<html" 2>/dev/null; then
        log_success "HTML structure validation passed"
    else
        log_warning "HTML structure validation failed"
    fi
}

# Generate build report
generate_build_report() {
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    # Find build directory
    BUILD_DIR=""
    BUILD_SIZE="unknown"
    if [ -d "dist" ]; then
        BUILD_DIR="dist"
        BUILD_SIZE=$(du -sh dist 2>/dev/null | cut -f1 2>/dev/null || echo "unknown")
    elif [ -d "build" ]; then
        BUILD_DIR="build"
        BUILD_SIZE=$(du -sh build 2>/dev/null | cut -f1 2>/dev/null || echo "unknown")
    fi
    
    local report_file="qa/build-report.txt"
    
    cat > "$report_file" << EOF
ScholarMatch Platform Build Report
Generated: $(date)
Build Mode: $BUILD_MODE
Duration: ${DURATION}s

Build Configuration:
- Node Environment: ${NODE_ENV:-development}
- Build Directory: ${BUILD_DIR:-not found}
- Total Build Size: $BUILD_SIZE
- Clean Build: $CLEAN_FIRST
- Bundle Analysis: $ANALYZE_BUNDLE

Build Assets:
$([ -n "$BUILD_DIR" ] && find "$BUILD_DIR" -type f -name "*.js" -o -name "*.css" -o -name "*.html" | head -20)

Performance Metrics:
- Build Time: ${DURATION}s
- JavaScript Files: $([ -n "$BUILD_DIR" ] && find "$BUILD_DIR" -name "*.js" | wc -l || echo "0")
- CSS Files: $([ -n "$BUILD_DIR" ] && find "$BUILD_DIR" -name "*.css" | wc -l || echo "0")
- HTML Files: $([ -n "$BUILD_DIR" ] && find "$BUILD_DIR" -name "*.html" | wc -l || echo "0")
- Total Files: $([ -n "$BUILD_DIR" ] && find "$BUILD_DIR" -type f | wc -l || echo "0")

Optimization Status:
- Minification: $([ -n "$BUILD_DIR" ] && (grep -r "console.log" "$BUILD_DIR" --include="*.js" >/dev/null 2>&1 && echo "Partial" || echo "Applied") || echo "Unknown")
- Large Files (>500KB): $([ -n "$BUILD_DIR" ] && find "$BUILD_DIR" -type f -size +500k | wc -l || echo "0")
EOF
    
    log_info "Build report saved to $report_file"
}

# Test build output (basic)
test_build() {
    log_info "Testing build output..."
    
    # Find build directory
    BUILD_DIR=""
    if [ -d "dist" ]; then
        BUILD_DIR="dist"
    elif [ -d "build" ]; then
        BUILD_DIR="build"
    else
        log_warning "Build directory not found - skipping tests"
        return
    fi
    
    # Test HTML files are valid
    html_files=$(find "$BUILD_DIR" -name "*.html")
    if [ -n "$html_files" ]; then
        for html_file in $html_files; do
            if grep -q "<html\|<HTML" "$html_file"; then
                log_success "HTML file validation passed: $(basename "$html_file")"
            else
                log_warning "HTML file validation failed: $(basename "$html_file")"
            fi
        done
    fi
    
    # Test JavaScript files are not empty
    js_files=$(find "$BUILD_DIR" -name "*.js" | head -5)
    if [ -n "$js_files" ]; then
        for js_file in $js_files; do
            if [ -s "$js_file" ]; then
                log_success "JavaScript file validation passed: $(basename "$js_file")"
            else
                log_error "JavaScript file is empty: $(basename "$js_file")"
                exit 1
            fi
        done
    fi
}

# Main build function
main() {
    echo
    log_info "=== ScholarMatch Platform Build Process ==="
    echo
    
    parse_arguments "$1"
    
    # Clean if requested
    [ "$CLEAN_FIRST" = true ] && clean_build
    
    # Run build process
    check_dependencies
    run_pre_build_checks
    run_build
    validate_build
    
    # Analysis and testing
    [ "$ANALYZE_BUNDLE" = true ] && analyze_build
    test_build
    
    # Generate report
    generate_build_report
    
    echo
    log_success "=== Build completed successfully! ==="
    
    # Show next steps
    BUILD_DIR=""
    if [ -d "dist" ]; then
        BUILD_DIR="dist"
    elif [ -d "build" ]; then
        BUILD_DIR="build"
    fi
    
    if [ -n "$BUILD_DIR" ]; then
        log_info "Build output is ready in: $BUILD_DIR"
        log_info "Next steps:"
        log_info "1. Test the build: ./qa/scripts/run.sh --serve"
        log_info "2. Deploy: Copy $BUILD_DIR contents to your web server"
    fi
    echo
}

# Run main function
main "$@"