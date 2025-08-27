import * as fs from 'fs-extra';
import * as path from 'path';
import { 
  LanguageDefinition, 
  TranslationCatalog, 
  TranslationEntry, 
  I18nContext, 
  TranslationResolver,
  TranslationMetadata
} from '../interfaces/Language';
import { LanguageNotFoundError, TranslationMissingError } from '../errors/AppErrors';
import { Logger } from '../../utils/Logger';
import { CacheService } from './CacheService';

export class I18nService implements TranslationResolver {
  private readonly logger: Logger;
  private readonly cache: CacheService;
  private readonly languagesPath: string;
  private readonly catalogs: Map<string, TranslationCatalog> = new Map();
  private readonly supportedLanguages: Map<string, LanguageDefinition> = new Map();

  constructor(languagesPath: string, cache: CacheService, logger: Logger) {
    this.languagesPath = languagesPath;
    this.cache = cache;
    this.logger = logger;
  }

  async initialize(languages: string[]): Promise<void> {
    this.logger.info('Initializing I18n service', { languages });
    
    for (const languageCode of languages) {
      try {
        await this.loadLanguage(languageCode);
      } catch (error) {
        this.logger.error(`Failed to load language ${languageCode}`, { error });
      }
    }
    
    this.logger.info(`I18n service initialized with ${this.catalogs.size} languages`);
  }

  async loadLanguage(languageCode: string): Promise<TranslationCatalog> {
    const cacheKey = `language:${languageCode}`;
    const cached = await this.cache.get<TranslationCatalog>(cacheKey);
    
    if (cached) {
      this.catalogs.set(languageCode, cached);
      return cached;
    }

    const languagePath = path.join(this.languagesPath, `${languageCode}.json`);
    
    if (!await fs.pathExists(languagePath)) {
      throw new LanguageNotFoundError(languageCode);
    }

    try {
      const content = await fs.readFile(languagePath, 'utf8');
      const translations = JSON.parse(content) as Record<string, string>;
      
      const entries = new Map<string, TranslationEntry>();
      Object.entries(translations).forEach(([key, value]) => {
        entries.set(key, {
          key,
          value,
          description: `Translation for ${key}`
        });
      });

      const stats = await fs.stat(languagePath);
      const catalog: TranslationCatalog = {
        language: this.getLanguageDefinition(languageCode),
        entries,
        metadata: {
          version: '1.0.0',
          lastModified: stats.mtime,
          completeness: this.calculateCompleteness(entries),
          reviewStatus: 'draft'
        }
      };

      this.catalogs.set(languageCode, catalog);
      await this.cache.set(cacheKey, catalog, 3600); // Cache for 1 hour
      
      this.logger.debug(`Language ${languageCode} loaded`, {
        entriesCount: entries.size,
        completeness: catalog.metadata.completeness
      });

      return catalog;
    } catch (error) {
      this.logger.error(`Failed to load language file ${languageCode}`, { error });
      throw new LanguageNotFoundError(languageCode);
    }
  }

  async resolve(
    key: string, 
    context: I18nContext, 
    variables?: Record<string, unknown>
  ): Promise<string> {
    const catalog = this.catalogs.get(context.currentLanguage);
    
    if (!catalog) {
      throw new LanguageNotFoundError(context.currentLanguage);
    }

    const entry = catalog.entries.get(key);
    
    if (!entry) {
      // Try fallback language
      if (context.fallbackLanguage && context.fallbackLanguage !== context.currentLanguage) {
        const fallbackCatalog = this.catalogs.get(context.fallbackLanguage);
        if (fallbackCatalog) {
          const fallbackEntry = fallbackCatalog.entries.get(key);
          if (fallbackEntry) {
            this.logger.warn(`Using fallback translation for key ${key}`, {
              key,
              language: context.currentLanguage,
              fallback: context.fallbackLanguage
            });
            return this.interpolateVariables(fallbackEntry.value, variables);
          }
        }
      }
      
      throw new TranslationMissingError(key, context.currentLanguage);
    }

    return this.interpolateVariables(entry.value, variables);
  }

  async preload(languages: string[]): Promise<void> {
    const loadPromises = languages.map(lang => this.loadLanguage(lang));
    await Promise.all(loadPromises);
    this.logger.info(`Preloaded ${languages.length} languages`);
  }

  invalidateCache(language?: string): void {
    if (language) {
      this.cache.delete(`language:${language}`);
      this.catalogs.delete(language);
    } else {
      // Clear all language caches
      for (const lang of this.catalogs.keys()) {
        this.cache.delete(`language:${lang}`);
      }
      this.catalogs.clear();
    }
    
    this.logger.info('Language cache invalidated', { language });
  }

  getAvailableLanguages(): string[] {
    return Array.from(this.catalogs.keys());
  }

  getLanguageInfo(languageCode: string): TranslationCatalog | undefined {
    return this.catalogs.get(languageCode);
  }

  async analyzeTranslations(): Promise<{
    totalKeys: number;
    languagesCount: number;
    missingTranslations: Array<{ language: string; missingKeys: string[] }>;
    unusedKeys: string[];
  }> {
    const allKeys = new Set<string>();
    const languageKeys = new Map<string, Set<string>>();

    // Collect all keys from all languages
    for (const [language, catalog] of this.catalogs.entries()) {
      const keys = new Set(catalog.entries.keys());
      languageKeys.set(language, keys);
      keys.forEach(key => allKeys.add(key));
    }

    // Find missing translations
    const missingTranslations = [];
    for (const [language, keys] of languageKeys.entries()) {
      const missingKeys = Array.from(allKeys).filter(key => !keys.has(key));
      if (missingKeys.length > 0) {
        missingTranslations.push({ language, missingKeys });
      }
    }

    return {
      totalKeys: allKeys.size,
      languagesCount: this.catalogs.size,
      missingTranslations,
      unusedKeys: [] // Would require template analysis to determine unused keys
    };
  }

  private getLanguageDefinition(languageCode: string): LanguageDefinition {
    // Simple implementation - could be expanded with real language data
    return {
      code: languageCode,
      name: languageCode.toUpperCase(),
      direction: 'ltr'
    };
  }

  private calculateCompleteness(entries: Map<string, TranslationEntry>): number {
    // Simple implementation - returns 100% if all entries have values
    const totalEntries = entries.size;
    const completedEntries = Array.from(entries.values()).filter(e => e.value.trim().length > 0).length;
    return totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0;
  }

  private interpolateVariables(text: string, variables?: Record<string, unknown>): string {
    if (!variables) return text;
    
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : match;
    });
  }
}