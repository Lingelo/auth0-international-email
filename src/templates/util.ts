import * as fs from 'fs';
import { localizeMessage } from '../scripts/localizeMessage';
import { TemplateEngine } from '../utils/templateEngine';
import * as path from 'node:path';

const templateEngine = new TemplateEngine();

export function readTemplate(templateName: string): string {
  const rootPath = getRootPath();
  const content = fs.readFileSync(`${rootPath}/templates/${templateName}.html`, 'utf8');

  // Validate template for security issues
  const validation = templateEngine.validateTemplate(content);
  if (!validation.isValid) {
    throw new Error(
      `Template validation failed for ${templateName}: ${validation.errors.join(', ')}`
    );
  }

  // Use secure template processing instead of eval
  return templateEngine.processTemplate(content, localizeMessage);
}

export function getRootPath(): string {
  let rootPath = __dirname;
  if (rootPath.includes('dist')) {
    rootPath = rootPath.replace('dist/', '');
    return path.dirname(rootPath);
  }
  return rootPath;
}
