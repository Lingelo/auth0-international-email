import { ValidationResult } from '../interfaces/Template';
import { ValidationConfiguration } from '../interfaces/Config';
import { Logger } from '../../utils/Logger';

export interface ValidationRule {
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  validate(content: string, context?: ValidationContext): Promise<ValidationResult[]>;
}

export interface ValidationContext {
  templateName?: string;
  language?: string;
  variables?: Record<string, unknown>;
}

export class ValidationService {
  private readonly rules = new Map<string, ValidationRule>();
  private readonly logger: Logger;
  private readonly config: ValidationConfiguration;

  constructor(config: ValidationConfiguration, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.initializeBuiltInRules();
  }

  addRule(rule: ValidationRule): void {
    this.rules.set(rule.name, rule);
    this.logger.debug(`Added validation rule: ${rule.name}`);
  }

  removeRule(ruleName: string): void {
    this.rules.delete(ruleName);
    this.logger.debug(`Removed validation rule: ${ruleName}`);
  }

  async validateContent(
    content: string, 
    type: 'html' | 'liquid' | 'translation',
    context?: ValidationContext
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const applicableRules = this.getApplicableRules(type);

    for (const rule of applicableRules) {
      try {
        const ruleResults = await rule.validate(content, context);
        results.push(...ruleResults);
      } catch (error) {
        this.logger.error(`Validation rule ${rule.name} failed`, { error, context });
        results.push({
          type: 'error',
          message: `Validation rule ${rule.name} encountered an error`,
          rule: rule.name
        });
      }
    }

    this.logger.debug(`Validation completed for ${type}`, {
      rulesCount: applicableRules.length,
      errorsCount: results.filter(r => r.type === 'error').length,
      warningsCount: results.filter(r => r.type === 'warning').length
    });

    return results;
  }

  async validateTranslations(
    translations: Map<string, string>,
    referenceKeys: string[]
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    if (this.config.translations.checkMissing) {
      for (const key of referenceKeys) {
        if (!translations.has(key)) {
          results.push({
            type: 'error',
            message: `Missing translation for key: ${key}`,
            rule: 'missing-translation'
          });
        }
      }
    }

    if (this.config.translations.checkUnused) {
      for (const key of translations.keys()) {
        if (!referenceKeys.includes(key)) {
          results.push({
            type: 'warning',
            message: `Unused translation key: ${key}`,
            rule: 'unused-translation'
          });
        }
      }
    }

    if (this.config.translations.checkDuplicates) {
      const values = Array.from(translations.values());
      const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
      
      for (const duplicate of [...new Set(duplicates)]) {
        results.push({
          type: 'warning',
          message: `Duplicate translation value: "${duplicate}"`,
          rule: 'duplicate-translation'
        });
      }
    }

    return results;
  }

  getAvailableRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  private getApplicableRules(type: 'html' | 'liquid' | 'translation'): ValidationRule[] {
    const allRules = Array.from(this.rules.values());
    
    switch (type) {
      case 'html':
        return this.config.html.enabled ? 
          allRules.filter(rule => rule.name.startsWith('html-') || rule.name.startsWith('security-')) : 
          [];
      case 'liquid':
        return this.config.liquid.enabled ? 
          allRules.filter(rule => rule.name.startsWith('liquid-') || rule.name.startsWith('security-')) : 
          [];
      case 'translation':
        return allRules.filter(rule => rule.name.startsWith('translation-'));
      default:
        return [];
    }
  }

  private initializeBuiltInRules(): void {
    // Security rules
    this.addRule({
      name: 'security-no-script-tags',
      description: 'Prevents script tags in templates',
      severity: 'error',
      validate: async (content: string): Promise<ValidationResult[]> => {
        const results: ValidationResult[] = [];
        if (content.includes('<script')) {
          results.push({
            type: 'error',
            message: 'Script tags are not allowed in email templates',
            rule: 'security-no-script-tags'
          });
        }
        return results;
      }
    });

    this.addRule({
      name: 'security-no-dangerous-js',
      description: 'Prevents dangerous JavaScript functions',
      severity: 'error',
      validate: async (content: string): Promise<ValidationResult[]> => {
        const results: ValidationResult[] = [];
        const dangerousFunctions = ['eval(', 'Function(', 'setTimeout(', 'setInterval('];
        
        for (const func of dangerousFunctions) {
          if (content.includes(func)) {
            results.push({
              type: 'error',
              message: `Dangerous function ${func} is not allowed`,
              rule: 'security-no-dangerous-js'
            });
          }
        }
        return results;
      }
    });

    // HTML rules
    this.addRule({
      name: 'html-doctype',
      description: 'Ensures HTML documents have DOCTYPE',
      severity: 'warning',
      validate: async (content: string): Promise<ValidationResult[]> => {
        const results: ValidationResult[] = [];
        if (!content.includes('<!DOCTYPE html>')) {
          results.push({
            type: 'warning',
            message: 'Missing DOCTYPE declaration',
            rule: 'html-doctype'
          });
        }
        return results;
      }
    });

    this.addRule({
      name: 'html-lang-attribute',
      description: 'Ensures HTML tag has lang attribute',
      severity: 'warning',
      validate: async (content: string): Promise<ValidationResult[]> => {
        const results: ValidationResult[] = [];
        const htmlTagMatch = content.match(/<html[^>]*>/);
        if (htmlTagMatch && !htmlTagMatch[0].includes('lang=')) {
          results.push({
            type: 'warning',
            message: 'HTML tag should have lang attribute',
            rule: 'html-lang-attribute'
          });
        }
        return results;
      }
    });

    // Liquid template rules
    this.addRule({
      name: 'liquid-valid-localization',
      description: 'Validates localization function calls',
      severity: 'error',
      validate: async (content: string): Promise<ValidationResult[]> => {
        const results: ValidationResult[] = [];
        const localizationCalls = content.match(/\$\{localizeMessage\([^)]*\)\}/g) || [];
        const validationRegex = /\$\{localizeMessage\(['"`]([^'"`]+)['"`]\)\}/g;
        
        for (const call of localizationCalls) {
          validationRegex.lastIndex = 0;
          if (!validationRegex.test(call)) {
            results.push({
              type: 'error',
              message: `Invalid localization call: ${call}`,
              rule: 'liquid-valid-localization'
            });
          }
        }
        return results;
      }
    });

    this.logger.info(`Initialized ${this.rules.size} built-in validation rules`);
  }
}