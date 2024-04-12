# Auth0 Template Generator

This project enables the translation of managed emails in Auth0 into multiple locales.  
The project is based on the work from this [git repo](https://github.com/pazel-io/auth0-i18n-liquid-template-generator).

## Project Structure

The project revolves around 3 folders:
- **languages**: the list of supported languages
- **scripts**: the code for compiling the templates
- **templates**: the email templates

## Locale Management

A locale is represented by a JSON file named with the locale code such as `fr_FR`.  
To declare a locale:

- Write a JSON locale file (e.g., `fr_FR.json`).
- Add the new locale to the `locales` variable in the `config.json` file.
- *Note:* the first locale declared in the `locales` variable is the default locale.

## Template Management

A template is represented by an .html file in the templates folder.  
To add a new template:

- Add the `.html` file to the templates folder.
- Declare the template in the `config.json` file to include it in the considered templates.

## Translating a Template

In an `.html` file of a template, the resolution of a translation revolves around the function `${localizeMessage("welcome.regards")}` (with the parameter being the key in the associated locale file).
The templates are generated in the `dist/output` folder. The translated `.html` file and the `a0deploy` configuration file are present in the folder.

## Generating Final Files

- Install the project: `yarn install`
- Build the project sources: `yarn build`
- Generate files in the output folder: `yarn generate`
