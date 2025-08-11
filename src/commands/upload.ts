import * as fs from 'fs';
import ora from 'ora';
import * as path from 'path';
import { BudgetValidator } from '../lib/budget-validator';
import type { EvaluationMetrics } from '../lib/budget-validator';
import { EvalOpsAPIClient } from '../lib/api-client';
import { SimpleTestDiscovery } from '../lib/simple-test-discovery';
import { YamlParser } from '../lib/yaml-parser';
import type { EvaluationConfig } from '../types';
import { ConfigManager } from '../utils/config';
import { Logger } from '../utils/logger';

interface UploadOptions {
  file?: string;
  apiKey?: string;
  apiUrl?: string;
  name?: string;
  dryRun?: boolean;
  checkBudget?: boolean;
  budgetFile?: string;
}

export class UploadCommand {
  static async execute(options: UploadOptions): Promise<void> {
    const configPath = path.resolve(options.file || './evalops.yaml');

    if (!fs.existsSync(configPath)) {
      Logger.error(`Configuration file not found: ${configPath}`);
      Logger.info('Run "evalops init" to create a configuration file');
      throw new Error('Configuration file not found');
    }

    // Get API credentials
    const apiKey = options.apiKey || ConfigManager.getApiKey();
    const apiUrl = options.apiUrl || ConfigManager.getApiUrl();

    if (!apiKey) {
      Logger.error('API key is required');
      Logger.info('Set EVALOPS_API_KEY environment variable or use --api-key option');
      Logger.info('Or run: evalops config set api-key <your-key>');
      throw new Error('API key is required');
    }

    Logger.info(`Loading configuration from: ${configPath}`);

    // Load and parse configuration
    let config: EvaluationConfig;
    try {
      config = YamlParser.parseFile(configPath);
      Logger.success('✓ Configuration loaded successfully');
    } catch (error) {
      Logger.error(`Failed to load configuration: ${error instanceof Error ? error.message : error}`);
      throw error;
    }

    // Resolve file references
    try {
      const basePath = path.dirname(configPath);
      config = YamlParser.resolveFileReferences(config, basePath);
      Logger.success('✓ File references resolved');
    } catch (error) {
      Logger.error(`Failed to resolve file references: ${error instanceof Error ? error.message : error}`);
      throw error;
    }

    // Discover test cases
    const spinner = ora('Discovering test cases...').start();
    try {
      const discovery = new SimpleTestDiscovery();
      const testCases = await discovery.discoverAllTests();

      if (testCases.length > 0) {
        // Add discovered test cases to config
        config.tests = [...(config.tests || []), ...testCases];
        spinner.succeed(`Found ${testCases.length} test case(s)`);

        Logger.info('Discovered test cases:');
        testCases.forEach((testCase, index) => {
          Logger.info(`  ${index + 1}. ${testCase.description}`);
          Logger.info(`     ${testCase.metadata.filePath}:${testCase.metadata.lineNumber}`);
        });
      } else {
        spinner.warn('No test cases found in codebase');
        Logger.info('The configuration will be uploaded without discovered test cases');
      }
    } catch (error) {
      spinner.fail('Test discovery failed');
      Logger.warn(`Test discovery error: ${error instanceof Error ? error.message : error}`);
      Logger.info('Continuing with upload...');
    }

    // Generate final configuration content
    const configContent = YamlParser.stringify(config);

    // Pre-upload budget validation (cost estimation)
    let budgetValidator: BudgetValidator | null = null;
    if (options.checkBudget && fs.existsSync(options.budgetFile || './budget.yaml')) {
      try {
        budgetValidator = new BudgetValidator(options.budgetFile || './budget.yaml');
        Logger.info('🎯 Checking budget constraints...');

        // Estimate costs and validate against budget
        const { CostCommand } = require('./cost');
        // This would integrate with cost estimation - simplified for now
        const estimatedMetrics: EvaluationMetrics = {
          quality_score: 0.8, // Would come from historical data or prediction
          cost_usd: 5.0, // Would come from cost estimation
          tokens_used: 25000,
          avg_latency_ms: 2000,
          total_execution_time_ms: 30000
        };

        const budgetResult = budgetValidator.validateMetrics(estimatedMetrics);
        if (!budgetResult.passed) {
          Logger.error('❌ Pre-upload budget validation failed');
          budgetValidator.displayResults(budgetResult);
          throw new Error('Budget constraints violated - upload aborted');
        }
        Logger.success('✅ Pre-upload budget validation passed');
      } catch (error) {
        Logger.error(`Budget validation failed: ${error instanceof Error ? error.message : error}`);
        throw error;
      }
    }

    if (options.dryRun) {
      Logger.info('');
      Logger.info('=== DRY RUN - Configuration that would be uploaded ===');
      Logger.plain(configContent);
      Logger.info('=== End of configuration ===');
      Logger.info('');
      Logger.info('Run without --dry-run to actually upload');
      return;
    }

    // Upload to EvalOps
    const client = new EvalOpsAPIClient(apiKey, apiUrl);

    // Validate API key first
    const validateSpinner = ora('Validating API credentials...').start();
    try {
      const isValid = await client.validateApiKey();
      if (!isValid) {
        validateSpinner.fail('Invalid API credentials');
        Logger.error('API key validation failed');
        Logger.info('Please check your API key and try again');
        throw new Error('Invalid API credentials');
      }
      validateSpinner.succeed('API credentials validated');
    } catch (error) {
      validateSpinner.fail('Failed to validate API credentials');
      throw error;
    }

    // Upload the test suite
    const uploadSpinner = ora('Uploading test suite to EvalOps...').start();
    try {
      const uploadRequest = {
        format: 'yaml' as const,
        content: configContent,
        name: options.name || config.description,
      };

      const response = await client.uploadTestSuite(uploadRequest);
      uploadSpinner.succeed('Test suite uploaded successfully');

      Logger.success('✓ Upload completed successfully!');
      Logger.info('');
      Logger.info('Test Suite Details:');
      Logger.info(`  ID: ${response.id}`);
      Logger.info(`  Name: ${response.name}`);
      Logger.info(`  Status: ${response.status}`);

      const webUrl = client.constructWebUrl(response.id);
      Logger.info(`  URL: ${webUrl}`);
      Logger.info('');
      Logger.success('You can view your test suite in the EvalOps dashboard!');
    } catch (error) {
      uploadSpinner.fail('Upload failed');

      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          Logger.error('Authentication failed. Please check your API key.');
        } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
          Logger.error('Invalid configuration. Please run "evalops validate" first.');
        } else if (error.message.includes('Network error')) {
          Logger.error('Network connection failed. Please check your internet connection.');
        } else {
          Logger.error(`Upload failed: ${error.message}`);
        }
      }

      throw error;
    }
  }
}
