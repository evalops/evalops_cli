import * as fs from 'fs';
import * as path from 'path';
import { EvaluationConfig } from '../types';
import { YamlParser } from '../lib/yaml-parser';
import { SimpleTestDiscovery } from '../lib/simple-test-discovery';
import { Logger } from '../utils/logger';

interface ValidateOptions {
  verbose?: boolean;
  file?: string;
}

export class ValidateCommand {
  static async execute(options: ValidateOptions): Promise<void> {
    const configPath = path.resolve(options.file || './evalops.yaml');
    
    if (!fs.existsSync(configPath)) {
      Logger.error(`Configuration file not found: ${configPath}`);
      Logger.info('Run "evalops init" to create a configuration file');
      throw new Error('Configuration file not found');
    }

    Logger.info(`Validating configuration file: ${configPath}`);
    
    let config: EvaluationConfig;
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Parse and validate YAML structure
    try {
      config = YamlParser.parseFile(configPath);
      Logger.success('✓ Configuration file syntax is valid');
    } catch (error) {
      Logger.error(`✗ Configuration file syntax error: ${error instanceof Error ? error.message : error}`);
      throw error;
    }

    // 2. Validate configuration content
    try {
      this.validateConfigContent(config, errors, warnings);
    } catch (error) {
      Logger.error(`✗ Configuration validation failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }

    // 3. Resolve file references
    try {
      const basePath = path.dirname(configPath);
      const resolvedConfig = YamlParser.resolveFileReferences(config, basePath);
      Logger.success('✓ File references resolved successfully');
      
      if (options.verbose) {
        this.logResolvedReferences(config, resolvedConfig);
      }
    } catch (error) {
      errors.push(`File reference error: ${error instanceof Error ? error.message : error}`);
      Logger.error(`✗ File reference resolution failed: ${error instanceof Error ? error.message : error}`);
    }

    // 4. Discover and validate test cases
    Logger.info('Discovering test cases...');
    try {
      const discovery = new SimpleTestDiscovery();
      const testCases = await discovery.discoverAllTests();
      
      if (testCases.length === 0) {
        warnings.push('No test cases found in codebase');
        Logger.warn('⚠ No test cases found in codebase');
        Logger.info('  Add test cases using @evalops_test decorators or evalops_test() function calls');
      } else {
        Logger.success(`✓ Found ${testCases.length} test case(s)`);
        
        if (options.verbose) {
          Logger.info('');
          Logger.info('Discovered test cases:');
          testCases.forEach((testCase, index) => {
            Logger.info(`  ${index + 1}. ${testCase.description}`);
            Logger.info(`     File: ${testCase.metadata.filePath}:${testCase.metadata.lineNumber}`);
            Logger.info(`     Function: ${testCase.metadata.functionName}`);
            if (testCase.tags && testCase.tags.length > 0) {
              Logger.info(`     Tags: ${testCase.tags.join(', ')}`);
            }
          });
        }
      }
    } catch (error) {
      warnings.push(`Test discovery error: ${error instanceof Error ? error.message : error}`);
      Logger.warn(`⚠ Test discovery failed: ${error instanceof Error ? error.message : error}`);
    }

    // 5. Validate providers
    this.validateProviders(config.providers, warnings);

    // 6. Validate assertions
    this.validateAssertions(config, warnings);

    // Report results
    Logger.newline();
    if (errors.length > 0) {
      Logger.error('Validation failed with errors:');
      errors.forEach(error => Logger.error(`  - ${error}`));
      throw new Error('Validation failed');
    }

    if (warnings.length > 0) {
      Logger.warn(`Validation completed with ${warnings.length} warning(s):`);
      warnings.forEach(warning => Logger.warn(`  - ${warning}`));
    } else {
      Logger.success('✓ Validation completed successfully');
    }

    Logger.info('');
    Logger.info('Configuration is ready for upload!');
    Logger.info('Run "evalops upload" to upload your test suite to EvalOps');
  }

  private static validateConfigContent(config: EvaluationConfig, errors: string[], warnings: string[]): void {
    // Check required fields are non-empty
    if (!config.description?.trim()) {
      errors.push('Description cannot be empty');
    }

    if (!config.version?.trim()) {
      errors.push('Version cannot be empty');
    }

    // Validate version format
    if (config.version && !['1.0', '2.0'].includes(config.version)) {
      warnings.push(`Unsupported version: ${config.version}. Supported versions: 1.0, 2.0`);
    }

    // Validate prompts
    if (!config.prompts) {
      errors.push('Prompts are required');
    } else {
      this.validatePrompts(config.prompts, errors, warnings);
    }

    // Validate providers
    if (!config.providers || config.providers.length === 0) {
      errors.push('At least one provider is required');
    }

    // Validate execution config
    if (config.config) {
      if (config.config.iterations !== undefined && config.config.iterations < 1) {
        errors.push('Iterations must be greater than 0');
      }
      if (config.config.timeout !== undefined && config.config.timeout < 1) {
        errors.push('Timeout must be greater than 0');
      }
    }

    // Validate output format
    if (config.outputFormat && !['json', 'yaml', 'csv'].includes(config.outputFormat)) {
      errors.push(`Invalid output format: ${config.outputFormat}. Supported formats: json, yaml, csv`);
    }
  }

  private static validatePrompts(prompts: any, errors: string[], warnings: string[]): void {
    if (typeof prompts === 'string') {
      if (!prompts.trim()) {
        errors.push('Prompt cannot be empty');
      }
      return;
    }

    if (Array.isArray(prompts)) {
      if (prompts.length === 0) {
        errors.push('Prompts array cannot be empty');
        return;
      }

      for (let i = 0; i < prompts.length; i++) {
        const prompt = prompts[i];
        if (typeof prompt === 'string') {
          if (!prompt.trim()) {
            errors.push(`Prompt at index ${i} cannot be empty`);
          }
        } else if (typeof prompt === 'object') {
          if (!prompt.role) {
            errors.push(`Prompt at index ${i} missing role`);
          } else if (!['system', 'user', 'assistant'].includes(prompt.role)) {
            errors.push(`Invalid role at index ${i}: ${prompt.role}`);
          }
          if (!prompt.content?.trim()) {
            errors.push(`Prompt at index ${i} missing or empty content`);
          }
        } else {
          errors.push(`Invalid prompt format at index ${i}`);
        }
      }
    } else if (typeof prompts === 'object') {
      if (!prompts.role) {
        errors.push('Prompt object missing role');
      } else if (!['system', 'user', 'assistant'].includes(prompts.role)) {
        errors.push(`Invalid prompt role: ${prompts.role}`);
      }
      if (!prompts.content?.trim()) {
        errors.push('Prompt object missing or empty content');
      }
    } else {
      errors.push('Invalid prompts format');
    }
  }

  private static validateProviders(providers: any[], warnings: string[]): void {
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      
      if (typeof provider === 'string') {
        if (!provider.includes('/')) {
          warnings.push(`Provider at index ${i} should include model (format: provider/model): ${provider}`);
        }
      } else if (typeof provider === 'object') {
        if (!provider.provider) {
          warnings.push(`Provider object at index ${i} missing provider field`);
        }
        if (!provider.model) {
          warnings.push(`Provider object at index ${i} missing model field`);
        }
        if (provider.temperature !== undefined && (provider.temperature < 0 || provider.temperature > 2)) {
          warnings.push(`Provider at index ${i} has unusual temperature: ${provider.temperature}`);
        }
      }
    }
  }

  private static validateAssertions(config: EvaluationConfig, warnings: string[]): void {
    const validateAssertArray = (asserts: any[], context: string) => {
      for (let i = 0; i < asserts.length; i++) {
        const assert = asserts[i];
        if (!assert.type) {
          warnings.push(`${context} assertion at index ${i} missing type`);
        } else if (!['contains', 'not-contains', 'equals', 'not-equals', 'llm-judge', 'regex', 'json-path', 'similarity'].includes(assert.type)) {
          warnings.push(`${context} assertion at index ${i} has unknown type: ${assert.type}`);
        }
        
        if (assert.value === undefined) {
          warnings.push(`${context} assertion at index ${i} missing value`);
        }

        if (assert.weight !== undefined && (assert.weight < 0 || assert.weight > 1)) {
          warnings.push(`${context} assertion at index ${i} has invalid weight: ${assert.weight} (should be 0-1)`);
        }
      }
    };

    if (config.defaultTest?.assert) {
      validateAssertArray(config.defaultTest.assert, 'Default test');
    }

    if (config.tests) {
      for (let i = 0; i < config.tests.length; i++) {
        const test = config.tests[i];
        if (test.assert) {
          validateAssertArray(test.assert, `Test ${i + 1}`);
        }
      }
    }
  }

  private static logResolvedReferences(original: EvaluationConfig, resolved: EvaluationConfig): void {
    const findReferences = (obj: any, path: string = ''): string[] => {
      const refs: string[] = [];
      if (typeof obj === 'string' && obj.startsWith('@')) {
        refs.push(`${path}: ${obj}`);
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          refs.push(...findReferences(item, `${path}[${index}]`));
        });
      } else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => {
          refs.push(...findReferences(value, path ? `${path}.${key}` : key));
        });
      }
      return refs;
    };

    const references = findReferences(original);
    if (references.length > 0) {
      Logger.info('');
      Logger.info('Resolved file references:');
      references.forEach(ref => Logger.info(`  ${ref}`));
    }
  }
}