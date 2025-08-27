export interface TemplateMetadata {
  name: string;
  from: string;
  subjectKey: string;
  enabled: boolean;
  version?: string;
  tags?: string[];
  lastModified?: Date;
}

export interface ProcessedTemplate {
  content: string;
  metadata: TemplateMetadata;
  processedAt: Date;
  processingTime: number;
  validationResults: ValidationResult[];
}

export interface ValidationResult {
  type: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  rule?: string;
}

export interface TemplateContext {
  template: TemplateMetadata;
  variables: Record<string, unknown>;
  language: string;
  renderingOptions?: RenderingOptions;
}

export interface RenderingOptions {
  minify?: boolean;
  preserveComments?: boolean;
  inlineStyles?: boolean;
  validateOutput?: boolean;
}

export interface TemplateProcessor {
  process(template: TemplateMetadata, context: TemplateContext): Promise<ProcessedTemplate>;
  validate(content: string): Promise<ValidationResult[]>;
  supports(templateType: string): boolean;
}