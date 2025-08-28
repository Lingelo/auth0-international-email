# 🚀 Auth0 International Email Template Generator

> Modern, enterprise-grade CLI tool for generating internationalized Auth0 email templates with advanced security, performance, and developer experience features.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Auth0](https://img.shields.io/badge/Auth0-EB5424?style=flat&logo=auth0&logoColor=white)](https://auth0.com/)

## ✨ Features

- 🌍 **Multi-language support** with priority-based fallbacks
- 🔒 **Security-first** with eliminated eval() usage and input validation
- ⚡ **High performance** with parallel processing and intelligent caching
- 🎯 **Interactive CLI** with step-by-step project setup
- 📊 **Comprehensive validation** for templates and translations
- 🔌 **Plugin system** for extensible processing pipelines
- 📈 **Performance monitoring** with detailed metrics
- 🛠️ **Modern architecture** with TypeScript and enterprise patterns

## 🚀 Quick Start

```bash
# Install dependencies
yarn install

# Generate your internationalized templates
yarn generate
```

That's it! Your templates will be generated in `dist/output/` ready for Auth0 deployment.

## 📁 Project Structure

```
src/
├── cli/           # Interactive CLI commands
├── core/          # Core business logic and services  
├── generators/    # Template processing engines
├── languages/     # Translation files (en-US.json, fr-FR.json, etc.)
├── plugins/       # Extensible plugin system
├── templates/     # Source HTML templates
└── utils/         # Utilities and helpers

config.json        # Project configuration
dist/output/       # Generated templates for Auth0
```

## 🎯 Main Commands

| Command | Description |
|---------|-------------|
| `yarn generate` | **Generate all templates** (recommended) |
| `yarn init` | Interactive project setup |
| `yarn validate` | Validate templates and translations |
| `yarn add-language` | Add a new language interactively |
| `yarn watch` | Auto-rebuild on file changes |
| `yarn analyze` | Project analysis and insights |

## 🌍 Language Management

### Adding a New Language

1. **Interactive way** (recommended):
   ```bash
   yarn add-language
   ```
   
   This will show you a list of available languages to choose from, plus configuration options.

2. **Manual way**:
   - Create `src/languages/{locale}.json` with translations
   - Add language to `config.json`:
   ```json
   {
     "code": "de-DE",
     "name": "Deutsch (Deutschland)",
     "enabled": true,
     "priority": 4,
     "fallback": "en-US"
   }
   ```

### Language Configuration

Languages support advanced features:
- **Priority-based ordering** for template generation
- **Fallback chains** for missing translations  
- **Enable/disable** without removing files
- **Metadata** like display names and regions

## 📧 Template Management

### Creating Templates

Templates use `${localizeMessage("key")}` for translations:

```html
<!DOCTYPE html>
<html>
<head>
    <title>${localizeMessage("welcome.subject")}</title>
</head>
<body>
    <h1>${localizeMessage("welcome.title")}</h1>
    <p>${localizeMessage("welcome.content")}</p>
</body>
</html>
```

### Generated Output

Each template generates:
- **HTML file** with Liquid conditionals:
  ```liquid
  {% if user.user_metadata.language == 'fr-FR' %}Bienvenue
  {% elsif user.user_metadata.language == 'en-US' %}Welcome
  {% else %}Welcome{% endif %}
  ```
- **JSON config** for Auth0 deployment with metadata

## ⚙️ Configuration

`config.json` provides comprehensive configuration:

```json
{
  "name": "My Email Templates",
  "templates": [
    {
      "name": "welcome_email",
      "from": "noreply@company.com", 
      "subjectKey": "welcome.subject",
      "enabled": true
    }
  ],
  "languages": [
    {
      "code": "en-US",
      "name": "English (US)",
      "enabled": true,
      "priority": 1,
      "fallback": null
    }
  ],
  "build": {
    "parallel": true,
    "maxWorkers": 4,
    "minify": true
  }
}
```

## 🔧 Development

```bash
# Code quality
yarn lint              # Check code style
yarn lint:fix          # Fix issues automatically
yarn typecheck         # TypeScript validation

# Testing  
yarn test              # Run test suite
yarn test:coverage     # Generate coverage report
```

## 🏗️ Architecture

Built with modern enterprise patterns:

- **Service-oriented architecture** with dependency injection
- **Command pattern** for extensible CLI
- **Factory pattern** for template generators  
- **Plugin system** with lifecycle hooks
- **Multi-strategy caching** (memory/disk/hybrid)
- **Comprehensive error handling** with custom error types

## 🔒 Security Features

- ✅ **No eval() usage** - secure template processing
- ✅ **Input validation** for all user inputs
- ✅ **HTML validation** with security rules
- ✅ **Path sanitization** for file operations
- ✅ **Error boundaries** with proper logging

## 📊 Performance Features

- ⚡ **Parallel processing** with configurable workers
- 🧠 **Intelligent caching** with TTL management  
- 📦 **Lazy loading** of services and templates
- 🗄️ **Memory optimization** with cleanup strategies
- 📈 **Performance monitoring** with detailed metrics

## 🆕 Migration from v1

The new version maintains full backward compatibility:

- ✅ Existing `config.json` works without changes
- ✅ Templates and translations require no updates  
- ✅ Legacy commands continue to work
- ✅ Gradual migration to new features

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes  
4. Add tests if needed
5. Submit a pull request

---

**Built with ❤️ for the Auth0 community**
