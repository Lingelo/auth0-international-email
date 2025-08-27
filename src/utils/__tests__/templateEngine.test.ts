import { TemplateEngine } from '../templateEngine';

describe('TemplateEngine', () => {
  let templateEngine: TemplateEngine;

  beforeEach(() => {
    templateEngine = new TemplateEngine();
  });

  describe('processTemplate', () => {
    it('should replace localization calls with function results', () => {
      const content = 'Hello ${localizeMessage("welcome.hello")}, welcome to ${localizeMessage("app.name")}!';
      const mockLocalizeFunction = jest.fn()
        .mockReturnValueOnce('World')
        .mockReturnValueOnce('MyApp');

      const result = templateEngine.processTemplate(content, mockLocalizeFunction);

      expect(result).toBe('Hello World, welcome to MyApp!');
      expect(mockLocalizeFunction).toHaveBeenCalledWith('welcome.hello');
      expect(mockLocalizeFunction).toHaveBeenCalledWith('app.name');
    });

    it('should handle single quotes in localization calls', () => {
      const content = "Title: ${localizeMessage('page.title')}";
      const mockLocalizeFunction = jest.fn().mockReturnValue('Welcome Page');

      const result = templateEngine.processTemplate(content, mockLocalizeFunction);

      expect(result).toBe('Title: Welcome Page');
    });

    it('should handle double quotes in localization calls', () => {
      const content = 'Title: ${localizeMessage("page.title")}';
      const mockLocalizeFunction = jest.fn().mockReturnValue('Welcome Page');

      const result = templateEngine.processTemplate(content, mockLocalizeFunction);

      expect(result).toBe('Title: Welcome Page');
    });

    it('should handle errors gracefully and show missing keys', () => {
      const content = 'Hello ${localizeMessage("missing.key")}!';
      const mockLocalizeFunction = jest.fn().mockImplementation(() => {
        throw new Error('Translation not found');
      });

      const result = templateEngine.processTemplate(content, mockLocalizeFunction);

      expect(result).toBe('Hello [MISSING: missing.key]!');
    });
  });

  describe('validateTemplate', () => {
    it('should validate clean templates as valid', () => {
      const content = '<p>Hello ${localizeMessage("welcome.hello")}</p>';
      
      const result = templateEngine.validateTemplate(content);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect script tags as security issue', () => {
      const content = '<p>Hello</p><script>alert("xss")</script>';
      
      const result = templateEngine.validateTemplate(content);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template contains script tags which are not allowed');
    });

    it('should detect eval calls as security issue', () => {
      const content = '<p>${eval("malicious code")}</p>';
      
      const result = templateEngine.validateTemplate(content);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template contains dangerous JavaScript functions');
    });

    it('should detect invalid localization calls', () => {
      const content = '<p>${localizeMessage(variable)}</p>';
      
      const result = templateEngine.validateTemplate(content);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid localization calls found');
    });
  });
});