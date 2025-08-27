import { Logger } from '../utils/Logger';
import { PluginConfiguration } from '../core/interfaces/Config';
import { PluginError } from '../core/errors/AppErrors';

export interface Plugin {
  name: string;
  version: string;
  description: string;
  logger?: Logger;
  initialize?(options: Record<string, unknown>): Promise<void>;
  beforeBuild?(context: PluginContext): Promise<PluginHookResult | void>;
  afterBuild?(context: PluginContext): Promise<PluginHookResult | void>;
  beforeValidation?(context: PluginContext): Promise<PluginHookResult | void>;
  afterValidation?(context: PluginContext): Promise<PluginHookResult | void>;
  beforeTemplateProcess?(context: PluginContext): Promise<PluginHookResult | void>;
  afterTemplateProcess?(context: PluginContext): Promise<PluginHookResult | void>;
  cleanup?(): Promise<void>;
}

export interface PluginContext {
  templateName?: string;
  language?: string;
  content?: string;
  outputPath?: string;
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface PluginHookResult {
  continue: boolean;
  modifiedContext?: Partial<PluginContext>;
  errors?: string[];
  warnings?: string[];
}

export class PluginManager {
  private readonly plugins = new Map<string, Plugin>();
  private readonly enabledPlugins = new Set<string>();
  private readonly pluginOrder = new Map<string, number>();
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async loadPlugins(pluginConfigs: PluginConfiguration[]): Promise<void> {
    this.logger.info(`Loading ${pluginConfigs.length} plugins`);

    // Sort plugins by dependencies
    const sortedConfigs = this.sortPluginsByDependencies(pluginConfigs);

    for (const config of sortedConfigs) {
      if (config.enabled) {
        try {
          await this.loadPlugin(config);
        } catch (error) {
          this.logger.error(`Failed to load plugin: ${config.name}`, { error });
          throw new PluginError(
            config.name,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    }

    this.logger.info(`Successfully loaded ${this.enabledPlugins.size} plugins`);
  }

  registerPlugin(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new PluginError(plugin.name, 'Plugin already registered');
    }

    this.plugins.set(plugin.name, plugin);
    this.logger.debug(`Registered plugin: ${plugin.name} v${plugin.version}`);
  }

  enablePlugin(name: string): void {
    if (!this.plugins.has(name)) {
      throw new PluginError(name, 'Plugin not registered');
    }

    this.enabledPlugins.add(name);
    this.logger.debug(`Enabled plugin: ${name}`);
  }

  disablePlugin(name: string): void {
    this.enabledPlugins.delete(name);
    this.logger.debug(`Disabled plugin: ${name}`);
  }

  async executeHook<T extends keyof Plugin>(
    hookName: T,
    context: PluginContext = {}
  ): Promise<PluginHookResult> {
    const results: PluginHookResult = {
      continue: true,
      errors: [],
      warnings: [],
    };

    const enabledPluginsList = this.getOrderedEnabledPlugins();

    for (const pluginName of enabledPluginsList) {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) continue;

      const hookFunction = plugin[hookName] as Function | undefined;
      if (typeof hookFunction !== 'function') continue;

      try {
        this.logger.debug(`Executing ${String(hookName)} hook for plugin: ${pluginName}`);

        const hookResult = await hookFunction.call(plugin, context);

        // Handle hook results
        if (hookResult && typeof hookResult === 'object') {
          if (hookResult.continue === false) {
            results.continue = false;
            this.logger.info(`Plugin ${pluginName} stopped execution chain`);
            break;
          }

          if (hookResult.modifiedContext) {
            Object.assign(context, hookResult.modifiedContext);
            results.modifiedContext = { ...results.modifiedContext, ...hookResult.modifiedContext };
          }

          if (hookResult.errors) {
            results.errors!.push(...hookResult.errors);
          }

          if (hookResult.warnings) {
            results.warnings!.push(...hookResult.warnings);
          }
        }
      } catch (error) {
        const errorMessage = `Plugin ${pluginName} failed during ${String(hookName)} hook`;
        this.logger.error(errorMessage, { error });
        results.errors!.push(
          `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`
        );

        // Continue with other plugins unless it's a critical error
        if (error instanceof PluginError) {
          results.continue = false;
          break;
        }
      }
    }

    return results;
  }

  async initializePlugins(): Promise<void> {
    const enabledPluginsList = this.getOrderedEnabledPlugins();

    for (const pluginName of enabledPluginsList) {
      const plugin = this.plugins.get(pluginName);
      if (!plugin?.initialize) continue;

      try {
        this.logger.debug(`Initializing plugin: ${pluginName}`);
        await plugin.initialize({});
      } catch (error) {
        this.logger.error(`Failed to initialize plugin: ${pluginName}`, { error });
        throw new PluginError(pluginName, error instanceof Error ? error.message : String(error));
      }
    }
  }

  async cleanupPlugins(): Promise<void> {
    const enabledPluginsList = this.getOrderedEnabledPlugins().reverse(); // Cleanup in reverse order

    for (const pluginName of enabledPluginsList) {
      const plugin = this.plugins.get(pluginName);
      if (!plugin?.cleanup) continue;

      try {
        this.logger.debug(`Cleaning up plugin: ${pluginName}`);
        await plugin.cleanup();
      } catch (error) {
        this.logger.warn(`Failed to cleanup plugin: ${pluginName}`, { error });
        // Don't throw during cleanup, just warn
      }
    }
  }

  getPluginInfo(): Array<{
    name: string;
    version: string;
    description: string;
    enabled: boolean;
  }> {
    return Array.from(this.plugins.values()).map((plugin) => ({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      enabled: this.enabledPlugins.has(plugin.name),
    }));
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  isPluginEnabled(name: string): boolean {
    return this.enabledPlugins.has(name);
  }

  private async loadPlugin(config: PluginConfiguration): Promise<void> {
    // In a real implementation, this would load plugins from files or npm packages
    // For now, we'll register built-in plugins
    const builtInPlugins = await this.getBuiltInPlugins();

    const plugin = builtInPlugins.get(config.name);
    if (!plugin) {
      throw new PluginError(config.name, 'Plugin not found');
    }

    this.registerPlugin(plugin);
    this.enablePlugin(config.name);

    if (plugin.initialize) {
      await plugin.initialize(config.options || {});
    }
  }

  private sortPluginsByDependencies(configs: PluginConfiguration[]): PluginConfiguration[] {
    // Simple topological sort based on runBefore/runAfter
    const sorted: PluginConfiguration[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const configMap = new Map(configs.map((c) => [c.name, c]));

    const visit = (config: PluginConfiguration) => {
      if (visiting.has(config.name)) {
        throw new PluginError(config.name, 'Circular dependency detected');
      }

      if (visited.has(config.name)) {
        return;
      }

      visiting.add(config.name);

      // Process dependencies (runAfter)
      if (config.runAfter) {
        for (const dep of config.runAfter) {
          const depConfig = configMap.get(dep);
          if (depConfig && depConfig.enabled) {
            visit(depConfig);
          }
        }
      }

      visiting.delete(config.name);
      visited.add(config.name);
      sorted.push(config);
    };

    for (const config of configs) {
      if (config.enabled) {
        visit(config);
      }
    }

    return sorted;
  }

  private getOrderedEnabledPlugins(): string[] {
    return Array.from(this.enabledPlugins).sort((a, b) => {
      const orderA = this.pluginOrder.get(a) || 0;
      const orderB = this.pluginOrder.get(b) || 0;
      return orderA - orderB;
    });
  }

  private async getBuiltInPlugins(): Promise<Map<string, Plugin>> {
    const plugins = new Map<string, Plugin>();

    // HTML Validator Plugin
    plugins.set('html-validator', {
      name: 'html-validator',
      version: '1.0.0',
      description: 'Validates HTML templates using html-validator',

      async beforeValidation(context: PluginContext) {
        if (context.content) {
          this.logger?.debug('HTML validator plugin: validating content');
          // In a real implementation, this would use the html-validator library
          // For now, we'll just log that validation would happen here
        }
      },
    });

    // Minification Plugin
    plugins.set('minifier', {
      name: 'minifier',
      version: '1.0.0',
      description: 'Minifies HTML templates',

      async afterTemplateProcess(context: PluginContext) {
        if (context.content) {
          this.logger?.debug('Minifier plugin: minifying content');
          // Simple minification (in real implementation, use proper HTML minifier)
          const minified = context.content.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

          return {
            continue: true,
            modifiedContext: { content: minified },
          };
        }
      },
    });

    // Asset Optimization Plugin
    plugins.set('asset-optimizer', {
      name: 'asset-optimizer',
      version: '1.0.0',
      description: 'Optimizes CSS and inline assets',

      async afterTemplateProcess(context: PluginContext) {
        if (context.content) {
          this.logger?.debug('Asset optimizer plugin: optimizing assets');
          // In a real implementation, this would optimize CSS, compress images, etc.
        }
      },
    });

    // Analytics Plugin
    plugins.set('analytics', {
      name: 'analytics',
      version: '1.0.0',
      description: 'Collects build analytics and metrics',

      async beforeBuild(context: PluginContext) {
        this.logger?.info('Analytics plugin: starting build tracking');
      },

      async afterBuild(context: PluginContext) {
        this.logger?.info('Analytics plugin: build completed');
        // Would collect and send analytics data
      },
    });

    return plugins;
  }
}
