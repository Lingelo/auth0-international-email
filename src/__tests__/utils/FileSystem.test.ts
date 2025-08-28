import * as fs from 'fs-extra';
import * as path from 'path';
import { FileSystemHelper } from '../../utils/FileSystem';
import { Logger } from '../../utils/Logger';

describe('FileSystemHelper', () => {
  let fileSystem: FileSystemHelper;
  let logger: Logger;
  let testDir: string;

  beforeEach(() => {
    logger = new Logger({ level: 'error', format: 'json' });
    fileSystem = new FileSystemHelper(logger);
    testDir = path.join(__dirname, 'test-files');
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.remove(testDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('directory operations', () => {
    it('should ensure directory exists', async () => {
      const dirPath = path.join(testDir, 'new-dir');
      
      await fileSystem.ensureDirectory(dirPath);
      
      const exists = await fs.pathExists(dirPath);
      expect(exists).toBe(true);
    });

    it('should handle existing directories gracefully', async () => {
      await fs.ensureDir(testDir);
      
      await expect(fileSystem.ensureDirectory(testDir)).resolves.not.toThrow();
    });
  });

  describe('file operations', () => {
    it('should read and write text files', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const content = 'Hello, World!';
      
      await fileSystem.writeTextFile(filePath, content);
      const readContent = await fileSystem.readTextFile(filePath);
      
      expect(readContent).toBe(content);
    });

    it('should handle non-existent files', async () => {
      const filePath = path.join(testDir, 'non-existent.txt');
      
      await expect(fileSystem.readTextFile(filePath)).rejects.toThrow();
    });

    it('should copy files correctly', async () => {
      const sourcePath = path.join(testDir, 'source.txt');
      const destPath = path.join(testDir, 'dest.txt');
      const content = 'Test content';
      
      await fs.ensureDir(testDir);
      await fs.writeFile(sourcePath, content);
      
      await fileSystem.copyFile(sourcePath, destPath);
      
      const destContent = await fileSystem.readTextFile(destPath);
      expect(destContent).toBe(content);
    });

    it('should delete files', async () => {
      const filePath = path.join(testDir, 'to-delete.txt');
      
      await fileSystem.writeTextFile(filePath, 'delete me');
      expect(await fileSystem.exists(filePath)).toBe(true);
      
      await fileSystem.deleteFile(filePath);
      expect(await fileSystem.exists(filePath)).toBe(false);
    });
  });

  describe('file information', () => {
    it('should get file stats', async () => {
      const filePath = path.join(testDir, 'stats-test.txt');
      const content = 'Test file content';
      
      await fileSystem.writeTextFile(filePath, content);
      const stats = await fileSystem.getStats(filePath);
      
      expect(stats).not.toBeNull();
      expect(stats!.isFile).toBe(true);
      expect(stats!.isDirectory).toBe(false);
      expect(stats!.size).toBeGreaterThan(0);
    });

    it('should return null for non-existent files', async () => {
      const stats = await fileSystem.getStats(path.join(testDir, 'non-existent.txt'));
      expect(stats).toBeNull();
    });

    it('should check file existence', async () => {
      const filePath = path.join(testDir, 'exists-test.txt');
      
      expect(await fileSystem.exists(filePath)).toBe(false);
      
      await fileSystem.writeTextFile(filePath, 'exists');
      expect(await fileSystem.exists(filePath)).toBe(true);
    });
  });

  describe('directory listing', () => {
    beforeEach(async () => {
      await fs.ensureDir(testDir);
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.js'), 'content2');
      await fs.ensureDir(path.join(testDir, 'subdir'));
    });

    it('should list directory contents', async () => {
      const items = await fileSystem.listDirectory(testDir);
      
      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items.some(item => item.name === 'file1.txt')).toBe(true);
      expect(items.some(item => item.name === 'file2.js')).toBe(true);
      expect(items.some(item => item.name === 'subdir')).toBe(true);
    });

    it('should find files by pattern', async () => {
      const txtFiles = await fileSystem.findFiles(testDir, /\.txt$/);
      
      expect(txtFiles.length).toBe(1);
      expect(txtFiles[0].name).toBe('file1.txt');
    });
  });

  describe('utility methods', () => {
    it('should calculate relative paths', () => {
      const from = '/Users/test/project';
      const to = '/Users/test/project/src/file.ts';
      
      const relative = fileSystem.getRelativePath(from, to);
      expect(relative).toBe('src/file.ts');
    });

    it('should get absolute paths', () => {
      const relative = './test.txt';
      const absolute = fileSystem.getAbsolutePath(relative);
      
      expect(path.isAbsolute(absolute)).toBe(true);
    });

    it('should join paths correctly', () => {
      const joined = fileSystem.joinPath('src', 'utils', 'file.ts');
      expect(joined).toBe(path.join('src', 'utils', 'file.ts'));
    });

    it('should parse file paths', () => {
      const parsed = fileSystem.parseFilePath('/Users/test/file.txt');
      
      expect(parsed.dir).toBe('/Users/test');
      expect(parsed.name).toBe('file');
      expect(parsed.ext).toBe('.txt');
      expect(parsed.base).toBe('file.txt');
    });
  });
});