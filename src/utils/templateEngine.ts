/**
 * Secure template engine that replaces eval() with a safer alternative
 */
export class TemplateEngine {
  private readonly localizeFunctionRegex = /\$\{localizeMessage\(['"`]([^'"`]+)['"`]\)\}/g;

  /**
   * Process template content by replacing localization calls with their values
   */
  processTemplate(content: string, localizeFunction: (key: string) => string): string {
    return content.replace(this.localizeFunctionRegex, (match, key) => {
      try {
        return localizeFunction(key);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Template processing error for key "${key}":`, error);
        return `[MISSING: ${key}]`;
      }
    });
  }

  /**
   * Validate template content for security issues
   */
  validateTemplate(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for potential script injections
    if (content.includes('<script')) {
      errors.push('Template contains script tags which are not allowed');
    }

    // Check for eval or similar dangerous functions
    if (content.includes('eval(') || content.includes('Function(')) {
      errors.push('Template contains dangerous JavaScript functions');
    }

    // Check for properly formatted localization calls - create a new regex for validation
    const validationRegex = /\$\{localizeMessage\(['"`]([^'"`]+)['"`]\)\}/g;
    const allCalls = content.match(/\$\{localizeMessage\([^)]*\)\}/g) || [];
    const invalidCalls = allCalls.filter((call) => {
      validationRegex.lastIndex = 0; // Reset regex
      return !validationRegex.test(call);
    });

    if (invalidCalls.length > 0) {
      errors.push(`Invalid localization calls found: ${invalidCalls.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
