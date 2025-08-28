import { TemplateEngine } from '../utils/templateEngine';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe('processTemplate', () => {
    it('should process localizeMessage calls correctly', () => {
      const template = 'Hello ${localizeMessage("welcome.greeting")}!';
      const mockLocalizeFunction = (key: string) => {
        if (key === 'welcome.greeting') return 'World';
        return `[MISSING: ${key}]`;
      };

      const result = engine.processTemplate(template, mockLocalizeFunction);
      expect(result).toBe('Hello World!');
    });

    it('should handle multiple localization calls', () => {
      const template = '${localizeMessage("title")} - ${localizeMessage("subtitle")}';
      const mockLocalizeFunction = (key: string) => {
        const translations: { [key: string]: string } = {
          title: 'Welcome',
          subtitle: 'Auth0 Templates',
        };
        return translations[key] || `[MISSING: ${key}]`;
      };

      const result = engine.processTemplate(template, mockLocalizeFunction);
      expect(result).toBe('Welcome - Auth0 Templates');
    });

    it('should handle missing translation keys gracefully', () => {
      const template = '${localizeMessage("missing.key")}';
      const mockLocalizeFunction = (key: string) => {
        throw new Error(`Key not found: ${key}`);
      };

      const result = engine.processTemplate(template, mockLocalizeFunction);
      expect(result).toBe('[MISSING: missing.key]');
    });

    it('should handle different quote styles', () => {
      const template = `\${localizeMessage('single')} \${localizeMessage("double")} \${localizeMessage(\`backtick\`)}`;
      const mockLocalizeFunction = (key: string) => `[${key}]`;

      const result = engine.processTemplate(template, mockLocalizeFunction);
      expect(result).toBe('[single] [double] [backtick]');
    });
  });

  describe('validateTemplate', () => {
    it('should validate clean templates successfully', () => {
      const template = '<h1>${localizeMessage("title")}</h1>';
      const result = engine.validateTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect script tags', () => {
      const template = '<h1>Title</h1><script>alert("xss")</script>';
      const result = engine.validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template contains script tags which are not allowed');
    });

    it('should detect dangerous JavaScript functions', () => {
      const template = 'Hello ${eval("alert(1)")}';
      const result = engine.validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template contains dangerous JavaScript functions');
    });

    it('should detect invalid localization calls', () => {
      const template = '${localizeMessage(variable)} ${localizeMessage("valid")}';
      const result = engine.validateTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Invalid localization calls found/);
    });

    it('should accept properly formatted localization calls', () => {
      const template =
        '${localizeMessage("key1")} ${localizeMessage(\'key2\')} ${localizeMessage(`key3`)}';
      const result = engine.validateTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
