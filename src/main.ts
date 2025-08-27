import { writeConfiguration, writeFileTemplate } from './scripts/writeFileUtil';
import { templates, languages } from '../config.json';
import { readTemplate } from './templates/util';
import { ProjectConfig } from './types';

export { localizeMessage } from './scripts/localizeMessage';

const config: ProjectConfig = { templates, languages };


if (config.templates.length === 0) {
    throw new Error('No templates found');
}

if (config.languages.length === 0) {
    throw new Error('No languages found');
}

const validateHTML = async (templateContent: string): Promise<void> => {
    const validator = require('html-validator');
    const options = {
        data: templateContent,
        format: 'text',
    };
    try {
        const result = await validator(options);
        console.log(result);
    } catch (error) {
        console.error('HTML validation error:', error);
    }
};

const generateTemplates = async (): Promise<void> => {
    for (const template of config.templates) {
        console.log(`Internationalizing: ${template.name}.html`);
        const templateContent = readTemplate(template.name);
        await validateHTML(templateContent);
        writeFileTemplate(template.name, templateContent);
        writeConfiguration(template);
        console.log(`Internationalized: ${template.name}.html DONE`);
    }
};

const main = (): void => {
    console.log('Starting internationalization process...');
    generateTemplates()
        .then(() => console.log('All internationalization completed successfully!'))
        .catch((error) => {
            console.error('Internationalization failed:', error);
            process.exit(1);
        });
};

main();

