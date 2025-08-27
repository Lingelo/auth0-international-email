import { Logger } from './Logger';
import { performance } from 'perf_hooks';
import * as os from 'os';

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
}

export interface WorkerPoolOptions {
  maxWorkers?: number;
  taskTimeout?: number;
  idleTimeout?: number;
}

export class PerformanceMonitor {
  private readonly metrics = new Map<string, PerformanceMetrics>();
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  startTimer(label: string): void {
    const startTime = performance.now();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.metrics.set(label, {
      startTime,
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed / 1024 / 1024, // MB
        heapTotal: memoryUsage.heapTotal / 1024 / 1024, // MB
        external: memoryUsage.external / 1024 / 1024, // MB
        rss: memoryUsage.rss / 1024 / 1024, // MB
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
    });

    this.logger.debug(`Performance timer started: ${label}`);
  }

  endTimer(label: string): PerformanceMetrics | null {
    const metric = this.metrics.get(label);
    if (!metric) {
      this.logger.warn(`No timer found for label: ${label}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    const endMemoryUsage = process.memoryUsage();
    const endCpuUsage = process.cpuUsage();

    const completedMetric: PerformanceMetrics = {
      ...metric,
      endTime,
      duration,
      memoryUsage: {
        ...metric.memoryUsage,
        heapUsed: endMemoryUsage.heapUsed / 1024 / 1024,
        heapTotal: endMemoryUsage.heapTotal / 1024 / 1024,
        external: endMemoryUsage.external / 1024 / 1024,
        rss: endMemoryUsage.rss / 1024 / 1024,
      },
      cpuUsage: {
        user: endCpuUsage.user - metric.cpuUsage!.user,
        system: endCpuUsage.system - metric.cpuUsage!.system,
      },
    };

    this.metrics.set(label, completedMetric);

    this.logger.debug(`Performance timer ended: ${label}`, {
      duration: `${duration.toFixed(2)}ms`,
      memoryDelta: `${(completedMetric.memoryUsage.heapUsed - metric.memoryUsage.heapUsed).toFixed(2)}MB`,
    });

    return completedMetric;
  }

  getMetric(label: string): PerformanceMetrics | null {
    return this.metrics.get(label) || null;
  }

  getAllMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  clearMetrics(): void {
    this.metrics.clear();
    this.logger.debug('Performance metrics cleared');
  }

  async measureAsync<T>(label: string, asyncFn: () => Promise<T>): Promise<T> {
    this.startTimer(label);
    try {
      const result = await asyncFn();
      return result;
    } finally {
      this.endTimer(label);
    }
  }

  measure<T>(label: string, syncFn: () => T): T {
    this.startTimer(label);
    try {
      const result = syncFn();
      return result;
    } finally {
      this.endTimer(label);
    }
  }

  getSystemInfo(): {
    platform: string;
    arch: string;
    cpus: number;
    memory: number;
    nodeVersion: string;
    uptime: number;
  } {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: os.totalmem() / 1024 / 1024 / 1024, // GB
      nodeVersion: process.version,
      uptime: process.uptime(),
    };
  }
}

export class WorkerPool {
  private workers: Array<{ id: number; busy: boolean; process?: any }> = [];
  private taskQueue: Array<{
    task: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private readonly maxWorkers: number;
  private readonly logger: Logger;
  private readonly options: WorkerPoolOptions;

  constructor(logger: Logger, options: WorkerPoolOptions = {}) {
    this.logger = logger;
    this.options = {
      maxWorkers: options.maxWorkers || os.cpus().length,
      taskTimeout: options.taskTimeout || 30000, // 30 seconds
      idleTimeout: options.idleTimeout || 60000, // 1 minute
    };
    this.maxWorkers = this.options.maxWorkers!;
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  async executeBatch<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const promises = tasks.map((task) => this.execute(task));
    return Promise.all(promises);
  }

  async executeParallel<T>(
    items: T[],
    processor: (item: T, index: number) => Promise<any>,
    options: { batchSize?: number; maxConcurrency?: number } = {}
  ): Promise<any[]> {
    const batchSize = options.batchSize || items.length;
    const maxConcurrency = options.maxConcurrency || this.maxWorkers;

    const results: any[] = [];

    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchTasks = batch.map((item, index) => () => processor(item, i + index));

      // Limit concurrency within batch
      const concurrentTasks: Promise<any>[] = [];
      for (let j = 0; j < batchTasks.length; j += maxConcurrency) {
        const concurrentBatch = batchTasks.slice(j, j + maxConcurrency);
        const promises = concurrentBatch.map((task) => this.execute(task));
        concurrentTasks.push(...promises);
      }

      const batchResults = await Promise.all(concurrentTasks);
      results.push(...batchResults);
    }

    return results;
  }

  getStats(): {
    activeWorkers: number;
    maxWorkers: number;
    queueLength: number;
    totalProcessed: number;
  } {
    return {
      activeWorkers: this.workers.filter((w) => w.busy).length,
      maxWorkers: this.maxWorkers,
      queueLength: this.taskQueue.length,
      totalProcessed: 0, // Would track this in real implementation
    };
  }

  async shutdown(): Promise<void> {
    // Wait for current tasks to complete
    while (this.taskQueue.length > 0 || this.workers.some((w) => w.busy)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Clean up workers
    this.workers = [];
    this.logger.info('Worker pool shut down');
  }

  private async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0) {
      return;
    }

    // Find available worker or create new one
    let worker = this.workers.find((w) => !w.busy);

    if (!worker && this.workers.length < this.maxWorkers) {
      worker = { id: this.workers.length, busy: false };
      this.workers.push(worker);
    }

    if (!worker) {
      // No available workers, task will wait in queue
      return;
    }

    const queuedTask = this.taskQueue.shift();
    if (!queuedTask) {
      return;
    }

    worker.busy = true;

    try {
      const result = await Promise.race([
        queuedTask.task(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Task timeout')), this.options.taskTimeout!)
        ),
      ]);

      queuedTask.resolve(result);
    } catch (error) {
      queuedTask.reject(error);
    } finally {
      worker.busy = false;
      // Process next task if available
      setImmediate(() => this.processQueue());
    }
  }
}

export class Debouncer {
  private timeouts = new Map<string, NodeJS.Timeout>();

  debounce(key: string, fn: () => void, delay: number): void {
    // Clear existing timeout
    const existingTimeout = this.timeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      fn();
      this.timeouts.delete(key);
    }, delay);

    this.timeouts.set(key, timeout);
  }

  cancel(key: string): void {
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
  }

  cancelAll(): void {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }
}

export class Throttler {
  private lastExecutions = new Map<string, number>();

  throttle(key: string, fn: () => void, delay: number): void {
    const now = Date.now();
    const lastExecution = this.lastExecutions.get(key) || 0;

    if (now - lastExecution >= delay) {
      fn();
      this.lastExecutions.set(key, now);
    }
  }

  reset(key?: string): void {
    if (key) {
      this.lastExecutions.delete(key);
    } else {
      this.lastExecutions.clear();
    }
  }
}

export function createPerformanceOptimizedProcessor<T, R>(
  processor: (item: T) => Promise<R>,
  options: {
    maxConcurrency?: number;
    batchSize?: number;
    timeout?: number;
    retries?: number;
    logger?: Logger;
  } = {}
) {
  const {
    maxConcurrency = os.cpus().length,
    batchSize = 10,
    timeout = 30000,
    retries = 2,
    logger,
  } = options;

  return async (items: T[]): Promise<R[]> => {
    const results: R[] = [];
    const semaphore = new Array(maxConcurrency).fill(null);

    const processItem = async (item: T, attempt = 0): Promise<R> => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Processing timeout')), timeout)
        );

        return await Promise.race([processor(item), timeoutPromise]);
      } catch (error) {
        if (attempt < retries) {
          logger?.warn(`Retrying item processing (attempt ${attempt + 1}/${retries})`, { error });
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000)); // Exponential backoff
          return processItem(item, attempt + 1);
        }
        throw error;
      }
    };

    // Process items in batches with controlled concurrency
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map((item) => processItem(item));

      // Wait for current batch to complete before starting next
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger?.error('Item processing failed', { error: result.reason });
          // Could push null or skip failed items based on requirements
        }
      }
    }

    return results;
  };
}
