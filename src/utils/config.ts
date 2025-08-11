import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CLIConfig } from '../types';

const CONFIG_DIR = path.join(os.homedir(), '.evalops');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export class ConfigManager {
  static load(): CLIConfig {
    try {
      if (!fs.existsSync(CONFIG_FILE)) {
        return {};
      }

      const content = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(content) as CLIConfig;
    } catch (error) {
      console.warn(`Warning: Failed to load config file: ${error instanceof Error ? error.message : error}`);
      return {};
    }
  }

  static save(config: CLIConfig): void {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }

      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : error}`);
    }
  }

  static getApiKey(): string | undefined {
    // Priority: environment variable -> config file
    const envKey = process.env.EVALOPS_API_KEY;
    if (envKey) return envKey;

    const config = this.load();
    return config.apiKey;
  }

  static getApiUrl(): string {
    // Priority: environment variable -> config file -> default
    const envUrl = process.env.EVALOPS_API_URL;
    if (envUrl) return envUrl;

    const config = this.load();
    return config.apiUrl || 'https://api.evalops.dev';
  }

  static setApiKey(apiKey: string): void {
    const config = this.load();
    config.apiKey = apiKey;
    this.save(config);
  }

  static setApiUrl(apiUrl: string): void {
    const config = this.load();
    config.apiUrl = apiUrl;
    this.save(config);
  }
}