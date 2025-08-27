import * as fs from 'fs-extra';
import { localizeMessage } from './localizeMessage';
import { TemplateConfig, A0DeployConfig } from '../types';

export const writeFileTemplate = (name: string, content: string): void => {
  try {
    fs.mkdirSync('./dist/output', { recursive: true });
    fs.writeFileSync(`dist/output/${name}.html`, content, {
      encoding: 'utf8',
    });
  } catch (err) {
    console.error('Error writing template file:', err);
    throw err;
  }
};

export const writeConfiguration = (template: TemplateConfig): void => {
  try {
    const content: A0DeployConfig = {
      body: `./${template.name}.html`,
      enabled: template.enabled,
      from: template.from,
      subject: localizeMessage(template.subjectKey),
      syntax: 'liquid',
      template: template.name,
    };
    fs.mkdirSync('./dist/output', { recursive: true });
    fs.writeFileSync(`dist/output/${template.name}.json`, JSON.stringify(content, null, 2), {
      encoding: 'utf8',
    });
  } catch (err) {
    console.error('Error writing configuration file:', err);
    throw err;
  }
};
