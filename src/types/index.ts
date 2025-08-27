export interface TemplateConfig {
  name: string;
  from: string;
  subjectKey: string;
  enabled: boolean;
}

export interface ProjectConfig {
  templates: TemplateConfig[];
  languages: string[];
}

export interface LanguageTranslations {
  [key: string]: string;
}

export interface A0DeployConfig {
  body: string;
  enabled: boolean;
  from: string;
  subject: string;
  syntax: 'liquid';
  template: string;
}

export type LocaleCode = string;

export interface LocalizationContext {
  messageKey: string;
  languages: LocaleCode[];
  translations: Record<LocaleCode, LanguageTranslations>;
}
