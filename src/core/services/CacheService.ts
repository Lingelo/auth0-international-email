import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../../utils/Logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  maxSize?: number; // Max cache size in MB
  directory?: string; // Directory for disk cache
  strategy?: 'memory' | 'disk' | 'hybrid';
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  size: number;
}

export class CacheService {
  private readonly memoryCache = new Map<string, CacheEntry<unknown>>();
  private readonly logger: Logger;
  private readonly options: Required<CacheOptions>;
  private currentMemorySize = 0;

  constructor(logger: Logger, options: CacheOptions = {}) {
    this.logger = logger;
    this.options = {
      ttl: options.ttl ?? 3600, // 1 hour default
      maxSize: options.maxSize ?? 50, // 50MB default
      directory: options.directory ?? path.join(process.cwd(), '.cache'),
      strategy: options.strategy ?? 'memory'
    };

    if (this.options.strategy !== 'memory') {
      this.initializeDiskCache();
    }

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    // Try memory cache first
    if (this.options.strategy !== 'disk') {
      const memoryEntry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
      if (memoryEntry && (now - memoryEntry.timestamp) < (memoryEntry.ttl * 1000)) {
        this.logger.debug(`Cache hit (memory): ${key}`);
        return memoryEntry.data;
      }
      
      if (memoryEntry) {
        this.memoryCache.delete(key);
        this.currentMemorySize -= memoryEntry.size;
      }
    }

    // Try disk cache for hybrid/disk strategies
    if (this.options.strategy !== 'memory') {
      try {
        const diskEntry = await this.getDiskEntry<T>(key);
        if (diskEntry && (now - diskEntry.timestamp) < (diskEntry.ttl * 1000)) {
          this.logger.debug(`Cache hit (disk): ${key}`);
          
          // For hybrid strategy, also store in memory
          if (this.options.strategy === 'hybrid') {
            this.setMemoryEntry(key, diskEntry.data, diskEntry.ttl);
          }
          
          return diskEntry.data;
        }
      } catch (error) {
        this.logger.warn(`Failed to read from disk cache: ${key}`, { error });
      }
    }

    this.logger.debug(`Cache miss: ${key}`);
    return null;
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const actualTtl = ttl ?? this.options.ttl;
    const dataSize = this.calculateSize(data);

    try {
      // Store in memory for memory/hybrid strategies
      if (this.options.strategy !== 'disk') {
        this.setMemoryEntry(key, data, actualTtl);
      }

      // Store on disk for disk/hybrid strategies
      if (this.options.strategy !== 'memory') {
        await this.setDiskEntry(key, data, actualTtl);
      }

      this.logger.debug(`Cache set: ${key}`, { ttl: actualTtl, size: dataSize });
    } catch (error) {
      this.logger.error(`Failed to set cache entry: ${key}`, { error });
    }
  }

  async delete(key: string): Promise<void> {
    // Remove from memory
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      this.memoryCache.delete(key);
      this.currentMemorySize -= memoryEntry.size;
    }

    // Remove from disk
    if (this.options.strategy !== 'memory') {
      try {
        const diskPath = this.getDiskPath(key);
        await fs.remove(diskPath);
      } catch (error) {
        this.logger.warn(`Failed to delete from disk cache: ${key}`, { error });
      }
    }

    this.logger.debug(`Cache deleted: ${key}`);
  }

  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    this.currentMemorySize = 0;

    // Clear disk cache
    if (this.options.strategy !== 'memory') {
      try {
        await fs.emptyDir(this.options.directory);
      } catch (error) {
        this.logger.warn('Failed to clear disk cache', { error });
      }
    }

    this.logger.info('Cache cleared');
  }

  getStats(): {
    memoryEntries: number;
    memorySize: number;
    maxSize: number;
    strategy: string;
  } {
    return {
      memoryEntries: this.memoryCache.size,
      memorySize: this.currentMemorySize,
      maxSize: this.options.maxSize * 1024 * 1024, // Convert MB to bytes
      strategy: this.options.strategy
    };
  }

  private setMemoryEntry<T>(key: string, data: T, ttl: number): void {
    const dataSize = this.calculateSize(data);
    const maxSizeBytes = this.options.maxSize * 1024 * 1024;

    // Evict entries if we're approaching the size limit
    while (this.currentMemorySize + dataSize > maxSizeBytes && this.memoryCache.size > 0) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      size: dataSize
    };

    this.memoryCache.set(key, entry);
    this.currentMemorySize += dataSize;
  }

  private async getDiskEntry<T>(key: string): Promise<CacheEntry<T> | null> {
    const diskPath = this.getDiskPath(key);
    
    if (!await fs.pathExists(diskPath)) {
      return null;
    }

    try {
      const content = await fs.readFile(diskPath, 'utf8');
      return JSON.parse(content) as CacheEntry<T>;
    } catch {
      return null;
    }
  }

  private async setDiskEntry<T>(key: string, data: T, ttl: number): Promise<void> {
    const diskPath = this.getDiskPath(key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      size: this.calculateSize(data)
    };

    await fs.ensureDir(path.dirname(diskPath));
    await fs.writeFile(diskPath, JSON.stringify(entry), 'utf8');
  }

  private getDiskPath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.options.directory, `${safeKey}.json`);
  }

  private async initializeDiskCache(): Promise<void> {
    try {
      await fs.ensureDir(this.options.directory);
    } catch (error) {
      this.logger.error('Failed to initialize disk cache directory', { error });
    }
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.memoryCache.get(oldestKey)!;
      this.memoryCache.delete(oldestKey);
      this.currentMemorySize -= entry.size;
      this.logger.debug(`Evicted cache entry: ${oldestKey}`);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if ((now - entry.timestamp) >= (entry.ttl * 1000)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      const entry = this.memoryCache.get(key)!;
      this.memoryCache.delete(key);
      this.currentMemorySize -= entry.size;
    }

    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  private calculateSize(data: unknown): number {
    // Simple size calculation - in production, use a more accurate method
    return JSON.stringify(data).length * 2; // Rough estimate for UTF-16
  }
}