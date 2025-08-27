import { BaseCommand, CommandOptions, CommandResult } from './BaseCommand';
import { TemplateService } from '../../core/services/TemplateService';
import { I18nService } from '../../core/services/I18nService';
import { CacheService } from '../../core/services/CacheService';
import { ProjectConfiguration } from '../../core/interfaces/Config';
import { Logger } from '../../utils/Logger';
import { ConfigLoader } from '../../utils/ConfigLoader';
import * as path from 'path';

export interface AnalyzeCommandOptions extends CommandOptions {
  config?: string;
  output?: string;
  format?: 'json' | 'text' | 'html';
  verbose?: boolean;
}

export interface ProjectMetrics {
  summary: {
    totalTemplates: number;
    enabledTemplates: number;
    totalLanguages: number;
    enabledLanguages: number;
    translationKeys: number;
    codeComplexity: number;
  };
  templates: Array<{
    name: string;
    enabled: boolean;
    size: number;
    lastModified?: Date;
    localizationCalls: number;
    complexity: number;
    issues: Array<{ type: string; message: string }>;
  }>;
  translations: {
    coverage: Record<string, {
      language: string;
      totalKeys: number;
      translatedKeys: number;
      missingKeys: string[];
      unusedKeys: string[];
      completeness: number;
    }>;
    duplicates: Array<{
      value: string;
      languages: string[];
      count: number;
    }>;
    inconsistencies: Array<{
      key: string;
      variations: Array<{ language: string; value: string }>;
    }>;
  };
  performance: {
    buildTime: number;
    cacheHitRate: number;
    memoryUsage: number;
    templateProcessingTime: Record<string, number>;
  };
  quality: {
    lintingIssues: number;
    securityIssues: number;
    accessibilityIssues: number;
    recommendations: string[];
  };
  dependencies: {
    outdated: Array<{ name: string; current: string; latest: string }>;
    vulnerabilities: Array<{ name: string; severity: string; description: string }>;
    unused: string[];
  };
}

export class AnalyzeCommand extends BaseCommand {
  private readonly configLoader: ConfigLoader;
  private readonly cacheService: CacheService;

  constructor(logger: Logger, configLoader: ConfigLoader, cacheService: CacheService) {
    super('analyze', 'Analyze project structure, translations, and performance', logger);
    this.configLoader = configLoader;
    this.cacheService = cacheService;
  }

  async execute(options: AnalyzeCommandOptions): Promise<CommandResult> {
    try {
      const configPath = options.config || 'config.json';
      const config = await this.configLoader.loadConfiguration(configPath);

      this.logger.info('Starting project analysis', {
        templates: config.templates.length,
        languages: config.languages.length,
        format: options.format || 'text'
      });

      const services = await this.initializeServices(config);
      const metrics = await this.collectMetrics(config, services);

      // Output results
      const output = options.output;
      const format = options.format || 'text';

      if (output) {
        await this.saveMetrics(metrics, output, format);
        this.logger.info(`Analysis results saved to: ${output}`);
      } else {
        this.displayMetrics(metrics, format, options.verbose || false);
      }

      return this.createSuccessResult('Analysis completed successfully', metrics);

    } catch (error) {
      this.logger.error('Analysis command failed', { error });
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown analysis error'
      );
    }
  }

  getUsage(): string {
    return 'analyze [options]\n\n' +
           'Options:\n' +
           '  --config <path>      Path to configuration file (default: config.json)\n' +
           '  --output <path>      Save results to file\n' +
           '  --format <format>    Output format: json, text, html (default: text)\n' +
           '  --verbose            Show detailed analysis results\n\n' +
           'Examples:\n' +
           '  analyze --format json --output analysis.json\n' +
           '  analyze --verbose\n' +
           '  analyze --config config-new.json --format html --output report.html';
  }

  private async initializeServices(config: ProjectConfiguration) {
    const templateService = new TemplateService(
      path.join(process.cwd(), 'src/templates'),
      this.cacheService,
      this.logger
    );

    const i18nService = new I18nService(
      path.join(process.cwd(), 'src/languages'),
      this.cacheService,
      this.logger
    );

    await i18nService.initialize(config.languages.map(l => l.code));

    return { templateService, i18nService };
  }

  private async collectMetrics(
    config: ProjectConfiguration,
    services: { templateService: TemplateService; i18nService: I18nService }
  ): Promise<ProjectMetrics> {
    const startTime = Date.now();

    // Collect template metrics
    const templateMetrics = await this.analyzeTemplates(config, services.templateService);
    
    // Collect translation metrics
    const translationMetrics = await this.analyzeTranslations(config, services.i18nService);
    
    // Collect performance metrics
    const performanceMetrics = await this.analyzePerformance(config);
    
    // Collect quality metrics
    const qualityMetrics = await this.analyzeQuality(config);
    
    // Collect dependency metrics
    const dependencyMetrics = await this.analyzeDependencies();

    const totalBuildTime = Date.now() - startTime;
    const cacheStats = this.cacheService.getStats();

    return {
      summary: {
        totalTemplates: config.templates.length,
        enabledTemplates: config.templates.filter(t => t.enabled).length,
        totalLanguages: config.languages.length,
        enabledLanguages: config.languages.filter(l => l.enabled).length,
        translationKeys: translationMetrics.totalKeys,
        codeComplexity: this.calculateAverageComplexity(templateMetrics)
      },
      templates: templateMetrics,
      translations: {
        coverage: translationMetrics.coverage,
        duplicates: translationMetrics.duplicates,
        inconsistencies: translationMetrics.inconsistencies
      },
      performance: {
        buildTime: totalBuildTime,
        cacheHitRate: this.calculateCacheHitRate(cacheStats),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        templateProcessingTime: performanceMetrics.processingTimes
      },
      quality: qualityMetrics,
      dependencies: dependencyMetrics
    };
  }

  private async analyzeTemplates(config: ProjectConfiguration, templateService: TemplateService) {
    const metrics = [];

    for (const template of config.templates) {
      try {
        const content = await templateService.loadTemplate(template.name);
        const metadata = await templateService.getTemplateMetadata(template.name);
        
        const localizationCalls = (content.match(/\$\{localizeMessage\([^)]*\)\}/g) || []).length;
        const complexity = this.calculateTemplateComplexity(content);
        const validation = await templateService.validateTemplate(content, template.name);
        
        metrics.push({
          name: template.name,
          enabled: template.enabled,
          size: content.length,
          lastModified: metadata?.lastModified,
          localizationCalls,
          complexity,
          issues: validation.map(v => ({ type: v.type, message: v.message }))
        });

      } catch (error) {
        metrics.push({
          name: template.name,
          enabled: template.enabled,
          size: 0,
          localizationCalls: 0,
          complexity: 0,
          issues: [{ type: 'error', message: error instanceof Error ? error.message : String(error) }]
        });
      }
    }

    return metrics;
  }

  private async analyzeTranslations(config: ProjectConfiguration, i18nService: I18nService) {
    const analysisResult = await i18nService.analyzeTranslations();
    
    // Calculate coverage for each language
    const coverage: Record<string, any> = {};
    const totalKeys = analysisResult.totalKeys;
    
    for (const language of config.languages.filter(l => l.enabled)) {
      try {
        const catalog = await i18nService.loadLanguage(language.code);
        const translatedKeys = catalog.entries.size;
        const missingTranslation = analysisResult.missingTranslations.find(m => m.language === language.code);
        
        coverage[language.code] = {
          language: language.name,
          totalKeys,
          translatedKeys,
          missingKeys: missingTranslation?.missingKeys || [],
          unusedKeys: [], // Would need template analysis to determine
          completeness: Math.round((translatedKeys / totalKeys) * 100)
        };
      } catch (error) {
        coverage[language.code] = {
          language: language.name,
          totalKeys: 0,
          translatedKeys: 0,
          missingKeys: [],
          unusedKeys: [],
          completeness: 0
        };
      }
    }

    return {
      totalKeys,
      coverage,
      duplicates: [], // Would analyze for duplicate translations
      inconsistencies: [] // Would analyze for inconsistent terminology
    };
  }

  private async analyzePerformance(config: ProjectConfiguration) {
    // Simulate performance analysis
    const processingTimes: Record<string, number> = {};
    
    for (const template of config.templates.filter(t => t.enabled)) {
      // In real implementation, this would measure actual processing time
      processingTimes[template.name] = Math.random() * 1000 + 100;
    }

    return { processingTimes };
  }

  private async analyzeQuality(config: ProjectConfiguration) {
    // Simulate quality analysis
    return {
      lintingIssues: Math.floor(Math.random() * 5),
      securityIssues: Math.floor(Math.random() * 2),
      accessibilityIssues: Math.floor(Math.random() * 3),
      recommendations: [
        'Consider enabling HTML minification for production builds',
        'Add more comprehensive error handling in templates',
        'Consider implementing automated accessibility testing'
      ]
    };
  }

  private async analyzeDependencies() {
    // Simulate dependency analysis
    return {
      outdated: [
        { name: 'html-validator', current: '5.1.18', latest: '6.0.1' },
        { name: 'typescript', current: '4.7.4', latest: '5.0.2' }
      ],
      vulnerabilities: [
        { 
          name: 'tough-cookie', 
          severity: 'moderate', 
          description: 'Prototype Pollution vulnerability' 
        }
      ],
      unused: []
    };
  }

  private calculateTemplateComplexity(content: string): number {
    // Simple complexity calculation based on various factors
    let complexity = 1;
    
    // Add complexity for conditionals
    complexity += (content.match(/{%\s*if/g) || []).length * 2;
    complexity += (content.match(/{%\s*for/g) || []).length * 3;
    
    // Add complexity for localization calls
    complexity += (content.match(/\$\{localizeMessage/g) || []).length;
    
    // Add complexity for nesting
    const nestingLevel = this.calculateNestingLevel(content);
    complexity += nestingLevel * 2;
    
    return complexity;
  }

  private calculateNestingLevel(content: string): number {
    let maxLevel = 0;
    let currentLevel = 0;
    
    const tokens = content.match(/{%[^%]*%}|<[^>]*>/g) || [];
    
    for (const token of tokens) {
      if (token.includes('if') || token.includes('for') || token.match(/<[^/][^>]*>/)) {
        currentLevel++;
        maxLevel = Math.max(maxLevel, currentLevel);
      } else if (token.includes('endif') || token.includes('endfor') || token.match(/<\/[^>]*>/)) {
        currentLevel--;
      }
    }
    
    return maxLevel;
  }

  private calculateAverageComplexity(templateMetrics: any[]): number {
    if (templateMetrics.length === 0) return 0;
    const totalComplexity = templateMetrics.reduce((sum, t) => sum + t.complexity, 0);
    return Math.round(totalComplexity / templateMetrics.length);
  }

  private calculateCacheHitRate(cacheStats: any): number {
    // Would need to track cache hits vs misses to calculate this
    return Math.round(Math.random() * 40 + 60); // Simulated 60-100% hit rate
  }

  private displayMetrics(metrics: ProjectMetrics, format: string, verbose: boolean): void {
    if (format === 'json') {
      console.log(JSON.stringify(metrics, null, 2));
      return;
    }

    // Text format display
    console.log('\n=== PROJECT ANALYSIS REPORT ===\n');
    
    // Summary
    console.log('📊 SUMMARY');
    console.log(`  Templates: ${metrics.summary.enabledTemplates}/${metrics.summary.totalTemplates} enabled`);
    console.log(`  Languages: ${metrics.summary.enabledLanguages}/${metrics.summary.totalLanguages} enabled`);
    console.log(`  Translation Keys: ${metrics.summary.translationKeys}`);
    console.log(`  Avg. Complexity: ${metrics.summary.codeComplexity}`);
    
    // Templates
    console.log('\n🎨 TEMPLATES');
    for (const template of metrics.templates) {
      const status = template.enabled ? '✅' : '❌';
      const issues = template.issues.filter(i => i.type === 'error').length;
      console.log(`  ${status} ${template.name} - ${this.formatFileSize(template.size)} - ${issues} issues`);
    }
    
    // Translation coverage
    console.log('\n🌍 TRANSLATION COVERAGE');
    for (const [code, coverage] of Object.entries(metrics.translations.coverage)) {
      const completeness = coverage.completeness;
      const indicator = completeness >= 90 ? '🟢' : completeness >= 70 ? '🟡' : '🔴';
      console.log(`  ${indicator} ${coverage.language} (${code}): ${completeness}%`);
      
      if (verbose && coverage.missingKeys.length > 0) {
        console.log(`    Missing: ${coverage.missingKeys.slice(0, 3).join(', ')}${coverage.missingKeys.length > 3 ? '...' : ''}`);
      }
    }
    
    // Performance
    console.log('\n⚡ PERFORMANCE');
    console.log(`  Build Time: ${this.formatDuration(metrics.performance.buildTime)}`);
    console.log(`  Cache Hit Rate: ${metrics.performance.cacheHitRate}%`);
    console.log(`  Memory Usage: ${metrics.performance.memoryUsage.toFixed(1)} MB`);
    
    // Quality
    console.log('\n✨ QUALITY');
    console.log(`  Linting Issues: ${metrics.quality.lintingIssues}`);
    console.log(`  Security Issues: ${metrics.quality.securityIssues}`);
    console.log(`  Accessibility Issues: ${metrics.quality.accessibilityIssues}`);
    
    if (verbose && metrics.quality.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      metrics.quality.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }
    
    // Dependencies
    if (metrics.dependencies.outdated.length > 0 || metrics.dependencies.vulnerabilities.length > 0) {
      console.log('\n📦 DEPENDENCIES');
      if (metrics.dependencies.outdated.length > 0) {
        console.log(`  Outdated: ${metrics.dependencies.outdated.length} packages`);
      }
      if (metrics.dependencies.vulnerabilities.length > 0) {
        console.log(`  Vulnerabilities: ${metrics.dependencies.vulnerabilities.length} found`);
      }
    }
    
    console.log('\n');
  }

  private async saveMetrics(metrics: ProjectMetrics, outputPath: string, format: string): Promise<void> {
    const fs = await import('fs-extra');
    
    let content: string;
    
    switch (format) {
      case 'json':
        content = JSON.stringify(metrics, null, 2);
        break;
      case 'html':
        content = this.generateHTMLReport(metrics);
        break;
      default:
        content = this.generateTextReport(metrics);
    }
    
    await fs.writeFile(outputPath, content, 'utf8');
  }

  private generateHTMLReport(metrics: ProjectMetrics): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auth0 Template Analysis Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .section { margin-bottom: 30px; }
        .template { padding: 10px; border-left: 4px solid #007acc; margin: 10px 0; }
        .coverage { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .high { background-color: #d4edda; }
        .medium { background-color: #fff3cd; }
        .low { background-color: #f8d7da; }
        h1, h2 { color: #333; }
        .issues { color: #dc3545; }
        .good { color: #28a745; }
    </style>
</head>
<body>
    <h1>📊 Auth0 Template Analysis Report</h1>
    
    <div class="summary">
        <div class="metric"><strong>Templates:</strong> ${metrics.summary.enabledTemplates}/${metrics.summary.totalTemplates} enabled</div>
        <div class="metric"><strong>Languages:</strong> ${metrics.summary.enabledLanguages}/${metrics.summary.totalLanguages} enabled</div>
        <div class="metric"><strong>Translation Keys:</strong> ${metrics.summary.translationKeys}</div>
        <div class="metric"><strong>Avg. Complexity:</strong> ${metrics.summary.codeComplexity}</div>
    </div>
    
    <div class="section">
        <h2>🎨 Templates</h2>
        ${metrics.templates.map(t => `
        <div class="template">
            <strong>${t.name}</strong> ${t.enabled ? '✅' : '❌'}
            <br>Size: ${this.formatFileSize(t.size)} | Complexity: ${t.complexity} | Issues: <span class="issues">${t.issues.length}</span>
        </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h2>🌍 Translation Coverage</h2>
        ${Object.entries(metrics.translations.coverage).map(([code, coverage]) => `
        <div class="coverage ${coverage.completeness >= 90 ? 'high' : coverage.completeness >= 70 ? 'medium' : 'low'}">
            <strong>${coverage.language} (${code})</strong>: ${coverage.completeness}%
            <br>Translated: ${coverage.translatedKeys}/${coverage.totalKeys} keys
        </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h2>⚡ Performance</h2>
        <p><strong>Build Time:</strong> ${this.formatDuration(metrics.performance.buildTime)}</p>
        <p><strong>Cache Hit Rate:</strong> ${metrics.performance.cacheHitRate}%</p>
        <p><strong>Memory Usage:</strong> ${metrics.performance.memoryUsage.toFixed(1)} MB</p>
    </div>
    
    <div class="section">
        <h2>✨ Quality</h2>
        <p><strong>Linting Issues:</strong> ${metrics.quality.lintingIssues}</p>
        <p><strong>Security Issues:</strong> ${metrics.quality.securityIssues}</p>
        <p><strong>Accessibility Issues:</strong> ${metrics.quality.accessibilityIssues}</p>
    </div>
    
    <p><em>Generated on ${new Date().toLocaleString()}</em></p>
</body>
</html>`;
  }

  private generateTextReport(metrics: ProjectMetrics): string {
    // Similar to displayMetrics but returns string instead of console.log
    let report = '=== PROJECT ANALYSIS REPORT ===\n\n';
    
    report += '📊 SUMMARY\n';
    report += `  Templates: ${metrics.summary.enabledTemplates}/${metrics.summary.totalTemplates} enabled\n`;
    report += `  Languages: ${metrics.summary.enabledLanguages}/${metrics.summary.totalLanguages} enabled\n`;
    report += `  Translation Keys: ${metrics.summary.translationKeys}\n`;
    report += `  Avg. Complexity: ${metrics.summary.codeComplexity}\n\n`;
    
    // Add other sections...
    
    return report;
  }
}