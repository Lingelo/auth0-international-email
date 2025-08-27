export interface ProjectConfiguration {
  name: string;
  version: string;
  templates: TemplateConfiguration[];
  languages: LanguageConfiguration[];
  build: BuildConfiguration;
  validation: ValidationConfiguration;
  plugins: PluginConfiguration[];
  cache?: CacheConfiguration;
  monitoring?: MonitoringConfiguration;
}

export interface TemplateConfiguration {
  name: string;
  from: string;
  subjectKey: string;
  enabled: boolean;
  path?: string;
  preprocessors?: string[];
  postprocessors?: string[];
  variables?: Record<string, unknown>;
}

export interface LanguageConfiguration {
  code: string;
  name: string;
  path?: string;
  fallback?: string;
  enabled: boolean;
  priority: number;
}

export interface BuildConfiguration {
  outputDir: string;
  cleanOutput: boolean;
  parallel: boolean;
  maxWorkers?: number;
  sourceMaps: boolean;
  minify: boolean;
  watch?: boolean;
}

export interface ValidationConfiguration {
  html: {
    enabled: boolean;
    strict: boolean;
    rules?: Record<string, unknown>;
  };
  liquid: {
    enabled: boolean;
    syntax?: 'strict' | 'loose';
  };
  translations: {
    checkMissing: boolean;
    checkUnused: boolean;
    checkDuplicates: boolean;
  };
}

export interface PluginConfiguration {
  name: string;
  enabled: boolean;
  options?: Record<string, unknown>;
  runBefore?: string[];
  runAfter?: string[];
}

export interface CacheConfiguration {
  enabled: boolean;
  ttl: number; // in seconds
  maxSize: number; // in MB
  strategy: 'memory' | 'disk' | 'hybrid';
  directory?: string;
}

export interface MonitoringConfiguration {
  enabled: boolean;
  collectMetrics: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  outputFormat: 'json' | 'text' | 'structured';
}