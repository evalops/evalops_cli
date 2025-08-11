import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { CLIConfig } from '../types';

export class ConfigManager {
  private static getConfigDir(): string {
    return path.join(os.homedir(), '.evalops');
  }

  private static getConfigFile(): string {
    return path.join(ConfigManager.getConfigDir(), 'config.json');
  }

  static load(): CLIConfig {
    try {
      const configFile = ConfigManager.getConfigFile();
      if (!fs.existsSync(configFile)) {
        return {};
      }

      const content = fs.readFileSync(configFile, 'utf8');
      return JSON.parse(content) as CLIConfig;
    } catch (error) {
      console.warn(`Warning: Failed to load config file: ${error instanceof Error ? error.message : error}`);
      return {};
    }
  }

  static save(config: CLIConfig): void {
    try {
      const configDir = ConfigManager.getConfigDir();
      const configFile = ConfigManager.getConfigFile();

      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : error}`);
    }
  }

  static getApiKey(): string | undefined {
    // Priority: environment variable -> config file
    const envKey = process.env.EVALOPS_API_KEY;
    if (envKey) return envKey;

    const config = ConfigManager.load();
    return config.apiKey;
  }

  static getApiUrl(): string {
    // Priority: environment variable -> config file -> default
    const envUrl = process.env.EVALOPS_API_URL;
    if (envUrl) return envUrl;

    const config = ConfigManager.load();
    return config.apiUrl || 'https://api.evalops.dev';
  }

  static setApiKey(apiKey: string): void {
    const config = ConfigManager.load();
    config.apiKey = apiKey;
    ConfigManager.save(config);
  }

  static setApiUrl(apiUrl: string): void {
    const config = ConfigManager.load();
    config.apiUrl = apiUrl;
    ConfigManager.save(config);
  }
}
