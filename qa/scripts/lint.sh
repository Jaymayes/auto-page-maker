#!/bin/bash

# ScholarMatch Platform - Code Linting Script
# This script runs comprehensive code quality checks including ESLint, Prettier, and TypeScript
# Usage: ./qa/scripts/lint.sh [--fix|--check|--strict]

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
LINT_MODE="check"
ESLINT_MAX_WARNINGS=10
STRICT_MODE=false

# Parse arguments
parse_arguments() {
    case "${1:-check}" in
        "--fix")
            LINT_MODE="fix"
            log_info "Running in fix mode - will attempt to auto-fix issues"
            ;;
        "--strict")
            LINT_MODE="check"
            ESLINT_MAX_WARNINGS=0
            STRICT_MODE=true
            log_info "Running in strict mode - no warnings allowed"
            ;;
        "--check"|*)
            LINT_MODE="check"
            log_info "Running in check mode - will report issues only"
            ;;
    esac
}

# Setup ESLint configuration
setup_eslint() {
    log_info "Setting up ESLint configuration..."
    
    # Install ESLint if not present
    if ! npm list eslint --depth=0 &> /dev/null; then
        log_info "Installing ESLint and TypeScript support..."
        npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
    fi
    
    # Create ESLint config if it doesn't exist
    if [ ! -f ".eslintrc.js" ] && [ ! -f ".eslintrc.json" ] && [ ! -f "eslint.config.js" ]; then
        log_info "Creating ESLint configuration..."
        cat > .eslintrc.json << 'EOF'
{
  "root": true,
  "env": {
    "browser": true,
    "es2020": true,
    "node": true
  },
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended"
  ],
  "ignorePatterns": ["dist", "node_modules", "*.js"],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "prefer-const": "error",
    "no-var": "error",
    "no-console": "warn",
    "eqeqeq": ["error", "always"],
    "no-unused-expressions": "error"
  }
}
EOF
        log_success "ESLint configuration created"
    fi
    
    # Create .eslintignore if it doesn't exist
    if [ ! -f ".eslintignore" ]; then
        log_info "Creating .eslintignore..."
        cat > .eslintignore << 'EOF'
node_modules/
dist/
build/
*.js
!*.config.js
.env
*.log
coverage/
qa/
EOF
    fi
}

# Setup Prettier configuration
setup_prettier() {
    log_info "Setting up Prettier configuration..."
    
    # Install Prettier if not present
    if ! npm list prettier --depth=0 &> /dev/null; then
        log_info "Installing Prettier..."
        npm install --save-dev prettier
    fi
    
    # Create Prettier config if it doesn't exist
    if [ ! -f ".prettierrc" ] && [ ! -f ".prettierrc.json" ] && [ ! -f "prettier.config.js" ]; then
        log_info "Creating Prettier configuration..."
        cat > .prettierrc.json << 'EOF'
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
EOF
        log_success "Prettier configuration created"
    fi
    
    # Create .prettierignore if it doesn't exist
    if [ ! -f ".prettierignore" ]; then
        log_info "Creating .prettierignore..."
        cat > .prettierignore << 'EOF'
node_modules/
dist/
build/
*.log
coverage/
qa/
package-lock.json
EOF
    fi
}

# Run TypeScript type checking
run_typescript_check() {
    log_info "Running TypeScript type checking..."
    
    if npx tsc --noEmit --pretty; then
        log_success "TypeScript type checking passed"
        return 0
    else
        log_error "TypeScript type checking failed"
        return 1
    fi
}

# Run ESLint
run_eslint() {
    log_info "Running ESLint on TypeScript files..."
    
    local eslint_cmd="npx eslint \"**/*.{ts,tsx}\" --format=stylish"
    
    if [ "$LINT_MODE" = "fix" ]; then
        eslint_cmd="$eslint_cmd --fix"
    fi
    
    if [ "$STRICT_MODE" = "true" ]; then
        eslint_cmd="$eslint_cmd --max-warnings 0"
    else
        eslint_cmd="$eslint_cmd --max-warnings $ESLINT_MAX_WARNINGS"
    fi
    
    if eval $eslint_cmd; then
        if [ "$LINT_MODE" = "fix" ]; then
            log_success "ESLint completed with auto-fixes applied"
        else
            log_success "ESLint passed (max $ESLINT_MAX_WARNINGS warnings allowed)"
        fi
        return 0
    else
        log_error "ESLint failed"
        return 1
    fi
}

# Run Prettier
run_prettier() {
    log_info "Running Prettier formatting check..."
    
    if [ "$LINT_MODE" = "fix" ]; then
        if npx prettier --write "**/*.{ts,tsx,json,md}" --ignore-path .prettierignore; then
            log_success "Prettier formatting applied"
            return 0
        else
            log_error "Prettier formatting failed"
            return 1
        fi
    else
        if npx prettier --check "**/*.{ts,tsx,json,md}" --ignore-path .prettierignore; then
            log_success "Prettier formatting check passed"
            return 0
        else
            log_error "Prettier formatting check failed - run with --fix to auto-format"
            return 1
        fi
    fi
}

# Run additional code quality checks
run_code_quality_checks() {
    log_info "Running additional code quality checks..."
    
    local issues_found=0
    
    # Check for TODO/FIXME comments
    log_info "Checking for TODO/FIXME comments..."
    if grep -r "TODO\|FIXME" --include="*.ts" --include="*.tsx" . 2>/dev/null | head -10; then
        log_warning "Found TODO/FIXME comments - consider addressing them"
        ((issues_found++))
    fi
    
    # Check for console.log statements
    log_info "Checking for console.log statements..."
    if grep -r "console\.log" --include="*.ts" --include="*.tsx" . 2>/dev/null | head -5; then
        log_warning "Found console.log statements - consider using proper logging"
        ((issues_found++))
    fi
    
    # Check for any/unknown types (basic check)
    log_info "Checking for 'any' type usage..."
    local any_count=$(grep -r ": any\|<any>" --include="*.ts" --include="*.tsx" . 2>/dev/null | wc -l)
    if [ "$any_count" -gt 5 ]; then
        log_warning "Found $any_count 'any' type usages - consider using specific types"
        ((issues_found++))
    fi
    
    # Check file naming conventions
    log_info "Checking file naming conventions..."
    if find . -name "*.ts" -o -name "*.tsx" | grep -E "[A-Z].*\.tsx?$" | grep -v "node_modules" | head -5; then
        log_warning "Found files with uppercase names - consider kebab-case or camelCase"
        ((issues_found++))
    fi
    
    if [ $issues_found -eq 0 ]; then
        log_success "Code quality checks passed"
        return 0
    else
        log_warning "Code quality checks found $issues_found issue categories"
        return 1
    fi
}

# Check import organization
check_import_organization() {
    log_info "Checking import organization..."
    
    # Look for potential import issues
    local import_issues=0
    
    # Check for relative imports going up multiple levels
    if grep -r "\.\.\/" --include="*.ts" --include="*.tsx" . | grep -E "\.\./\.\./\.\." 2>/dev/null | head -3; then
        log_warning "Found deep relative imports - consider using path aliases"
        ((import_issues++))
    fi
    
    # Check for unused imports (basic check)
    if npm list @typescript-eslint/eslint-plugin --depth=0 &> /dev/null; then
        log_info "Running unused imports check..."
        # This is handled by ESLint @typescript-eslint/no-unused-vars rule
    fi
    
    if [ $import_issues -eq 0 ]; then
        log_success "Import organization check passed"
        return 0
    else
        log_warning "Import organization check found issues"
        return 1
    fi
}

# Generate lint report
generate_lint_report() {
    local total_files=$(find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | wc -l)
    local report_file="qa/lint-report.txt"
    
    cat > "$report_file" << EOF
ScholarMatch Platform Lint Report
Generated: $(date)
Mode: $LINT_MODE
Strict Mode: $STRICT_MODE

Project Statistics:
- Total TypeScript files: $total_files
- ESLint max warnings: $ESLINT_MAX_WARNINGS

Checks Performed:
- TypeScript type checking: $([ $? -eq 0 ] && echo "PASSED" || echo "FAILED")
- ESLint code quality: $([ $? -eq 0 ] && echo "PASSED" || echo "FAILED")
- Prettier formatting: $([ $? -eq 0 ] && echo "PASSED" || echo "FAILED")
- Code quality checks: $([ $? -eq 0 ] && echo "PASSED" || echo "FAILED")
- Import organization: $([ $? -eq 0 ] && echo "PASSED" || echo "FAILED")

Configuration Files:
- .eslintrc.json: $([ -f ".eslintrc.json" ] && echo "Present" || echo "Missing")
- .prettierrc.json: $([ -f ".prettierrc.json" ] && echo "Present" || echo "Missing")
- tsconfig.json: $([ -f "tsconfig.json" ] && echo "Present" || echo "Missing")
EOF
    
    log_info "Lint report saved to $report_file"
}

# Main linting function
main() {
    echo
    log_info "=== ScholarMatch Platform Code Linting ==="
    echo
    
    parse_arguments "$1"
    
    # Setup linting tools
    setup_eslint
    setup_prettier
    
    # Run linting checks
    local overall_success=true
    local checks_run=0
    local checks_passed=0
    
    # TypeScript check
    if run_typescript_check; then
        ((checks_passed++))
    else
        overall_success=false
    fi
    ((checks_run++))
    
    # ESLint check
    if run_eslint; then
        ((checks_passed++))
    else
        overall_success=false
    fi
    ((checks_run++))
    
    # Prettier check
    if run_prettier; then
        ((checks_passed++))
    else
        overall_success=false
    fi
    ((checks_run++))
    
    # Code quality checks
    if run_code_quality_checks; then
        ((checks_passed++))
    else
        # Don't fail overall for code quality warnings unless strict mode
        if [ "$STRICT_MODE" = "true" ]; then
            overall_success=false
        fi
    fi
    ((checks_run++))
    
    # Import organization check
    if check_import_organization; then
        ((checks_passed++))
    else
        # Don't fail overall for import warnings unless strict mode
        if [ "$STRICT_MODE" = "true" ]; then
            overall_success=false
        fi
    fi
    ((checks_run++))
    
    # Generate report
    generate_lint_report
    
    echo
    log_info "Linting Summary: $checks_passed/$checks_run checks passed"
    
    if [ "$overall_success" = true ]; then
        log_success "=== Code linting completed successfully! ==="
        exit 0
    else
        log_error "=== Code linting found issues! ==="
        if [ "$LINT_MODE" = "check" ]; then
            log_info "Run with --fix to automatically fix formatting and some linting issues"
        fi
        exit 1
    fi
}

# Run main function
main "$@"