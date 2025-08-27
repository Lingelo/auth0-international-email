import * as fs from 'fs-extra';
import * as path from 'path';
import { TemplateMetadata, ProcessedTemplate, TemplateContext, ValidationResult } from '../interfaces/Template';
import { ValidationError, TemplateNotFoundError } from '../errors/AppErrors';
import { Logger } from '../../utils/Logger';
import { CacheService } from './CacheService';

export class TemplateService {
  private readonly logger: Logger;
  private readonly cache: CacheService;
  private readonly templatesPath: string;

  constructor(templatesPath: string, cache: CacheService, logger: Logger) {
    this.templatesPath = templatesPath;
    this.cache = cache;
    this.logger = logger;
  }

  async loadTemplate(templateName: string): Promise<string> {
    const cacheKey = `template:${templateName}`;
    const cached = await this.cache.get<string>(cacheKey);
    
    if (cached) {
      this.logger.debug(`Template ${templateName} loaded from cache`);
      return cached;
    }

    const templatePath = path.join(this.templatesPath, `${templateName}.html`);
    
    if (!await fs.pathExists(templatePath)) {
      throw new TemplateNotFoundError(templateName);
    }

    try {
      const content = await fs.readFile(templatePath, 'utf8');
      await this.cache.set(cacheKey, content);
      this.logger.debug(`Template ${templateName} loaded from disk`);
      return content;
    } catch (error) {
      this.logger.error(`Failed to load template ${templateName}`, { error });
      throw new ValidationError(`Failed to load template: ${templateName}`);
    }
  }

  async validateTemplate(content: string, templateName: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Security validation
    if (content.includes('<script')) {
      results.push({
        type: 'error',
        message: 'Script tags are not allowed in email templates',
        rule: 'no-script-tags'
      });
    }

    if (content.includes('eval(') || content.includes('Function(')) {
      results.push({
        type: 'error',
        message: 'Dangerous JavaScript functions are not allowed',
        rule: 'no-dangerous-js'
      });
    }

    // Template syntax validation
    const localizationCalls = content.match(/\$\{localizeMessage\([^)]*\)\}/g) || [];
    const validationRegex = /\$\{localizeMessage\(['"`]([^'"`]+)['"`]\)\}/g;
    
    for (const call of localizationCalls) {
      validationRegex.lastIndex = 0;
      if (!validationRegex.test(call)) {
        results.push({
          type: 'error',
          message: `Invalid localization call: ${call}`,
          rule: 'valid-localization-call'
        });
      }
    }

    // HTML structure validation
    if (!content.includes('<!DOCTYPE html>')) {
      results.push({
        type: 'warning',
        message: 'Missing DOCTYPE declaration',
        rule: 'html-doctype'
      });
    }

    this.logger.debug(`Template ${templateName} validated`, { 
      errors: results.filter(r => r.type === 'error').length,
      warnings: results.filter(r => r.type === 'warning').length
    });

    return results;
  }

  async processTemplate(template: TemplateMetadata, context: TemplateContext): Promise<ProcessedTemplate> {
    const startTime = Date.now();
    
    try {
      const content = await this.loadTemplate(template.name);
      const validationResults = await this.validateTemplate(content, template.name);
      
      // Check for validation errors that should block processing
      const errors = validationResults.filter(r => r.type === 'error');
      if (errors.length > 0) {
        throw new ValidationError(
          `Template validation failed: ${errors.map(e => e.message).join(', ')}`
        );
      }

      const processingTime = Date.now() - startTime;
      
      return {
        content,
        metadata: template,
        processedAt: new Date(),
        processingTime,
        validationResults
      };
      
    } catch (error) {
      this.logger.error(`Failed to process template ${template.name}`, { error });
      throw error;
    }
  }

  async getTemplateMetadata(templateName: string): Promise<TemplateMetadata | null> {
    try {
      const templatePath = path.join(this.templatesPath, `${templateName}.html`);
      const stats = await fs.stat(templatePath);
      
      return {
        name: templateName,
        from: '', // Will be filled from config
        subjectKey: '', // Will be filled from config
        enabled: true,
        lastModified: stats.mtime
      };
    } catch {
      return null;
    }
  }

  async listTemplates(): Promise<TemplateMetadata[]> {
    try {
      const files = await fs.readdir(this.templatesPath);
      const htmlFiles = files.filter(f => f.endsWith('.html'));
      
      const templates = await Promise.all(
        htmlFiles.map(async (file) => {
          const name = path.basename(file, '.html');
          return this.getTemplateMetadata(name);
        })
      );
      
      return templates.filter((t): t is TemplateMetadata => t !== null);
    } catch (error) {
      this.logger.error('Failed to list templates', { error });
      return [];
    }
  }

  async watchTemplates(callback: (templateName: string, event: 'change' | 'add' | 'remove') => void): Promise<void> {
    // Implementation for file watching would go here
    // Using chokidar or similar for production
    this.logger.info('Template watching is not implemented in this basic version');
  }
}