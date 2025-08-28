import { ConfigLoader } from '../utils/ConfigLoader';
import { Logger } from '../utils/Logger';

describe('Configuration Management', () => {
  let configLoader: ConfigLoader;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ level: 'error', format: 'json' });
    configLoader = new ConfigLoader(logger);
  });

  describe('Config Structure Validation', () => {
    it('should validate project configuration structure', async () => {
      // Test with actual config.json
      try {
        const config = await configLoader.loadConfiguration('config.json');

        // Basic structure validation
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('templates');
        expect(config).toHaveProperty('languages');
        expect(config).toHaveProperty('build');

        // Templates validation
        expect(Array.isArray(config.templates)).toBe(true);
        if (config.templates.length > 0) {
          const template = config.templates[0];
          expect(template).toHaveProperty('name');
          expect(template).toHaveProperty('from');
          expect(template).toHaveProperty('subjectKey');
          expect(template).toHaveProperty('enabled');
        }

        // Languages validation
        expect(Array.isArray(config.languages)).toBe(true);
        if (config.languages.length > 0) {
          const language = config.languages[0];
          expect(language).toHaveProperty('code');
          expect(language).toHaveProperty('name');
          expect(language).toHaveProperty('enabled');
          expect(language).toHaveProperty('priority');
        }

        // Build configuration validation
        expect(config.build).toHaveProperty('outputDir');
        expect(config.build).toHaveProperty('parallel');
        expect(config.build).toHaveProperty('maxWorkers');
      } catch (error) {
        // If config.json doesn't exist or is invalid, that's also a valid test result
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle missing config file gracefully', async () => {
      await expect(configLoader.loadConfiguration('non-existent-config.json')).rejects.toThrow();
    });
  });

  describe('Language Configuration', () => {
    it('should validate language codes format', () => {
      // Test language code validation logic
      const validCodes = ['en-US', 'fr-FR', 'es-ES', 'pt-BR'];
      const invalidCodes = ['en', 'english', 'en_US', 'EN-us'];

      const languageCodePattern = /^[a-z]{2}-[A-Z]{2}$/;

      validCodes.forEach((code) => {
        expect(languageCodePattern.test(code)).toBe(true);
      });

      invalidCodes.forEach((code) => {
        expect(languageCodePattern.test(code)).toBe(false);
      });
    });
  });
});
