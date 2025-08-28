import { CacheService } from '../../core/services/CacheService';
import { Logger } from '../../utils/Logger';

describe('CacheService', () => {
  let cacheService: CacheService;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ level: 'error', format: 'json' });
    cacheService = new CacheService(logger);
  });

  afterEach(() => {
    cacheService.clear();
  });

  describe('basic caching operations', () => {
    it('should store and retrieve values', async () => {
      const key = 'test-key';
      const value = { data: 'test-data', number: 42 };

      await cacheService.set(key, value);
      const retrieved = await cacheService.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cacheService.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should handle string values', async () => {
      const key = 'string-test';
      const value = 'hello world';

      await cacheService.set(key, value);
      const retrieved = await cacheService.get<string>(key);

      expect(retrieved).toBe(value);
    });

    it('should handle number values', async () => {
      const key = 'number-test';
      const value = 12345;

      await cacheService.set(key, value);
      const retrieved = await cacheService.get<number>(key);

      expect(retrieved).toBe(value);
    });

    it('should handle boolean values', async () => {
      const key = 'boolean-test';
      const value = true;

      await cacheService.set(key, value);
      const retrieved = await cacheService.get<boolean>(key);

      expect(retrieved).toBe(value);
    });

    it('should handle array values', async () => {
      const key = 'array-test';
      const value = ['item1', 'item2', { nested: 'object' }];

      await cacheService.set(key, value);
      const retrieved = await cacheService.get<typeof value>(key);

      expect(retrieved).toEqual(value);
    });
  });

  describe('TTL (Time To Live) functionality', () => {
    it('should respect TTL and expire entries', async () => {
      const key = 'ttl-test';
      const value = 'expires-soon';
      const ttlSeconds = 1; // 1 second

      await cacheService.set(key, value, ttlSeconds);

      // Should be available immediately
      let retrieved = await cacheService.get(key);
      expect(retrieved).toBe(value);

      // Wait for expiration (add extra time for safety)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired now
      retrieved = await cacheService.get(key);
      expect(retrieved).toBeNull();
    });

    it('should handle entries without TTL', async () => {
      const key = 'no-ttl-test';
      const value = 'persistent-data';

      await cacheService.set(key, value); // No TTL specified

      const retrieved = await cacheService.get(key);
      expect(retrieved).toBe(value);
    });

    it('should update TTL when setting existing key', async () => {
      const key = 'update-ttl-test';
      const value1 = 'first-value';
      const value2 = 'second-value';

      // Set with short TTL
      await cacheService.set(key, value1, 1);

      // Update with longer TTL
      await cacheService.set(key, value2, 10);

      // Should have updated value
      const retrieved = await cacheService.get(key);
      expect(retrieved).toBe(value2);
    });
  });

  describe('cache management', () => {
    it('should delete specific entries', async () => {
      const key1 = 'delete-test-1';
      const key2 = 'delete-test-2';
      const value1 = 'value1';
      const value2 = 'value2';

      await cacheService.set(key1, value1);
      await cacheService.set(key2, value2);

      // Both should exist
      expect(await cacheService.get(key1)).toBe(value1);
      expect(await cacheService.get(key2)).toBe(value2);

      // Delete one
      cacheService.delete(key1);

      // First should be gone, second should remain
      expect(await cacheService.get(key1)).toBeNull();
      expect(await cacheService.get(key2)).toBe(value2);
    });

    it('should clear all entries', async () => {
      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');
      await cacheService.set('key3', 'value3');

      // Should be able to get values before clear
      expect(await cacheService.get('key1')).toBe('value1');
      expect(await cacheService.get('key2')).toBe('value2');

      cacheService.clear();

      // Should be null after clear
      expect(await cacheService.get('key1')).toBeNull();
      expect(await cacheService.get('key2')).toBeNull();
      expect(await cacheService.get('key3')).toBeNull();
    });

    it('should provide cache statistics', () => {
      const stats = cacheService.getStats();

      expect(stats).toHaveProperty('memoryEntries');
      expect(stats).toHaveProperty('memorySize');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('strategy');

      expect(typeof stats.memoryEntries).toBe('number');
      expect(typeof stats.memorySize).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
      expect(typeof stats.strategy).toBe('string');
    });
  });


  describe('complex data structures', () => {
    it('should handle nested objects correctly', async () => {
      const key = 'nested-test';
      const value = {
        user: {
          id: 123,
          profile: {
            name: 'John Doe',
            settings: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
        metadata: {
          created: new Date().toISOString(),
          tags: ['user', 'active', 'premium'],
        },
      };

      await cacheService.set(key, value);
      const retrieved = await cacheService.get(key);

      expect(retrieved).toEqual(value);
      expect((retrieved as any)?.user.profile.name).toBe('John Doe');
      expect((retrieved as any)?.metadata.tags).toContain('premium');
    });

    it('should maintain data types after serialization', async () => {
      const key = 'types-test';
      const value = {
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined,
        array: [1, 2, 3],
        date: new Date().toISOString(), // Dates become strings in JSON
      };

      await cacheService.set(key, value);
      const retrieved = await cacheService.get(key);

      expect(typeof (retrieved as any)?.string).toBe('string');
      expect(typeof (retrieved as any)?.number).toBe('number');
      expect(typeof (retrieved as any)?.boolean).toBe('boolean');
      expect((retrieved as any)?.null).toBeNull();
      expect(Array.isArray((retrieved as any)?.array)).toBe(true);
    });
  });
});