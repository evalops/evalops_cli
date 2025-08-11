import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import type { EvaluationConfig } from '../types';

export class YamlParser {
  static parseFile(filePath: string): EvaluationConfig {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return YamlParser.parseString(content);
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${filePath}`);
      }
      throw new Error(`Failed to read configuration file: ${error instanceof Error ? error.message : error}`);
    }
  }

  static parseString(content: string): EvaluationConfig {
    try {
      const parsed = yaml.load(content) as EvaluationConfig;
      return YamlParser.validateConfig(parsed);
    } catch (error) {
      throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : error}`);
    }
  }

  static stringify(config: EvaluationConfig): string {
    try {
      return yaml.dump(config, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
      });
    } catch (error) {
      throw new Error(`Failed to stringify configuration: ${error instanceof Error ? error.message : error}`);
    }
  }

  static writeFile(filePath: string, config: EvaluationConfig): void {
    try {
      const content = YamlParser.stringify(config);
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write configuration file: ${error instanceof Error ? error.message : error}`);
    }
  }

  private static validateConfig(config: any): EvaluationConfig {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object');
    }

    const required = ['description', 'version', 'prompts', 'providers'];
    for (const field of required) {
      if (!(field in config)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof config.description !== 'string') {
      throw new Error('description must be a string');
    }

    if (typeof config.version !== 'string') {
      throw new Error('version must be a string');
    }

    if (!config.prompts) {
      throw new Error('prompts is required');
    }

    if (!Array.isArray(config.providers) || config.providers.length === 0) {
      throw new Error('providers must be a non-empty array');
    }

    if (config.tests && !Array.isArray(config.tests)) {
      throw new Error('tests must be an array');
    }

    return config as EvaluationConfig;
  }

  static resolveFileReferences(config: EvaluationConfig, basePath: string = '.'): EvaluationConfig {
    const resolved = JSON.parse(JSON.stringify(config));

    const resolveValue = (value: any): any => {
      if (typeof value === 'string' && value.startsWith('@')) {
        const filePath = value.slice(1);
        const fullPath = path.resolve(basePath, filePath);

        try {
          return fs.readFileSync(fullPath, 'utf8').trim();
        } catch (error) {
          throw new Error(`Failed to read referenced file: ${filePath}`);
        }
      }

      if (Array.isArray(value)) {
        return value.map(resolveValue);
      }

      if (value && typeof value === 'object') {
        const result: any = {};
        for (const [key, val] of Object.entries(value)) {
          result[key] = resolveValue(val);
        }
        return result;
      }

      return value;
    };

    return resolveValue(resolved);
  }
}
