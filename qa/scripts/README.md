# QA Automation Scripts

This directory contains automated scripts for the ScholarMatch Platform QA process.

## Available Scripts

### 🚀 Installation Script
```bash
./qa/scripts/install.sh [--prod|--dev]
```
- Installs dependencies and sets up the environment
- Creates `.env` file with defaults if it doesn't exist
- Verifies installation and runs basic checks
- Sets up database schema if DATABASE_URL is available

### 🧪 Testing Script  
```bash
./qa/scripts/test.sh [--unit|--lint|--integration|--all]
```
- Runs comprehensive test suite including:
  - TypeScript type checking
  - ESLint code quality checks
  - Unit tests (Jest/Vitest)
  - Build process validation
  - Integration tests with server startup
  - Security vulnerability scanning
  - Basic performance checks

### 📝 Linting Script
```bash
./qa/scripts/lint.sh [--fix|--check|--strict]
```
- Comprehensive code quality analysis:
  - ESLint with TypeScript support
  - Prettier formatting
  - Code quality checks (TODO/FIXME comments, console.log usage)
  - Import organization validation
  - Auto-fix support for formatting issues

### 🏗️ Build Script
```bash
./qa/scripts/build.sh [--prod|--dev|--analyze|--clean]
```
- Production and development builds:
  - TypeScript compilation with type checking
  - Bundle optimization and minification
  - Build artifact validation
  - Bundle size analysis
  - Performance optimization checks

### 🖥️ Run Script
```bash
./qa/scripts/run.sh [--dev|--prod|--serve|--debug]
```
- Server execution in different modes:
  - Development mode with hot reloading
  - Production mode with optimized builds
  - Static file serving mode
  - Debug mode with inspector
  - Health checks and port validation

## Usage Examples

### Quick Development Setup
```bash
# Install dependencies and setup environment
./qa/scripts/install.sh

# Run development server
./qa/scripts/run.sh --dev
```

### Full Quality Assurance Check
```bash
# Run complete test suite
./qa/scripts/test.sh --all

# Run linting with auto-fix
./qa/scripts/lint.sh --fix

# Build for production
./qa/scripts/build.sh --prod
```

### Production Deployment
```bash
# Install production dependencies
./qa/scripts/install.sh --prod

# Run comprehensive tests
./qa/scripts/test.sh --all

# Build optimized production bundle
./qa/scripts/build.sh --clean

# Serve production build
./qa/scripts/run.sh --serve
```

## Script Features

### 🎨 Color-coded Output
- **Blue**: Informational messages
- **Green**: Success messages
- **Yellow**: Warnings
- **Red**: Errors

### 📊 Automated Reporting
Each script generates detailed reports saved to the `qa/` directory:
- `qa/test-report.txt` - Test execution summary
- `qa/lint-report.txt` - Code quality analysis
- `qa/build-report.txt` - Build process metrics

### ⚙️ Configuration Management
- Automatic ESLint and Prettier setup
- Environment variable validation
- Dependency management and verification
- Port conflict resolution

### 🛡️ Safety Features
- Pre-flight checks before execution
- Graceful error handling and cleanup
- Signal handling for proper shutdown
- Build artifact validation

## Requirements

- **Node.js**: 18+ recommended
- **npm**: Latest version
- **Bash**: 4.0+ (available on most systems)
- **Optional**: `curl` or `wget` for health checks

## Environment Variables

The scripts automatically load and validate environment variables from `.env`:

```bash
# Required for production
NODE_ENV=production
PORT=5000

# Optional services
OPENAI_API_KEY=your-openai-key
JWT_SECRET=your-jwt-secret-min-32-chars  
DATABASE_URL=postgresql://user:pass@host:port/db

# Agent Bridge (optional)
SHARED_SECRET=your-shared-secret-min-32-chars
COMMAND_CENTER_URL=https://command-center.replit.dev
```

## Troubleshooting

### Common Issues

**Permission Denied**
```bash
chmod +x qa/scripts/*.sh
```

**Port Already in Use**
```bash
# The run script will detect and offer to kill existing processes
./qa/scripts/run.sh --dev
```

**Missing Dependencies**
```bash
# Reinstall everything
./qa/scripts/install.sh
```

**Build Failures**
```bash
# Clean build with analysis
./qa/scripts/build.sh --clean --analyze
```

### Script Exit Codes
- `0`: Success
- `1`: General error or test failures
- `130`: Interrupted by user (Ctrl+C)

## Integration with CI/CD

These scripts are designed to work in CI/CD environments:

```yaml
# Example GitHub Actions usage
- name: Install Dependencies
  run: ./qa/scripts/install.sh --prod

- name: Run Tests
  run: ./qa/scripts/test.sh --all

- name: Build Application
  run: ./qa/scripts/build.sh --prod
```

## Development Workflow

Recommended daily workflow:

1. **Start Development**
   ```bash
   ./qa/scripts/install.sh
   ./qa/scripts/run.sh --dev
   ```

2. **Before Committing**
   ```bash
   ./qa/scripts/lint.sh --fix
   ./qa/scripts/test.sh --all
   ```

3. **Production Deployment**
   ```bash
   ./qa/scripts/build.sh --prod
   ./qa/scripts/test.sh --integration
   ```

## Contributing

When modifying scripts:
1. Test on both local and Replit environments
2. Maintain backward compatibility
3. Update this README with new features
4. Follow existing code style and error handling patterns