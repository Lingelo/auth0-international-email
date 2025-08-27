export interface LanguageDefinition {
  code: string;
  name: string;
  region?: string;
  direction: 'ltr' | 'rtl';
  fallbackLanguage?: string;
  pluralRules?: PluralRule[];
  dateFormat?: string;
  currencyFormat?: string;
}

export interface PluralRule {
  condition: string;
  value: string;
}

export interface TranslationEntry {
  key: string;
  value: string;
  description?: string;
  context?: string;
  pluralForms?: Record<string, string>;
}

export interface TranslationCatalog {
  language: LanguageDefinition;
  entries: Map<string, TranslationEntry>;
  metadata: TranslationMetadata;
}

export interface TranslationMetadata {
  version: string;
  lastModified: Date;
  translatedBy?: string;
  completeness: number; // 0-100%
  reviewStatus: 'draft' | 'reviewed' | 'approved';
}

export interface I18nContext {
  currentLanguage: string;
  fallbackLanguage: string;
  catalogs: Map<string, TranslationCatalog>;
  interpolationOptions?: InterpolationOptions;
}

export interface InterpolationOptions {
  prefix: string;
  suffix: string;
  escapeHtml: boolean;
  allowUnsafeHtml: boolean;
}

export interface TranslationResolver {
  resolve(key: string, context: I18nContext, variables?: Record<string, unknown>): Promise<string>;
  preload(languages: string[]): Promise<void>;
  invalidateCache(language?: string): void;
}