# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Auth0 international email template generator - a modern, enterprise-grade system for generating localized HTML email templates with Liquid template syntax for Auth0's managed email system. The project has been completely modernized with a service-oriented architecture, comprehensive CLI tooling, and enterprise features.

## Architecture Overview

The system follows a modern layered architecture:

### 🏗️ Core Layer (`src/core/`)
- **Interfaces** (`interfaces/`): TypeScript interfaces for configuration, templates, and language management
- **Services** (`services/`): Business logic services with dependency injection
  - `TemplateService`: Template loading, processing, and validation
  - `I18nService`: Internationalization with translation catalogs and fallbacks
  - `CacheService`: Multi-strategy caching (memory, disk, hybrid)
  - `ValidationService`: Template and translation validation

### 🎯 Generators (`src/generators/`)
- **Factory Pattern**: `GeneratorFactory` creates appropriate generators based on template type
- **Base Generator**: Abstract base class with common functionality
- **Liquid Generator**: Specialized for Auth0 Liquid template processing
- **Template Engine**: Secure template processing (replaces unsafe eval() usage)

### 🖥️ CLI System (`src/cli/`)
- **Interactive Commands**: Full CLI application with comprehensive command system
- **Command Pattern**: Extensible command architecture with proper help system
- **Available Commands**:
  - `init`: Interactive project setup with inquirer prompts
  - `build`: Build and generate internationalized templates
  - `validate`: Comprehensive validation of templates and translations
  - `add-language`: Add new languages to project
  - `analyze`: Project analysis and performance insights

### 🔌 Plugin System (`src/plugins/`)
- **Extensible Architecture**: Hook-based plugin system with lifecycle management
- **Built-in Plugins**: HTML validator, minifier, asset optimizer, analytics
- **Custom Plugins**: Easy integration for custom processing steps

### 🛠️ Utilities (`src/utils/`)
- **Logger**: Comprehensive logging with multiple output formats
- **FileSystem**: Enhanced file operations with caching and error handling
- **Performance**: Monitoring, profiling, and optimization tools
- **ConfigLoader**: Advanced configuration management with validation

### Key Components

- **Main CLI** (`src/main.ts`): Entry point for the CLI application with command routing
- **Localization Engine** (`src/scripts/localizeMessage.ts`): Converts translation keys to Liquid conditionals with language priority support
- **Template Engine** (`src/utils/templateEngine.ts`): Secure, regex-based template processing
- **Configuration Management**: Type-safe configuration with comprehensive validation

### Translation Flow

Templates use `${localizeMessage("welcome.subject")}` which gets converted to Liquid conditionals:
```liquid
{% if user.user_metadata.language == 'fr-FR' %}Bienvenue
{% elsif user.user_metadata.language == 'en-US' %}Welcome
{% else %}Welcome{% endif %}
```

## Configuration

**`config.json`** drives the entire system with comprehensive configuration options:

### Core Configuration
- `name`, `version`: Project metadata
- `templates`: Array of template configurations with metadata, preprocessing, and variables
- `languages`: Advanced language configuration with priority, fallbacks, and enabled status
- `build`: Build settings including parallel processing, workers, minification
- `validation`: HTML, Liquid, and translation validation rules
- `plugins`: Configurable plugin pipeline with dependencies
- `cache`: Multi-strategy caching configuration
- `monitoring`: Performance and metrics collection

### Language Configuration
Languages now support advanced features:
```json
{
  "code": "fr-FR",
  "name": "Français (France)", 
  "enabled": true,
  "priority": 2,
  "fallback": "en-US"
}
```

## Development Commands

### 🚀 Main Commands (Recommended)
```bash
# Install dependencies
yarn install

# Generate templates (build + process + output)
yarn generate

# Interactive project setup
yarn init

# Development with auto-rebuild
yarn dev              # Same as yarn generate
yarn start            # Same as yarn generate
yarn watch            # Auto-rebuild on file changes
```

### 🔧 Advanced CLI Commands
```bash
# Comprehensive validation
yarn validate
yarn validate:templates
yarn validate:translations

# Language management
yarn add-language

# Project analysis and insights
yarn analyze
```

### 🛠️ Build Commands
```bash
# Build TypeScript and copy assets
yarn build

# Clean build directory
yarn clean
```

### Code Quality
```bash
yarn lint              # ESLint + Prettier checking
yarn lint:fix          # Fix linting and formatting issues  
yarn format            # Format code with Prettier
yarn format:check      # Check code formatting
yarn typecheck         # TypeScript type checking
```

### Testing
```bash
yarn test              # Run all tests
yarn test:watch        # Run tests in watch mode
yarn test:coverage     # Generate coverage report
```

The build process:
1. Compiles TypeScript to `dist/`
2. Copies language JSON files to `dist/languages/`
3. Copies HTML templates to `dist/templates/`

## Generated Output

Final templates appear in `dist/output/` with:
- Localized HTML files for each template
- `a0deploy` configuration files for Auth0 deployment

## Adding New Content

**New Language:**
1. Create `src/languages/{locale}.json` with translation keys
2. Add locale code to `config.json` `languages` array

**New Template:**
1. Add `.html` file to `src/templates/`
2. Use `${localizeMessage("key")}` for translatable content  
3. Register in `config.json` `templates` array with metadata and processing options

## Modern Architecture Features

### ✨ Enterprise Features
- **Service-oriented architecture** with dependency injection
- **Plugin system** with hooks and lifecycle management
- **Multi-strategy caching** (memory, disk, hybrid)
- **Comprehensive validation** for templates and translations
- **Performance monitoring** with metrics collection
- **Interactive CLI** with step-by-step guidance
- **Type-safe configuration** with comprehensive validation
- **Security enhancements** (removed eval(), added validation)

### 🚀 Performance Optimizations
- **Parallel processing** with configurable worker pools  
- **Intelligent caching** with TTL and size management
- **Lazy loading** of services and templates
- **Memory optimization** with cleanup strategies
- **Build optimization** with source maps and minification

### 🔒 Security Improvements
- **Eliminated eval() usage** with secure template processing
- **Input validation** for all user inputs and configurations
- **HTML validation** with security rules (no script tags, etc.)
- **Path sanitization** for file operations
- **Error boundaries** with proper error handling

## Migration from Legacy System

The new architecture maintains backward compatibility:
- Existing `config.json` is automatically migrated
- Legacy commands (`yarn generate`) continue to work
- Templates and translations require no changes
- Gradual migration to new CLI features is supported

Use `yarn init` to set up new projects with the modern architecture.

## Current State After Modernization

### ✅ Completed Enhancements
- **Dead code cleanup**: Removed legacy scripts, redundant types, and conflicting dependencies
- **GitHub Actions CI/CD**: Comprehensive workflows with security audit, multi-node testing, and quality gates
- **Test coverage**: Basic test suite for core components (TemplateEngine, CLI, Config)
- **Path corrections**: Fixed all build paths from `dist/src/main.js` to `dist/main.js`
- **Modern architecture**: Full service-oriented architecture with enterprise patterns

### 🚀 Ready to Use Commands
```bash
yarn generate              # ⭐ Primary command - builds and generates all templates
yarn init                  # Interactive project setup
yarn validate              # Comprehensive validation
yarn add-language          # Interactive language management
yarn analyze               # Project insights
yarn test                  # Run test suite
yarn lint                  # Code quality checks
```

### 🏗️ CI/CD Pipeline
The project includes a comprehensive GitHub Actions pipeline:
- **Security audit** as first step (`yarn audit --level moderate`)
- **Multi-node testing** (Node.js 16, 18, 20)
- **Quality gates**: TypeScript, linting, tests, build validation
- **Automated releases** on version tags with artifact packaging

### 📊 Testing Strategy
Current test coverage includes:
- `templateEngine.test.ts`: Template processing and security validation
- `cli.test.ts`: CLI command registration and help system
- `config.test.ts`: Configuration structure validation