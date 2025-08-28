import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from './Logger';

export interface FileStats {
  size: number;
  mtime: Date;
  isDirectory: boolean;
  isFile: boolean;
}

export class FileSystemHelper {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.ensureDir(dirPath);
      this.logger.debug(`Ensured directory exists: ${dirPath}`);
    } catch (error) {
      this.logger.error(`Failed to ensure directory: ${dirPath}`, { error });
      throw error;
    }
  }

  async readTextFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
    try {
      const content = await fs.readFile(filePath, encoding);
      this.logger.debug(`Read file: ${filePath}`, { size: content.length });
      return content;
    } catch (error) {
      this.logger.error(`Failed to read file: ${filePath}`, { error });
      throw error;
    }
  }

  async writeTextFile(
    filePath: string,
    content: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, content, encoding);
      this.logger.debug(`Wrote file: ${filePath}`, { size: content.length });
    } catch (error) {
      this.logger.error(`Failed to write file: ${filePath}`, { error });
      throw error;
    }
  }

  async copyFile(source: string, destination: string): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(destination));
      await fs.copy(source, destination);
      this.logger.debug(`Copied file: ${source} -> ${destination}`);
    } catch (error) {
      this.logger.error(`Failed to copy file: ${source} -> ${destination}`, { error });
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.remove(filePath);
      this.logger.debug(`Deleted file: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${filePath}`, { error });
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      return await fs.pathExists(filePath);
    } catch (error) {
      this.logger.warn(`Error checking if path exists: ${filePath}`, { error });
      return false;
    }
  }

  async getStats(filePath: string): Promise<FileStats | null> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
      };
    } catch (error) {
      this.logger.debug(`Could not get stats for: ${filePath}`, { error });
      return null;
    }
  }

  async listDirectory(
    dirPath: string,
    options: {
      recursive?: boolean;
      includeStats?: boolean;
      filter?: (name: string) => boolean;
    } = {}
  ): Promise<Array<{ name: string; path: string; stats?: FileStats }>> {
    try {
      const items: Array<{ name: string; path: string; stats?: FileStats }> = [];

      if (options.recursive) {
        await this.listDirectoryRecursive(dirPath, '', items, options);
      } else {
        const entries = await fs.readdir(dirPath);

        for (const entry of entries) {
          if (options.filter && !options.filter(entry)) {
            continue;
          }

          const fullPath = path.join(dirPath, entry);
          const item: { name: string; path: string; stats?: FileStats } = {
            name: entry,
            path: fullPath,
          };

          if (options.includeStats) {
            item.stats = (await this.getStats(fullPath)) || undefined;
          }

          items.push(item);
        }
      }

      this.logger.debug(`Listed directory: ${dirPath}`, { count: items.length });
      return items;
    } catch (error) {
      this.logger.error(`Failed to list directory: ${dirPath}`, { error });
      throw error;
    }
  }

  async findFiles(
    basePath: string,
    pattern: RegExp | string,
    options: {
      recursive?: boolean;
      maxDepth?: number;
      includeStats?: boolean;
    } = {}
  ): Promise<Array<{ name: string; path: string; stats?: FileStats }>> {
    const results: Array<{ name: string; path: string; stats?: FileStats }> = [];
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    const search = async (currentPath: string, depth: number) => {
      if (options.maxDepth && depth > options.maxDepth) {
        return;
      }

      const items = await this.listDirectory(currentPath);

      for (const item of items) {
        const stats = await this.getStats(item.path);

        if (stats?.isFile && regex.test(item.name)) {
          const result: { name: string; path: string; stats?: FileStats } = {
            name: item.name,
            path: item.path,
          };
          if (options.includeStats) {
            result.stats = stats;
          }
          results.push(result);
        }

        if (options.recursive && stats?.isDirectory) {
          await search(item.path, depth + 1);
        }
      }
    };

    await search(basePath, 0);

    this.logger.debug(`Found files matching pattern in: ${basePath}`, {
      pattern: pattern.toString(),
      count: results.length,
    });

    return results;
  }

  async emptyDirectory(dirPath: string): Promise<void> {
    try {
      if (await this.exists(dirPath)) {
        await fs.emptyDir(dirPath);
        this.logger.debug(`Emptied directory: ${dirPath}`);
      }
    } catch (error) {
      this.logger.error(`Failed to empty directory: ${dirPath}`, { error });
      throw error;
    }
  }

  calculateDirectorySize(dirPath: string): Promise<number> {
    return this.calculateSizeRecursive(dirPath);
  }

  getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  getAbsolutePath(filePath: string): string {
    return path.resolve(filePath);
  }

  joinPath(...segments: string[]): string {
    return path.join(...segments);
  }

  parseFilePath(filePath: string): {
    dir: string;
    name: string;
    base: string;
    ext: string;
  } {
    return path.parse(filePath);
  }

  private async listDirectoryRecursive(
    basePath: string,
    relativePath: string,
    items: Array<{ name: string; path: string; stats?: FileStats }>,
    options: { includeStats?: boolean; filter?: (name: string) => boolean }
  ): Promise<void> {
    const currentPath = path.join(basePath, relativePath);
    const entries = await fs.readdir(currentPath);

    for (const entry of entries) {
      const entryRelativePath = path.join(relativePath, entry);
      const entryFullPath = path.join(basePath, entryRelativePath);

      if (options.filter && !options.filter(entry)) {
        continue;
      }

      const stats = await this.getStats(entryFullPath);
      const item: { name: string; path: string; stats?: FileStats } = {
        name: entryRelativePath,
        path: entryFullPath,
      };

      if (options.includeStats) {
        item.stats = stats || undefined;
      }

      items.push(item);

      if (stats?.isDirectory) {
        await this.listDirectoryRecursive(basePath, entryRelativePath, items, options);
      }
    }
  }

  private async calculateSizeRecursive(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stats = await fs.stat(fullPath);

        if (stats.isDirectory()) {
          totalSize += await this.calculateSizeRecursive(fullPath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      this.logger.warn(`Error calculating size for: ${dirPath}`, { error });
    }

    return totalSize;
  }
}
