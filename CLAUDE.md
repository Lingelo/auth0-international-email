# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Auth0 template generator for internationalizing managed email templates. The project generates localized HTML email templates with Liquid template syntax for Auth0's managed email system.

## Core Architecture

The system follows a three-part structure:

1. **Language Management** (`src/languages/`): JSON files containing translations keyed by locale codes (e.g., `en-US.json`, `fr-FR.json`)
2. **Template Processing** (`src/templates/`): HTML templates with translation placeholders using `${localizeMessage("key")}` syntax
3. **Generation Pipeline** (`src/scripts/`): Converts templates into multi-locale Liquid templates with conditional blocks

### Key Components

- **Main Generator** (`src/main.ts`): Orchestrates the entire generation process, validates HTML, and processes all configured templates
- **Localization Engine** (`src/scripts/localizeMessage.ts`): Core logic that converts translation keys into Liquid conditional blocks based on `user.user_metadata.language`
- **Template Engine** (`src/utils/templateEngine.ts`): Secure template processor that replaces unsafe `eval()` usage with regex-based parsing
- **Template Reader** (`src/templates/util.ts`): Handles template file reading with security validation
- **File Writer** (`src/scripts/writeFileUtil.ts`): Outputs generated templates to the `dist/output` directory
- **Type Definitions** (`src/types/index.ts`): TypeScript interfaces for better type safety

### Translation Flow

Templates use `${localizeMessage("welcome.subject")}` which gets converted to Liquid conditionals:
```liquid
{% if user.user_metadata.language == 'fr-FR' %}Bienvenue
{% elsif user.user_metadata.language == 'en-US' %}Welcome
{% else %}Welcome{% endif %}
```

## Configuration

**`config.json`** drives the entire system:
- `templates`: Array defining which HTML templates to process, their metadata, and subject line keys
- `languages`: Array of supported locale codes (first one becomes the default fallback)

## Development Commands

```bash
# Install dependencies
yarn install

# Build TypeScript sources and copy assets
yarn build

# Generate final localized templates
yarn generate

# Clean build directory
yarn clean

# Development workflow (build + generate)
yarn dev

# Code quality
yarn lint              # Check code style
yarn lint:fix          # Fix linting issues
yarn format            # Format code with Prettier
yarn format:check      # Check code formatting
yarn typecheck         # TypeScript type checking

# Testing
yarn test              # Run all tests
yarn test:watch        # Run tests in watch mode
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
3. Register in `config.json` `templates` array with required metadata