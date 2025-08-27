import { localizeMessage } from '../localizeMessage';

// Mock the config import
jest.mock('../../../config.json', () => ({
  languages: ['fr-FR', 'en-US'],
  templates: []
}));

// Mock the getRootPath function
jest.mock('../../templates/util', () => ({
  getRootPath: () => '/mock/path'
}));

// Mock language files
const mockFrTranslations = {
  'welcome.subject': 'Bienvenue',
  'welcome.hello': 'Bonjour'
};

const mockEnTranslations = {
  'welcome.subject': 'Welcome',
  'welcome.hello': 'Hello'
};

jest.mock('/mock/path/languages/fr-FR.json', () => mockFrTranslations, { virtual: true });
jest.mock('/mock/path/languages/en-US.json', () => mockEnTranslations, { virtual: true });

describe('localizeMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate correct Liquid template for multiple languages', () => {
    const result = localizeMessage('welcome.subject');
    
    expect(result).toContain("{% if user.user_metadata.language == 'fr-FR' %}Bienvenue");
    expect(result).toContain("{% elsif user.user_metadata.language == 'en-US' %}Welcome");
    expect(result).toContain("{% else %}Bienvenue{% endif %}");
  });

  it('should handle single translation key correctly', () => {
    const result = localizeMessage('welcome.hello');
    
    expect(result).toContain('Bonjour');
    expect(result).toContain('Hello');
    expect(result).toMatch(/{% if.*%}.*{% elsif.*%}.*{% else %}.*{% endif %}/s);
  });

  it('should throw error for missing translation key', () => {
    expect(() => {
      localizeMessage('non.existent.key');
    }).toThrow('Message not found for key: non.existent.key');
  });
});