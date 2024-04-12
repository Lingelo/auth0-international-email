import { languages } from "../../config.json"
import { getRootPath } from "../templates/util";


const loadLanguageJson = (language: string) => require(`${getRootPath()}/languages/${language}.json`);

const messageByLanguage = (messageKey: string, languageJson: string, language: string) => {
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

const createLanguageCondition = (messageKey: string, language: string, conditionType: ConditionType) => {
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
    }
};

export const localizeMessage = (messageKey: string) => {
    const [firstLanguage, ...restLanguages] = languages;
    const firstCondition = createLanguageCondition(messageKey, firstLanguage, ConditionType.FIRST);
    const middleConditions = restLanguages.map((language) =>
        createLanguageCondition(messageKey, language, ConditionType.MIDDLE)
    );
    const defaultCondition = createLanguageCondition(messageKey, firstLanguage, ConditionType.LAST);

    return [firstCondition, ...middleConditions, defaultCondition].join("\n");
};

// The parameter localizeMessage is required for evaluating the string.
export function evaluateWithLocalizeMessage(content, localizeMessage) {
  try {
    // Using eval to evaluate the string and execute the JavaScript code.
    return eval('`' + content + '`');
  } catch (error) {
    console.error('Erreur lors de l\'évaluation du contenu :', error);
    return null;
  }
}

