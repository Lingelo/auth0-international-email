import { languages } from '../../config.json';
import { getRootPath } from '../templates/util';
import { LanguageTranslations, LocaleCode } from '../types';

const loadLanguageJson = (language: LocaleCode): LanguageTranslations =>
  require(`${getRootPath()}/languages/${language}.json`);

const messageByLanguage = (
  messageKey: string,
  languageJson: LanguageTranslations,
  language: LocaleCode
): string => {
  const message = languageJson[messageKey];
  if (!message) {
    throw new Error(`Message not found for key: ${messageKey} when using language: ${language}`);
  }
  return message;
};

enum ConditionType {
  FIRST,
  LAST,
  MIDDLE,
}

const createLanguageCondition = (
  messageKey: string,
  language: LocaleCode,
  conditionType: ConditionType
): string => {
  const languageJson = loadLanguageJson(language);
  const message = messageByLanguage(messageKey, languageJson, language);
  const firstLanguageCondition = `{% if user.user_metadata.language == '${language}' %}${message}`;
  const defaultLanguageCondition = `{% else %}${message}{% endif %}`;
  const middleLanguageCondition = `{% elsif user.user_metadata.language == '${language}' %}${message}`;

  switch (conditionType) {
    case ConditionType.FIRST:
      return firstLanguageCondition;
    case ConditionType.LAST:
      return defaultLanguageCondition;
    case ConditionType.MIDDLE:
      return middleLanguageCondition;
    default:
      throw new Error(`Unknown condition type: ${conditionType}`);
  }
};

export const localizeMessage = (messageKey: string): string => {
  const [firstLanguage, ...restLanguages] = languages;
  const firstCondition = createLanguageCondition(messageKey, firstLanguage, ConditionType.FIRST);
  const middleConditions = restLanguages.map((language) =>
    createLanguageCondition(messageKey, language, ConditionType.MIDDLE)
  );
  const defaultCondition = createLanguageCondition(messageKey, firstLanguage, ConditionType.LAST);

  return [firstCondition, ...middleConditions, defaultCondition].join('\n');
};

/**
 * DEPRECATED: This function used eval() which is unsafe. Use TemplateEngine instead.
 * @deprecated Use TemplateEngine.processTemplate() for secure template processing
 */
export function evaluateWithLocalizeMessage(
  content: string,
  localizeFunction: (key: string) => string
): string {
  console.warn('WARNING: evaluateWithLocalizeMessage is deprecated. Use TemplateEngine instead.');

  // Secure replacement for eval-based template processing
  const templateRegex = /\$\{localizeMessage\(['"`]([^'"`]+)['"`]\)\}/g;

  return content.replace(templateRegex, (match, key) => {
    try {
      return localizeFunction(key);
    } catch (error) {
      console.error(`Error processing template key "${key}":`, error);
      return `[MISSING: ${key}]`;
    }
  });
}
