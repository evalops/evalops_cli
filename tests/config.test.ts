import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock the entire os module to avoid redefining property issues
jest.mock('os', () => ({
  homedir: jest.fn(() => '/tmp/test-home'),
  tmpdir: jest.requireActual('os').tmpdir,
}));

import { ConfigManager } from '../src/utils/config';

describe('ConfigManager', () => {
  let tempDir: string;
  const mockHomedir = jest.mocked(os.homedir);

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evalops-config-test-'));

    // Mock os.homedir to return our temp directory
    mockHomedir.mockReturnValue(tempDir);

    // Clear environment variables
    delete process.env.EVALOPS_API_KEY;
    delete process.env.EVALOPS_API_URL;
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    mockHomedir.mockReset();
  });

  describe('load', () => {
    it('should return empty config when file does not exist', () => {
      const config = ConfigManager.load();
      expect(config).toEqual({});
    });

    it('should load config from file', () => {
      const configDir = path.join(tempDir, '.evalops');
      const configFile = path.join(configDir, 'config.json');

      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configFile,
        JSON.stringify({
          apiKey: 'test-key',
          apiUrl: 'https://api.test.com',
        }),
      );

      const config = ConfigManager.load();
      expect(config.apiKey).toBe('test-key');
      expect(config.apiUrl).toBe('https://api.test.com');
    });

    it('should handle invalid JSON gracefully', () => {
      const configDir = path.join(tempDir, '.evalops');
      const configFile = path.join(configDir, 'config.json');

      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(configFile, 'invalid json');

      // Should not throw, should return empty config and log warning
      const config = ConfigManager.load();
      expect(config).toEqual({});
    });
  });

  describe('save', () => {
    it('should save config to file', () => {
      const configToSave = {
        apiKey: 'new-test-key',
        apiUrl: 'https://api.new.com',
      };

      ConfigManager.save(configToSave);

      const configFile = path.join(tempDir, '.evalops', 'config.json');
      expect(fs.existsSync(configFile)).toBe(true);

      const savedContent = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      expect(savedContent).toEqual(configToSave);
    });

    it('should create config directory if it does not exist', () => {
      const configToSave = { apiKey: 'test' };

      ConfigManager.save(configToSave);

      const configDir = path.join(tempDir, '.evalops');
      expect(fs.existsSync(configDir)).toBe(true);
    });
  });

  describe('getApiKey', () => {
    it('should return environment variable over config file', () => {
      process.env.EVALOPS_API_KEY = 'env-key';

      // Also set up config file
      ConfigManager.save({ apiKey: 'file-key' });

      const apiKey = ConfigManager.getApiKey();
      expect(apiKey).toBe('env-key');
    });

    it('should return config file value when no environment variable', () => {
      ConfigManager.save({ apiKey: 'file-key' });

      const apiKey = ConfigManager.getApiKey();
      expect(apiKey).toBe('file-key');
    });

    it('should return undefined when neither source has value', () => {
      const apiKey = ConfigManager.getApiKey();
      expect(apiKey).toBeUndefined();
    });
  });

  describe('getApiUrl', () => {
    it('should return environment variable over config file', () => {
      process.env.EVALOPS_API_URL = 'https://env.api.com';
      ConfigManager.save({ apiUrl: 'https://file.api.com' });

      const apiUrl = ConfigManager.getApiUrl();
      expect(apiUrl).toBe('https://env.api.com');
    });

    it('should return config file value when no environment variable', () => {
      ConfigManager.save({ apiUrl: 'https://file.api.com' });

      const apiUrl = ConfigManager.getApiUrl();
      expect(apiUrl).toBe('https://file.api.com');
    });

    it('should return default URL when no other source', () => {
      const apiUrl = ConfigManager.getApiUrl();
      expect(apiUrl).toBe('https://api.evalops.dev');
    });
  });

  describe('setApiKey', () => {
    it('should save API key to config file', () => {
      ConfigManager.setApiKey('new-api-key');

      const config = ConfigManager.load();
      expect(config.apiKey).toBe('new-api-key');
    });

    it('should preserve other config values', () => {
      ConfigManager.save({
        apiUrl: 'https://existing.com',
        debug: true,
      });

      ConfigManager.setApiKey('new-key');

      const config = ConfigManager.load();
      expect(config.apiKey).toBe('new-key');
      expect(config.apiUrl).toBe('https://existing.com');
      expect(config.debug).toBe(true);
    });
  });

  describe('setApiUrl', () => {
    it('should save API URL to config file', () => {
      ConfigManager.setApiUrl('https://new.api.com');

      const config = ConfigManager.load();
      expect(config.apiUrl).toBe('https://new.api.com');
    });

    it('should preserve other config values', () => {
      ConfigManager.save({
        apiKey: 'existing-key',
        debug: false,
      });

      ConfigManager.setApiUrl('https://new.api.com');

      const config = ConfigManager.load();
      expect(config.apiKey).toBe('existing-key');
      expect(config.apiUrl).toBe('https://new.api.com');
      expect(config.debug).toBe(false);
    });
  });
});
