import * as fs from 'fs';
import * as path from 'path';
import { BudgetValidator } from '../lib/budget-validator';
import type { EvaluationMetrics } from '../lib/budget-validator';
import { Logger } from '../utils/logger';

interface BudgetOptions {
  init?: boolean;
  validate?: boolean;
  file?: string;
  environment?: string;
  metrics?: string;
}

export class BudgetCommand {
  static async execute(options: BudgetOptions): Promise<void> {
    if (options.init) {
      return BudgetCommand.initializeBudget(options);
    }
    
    if (options.validate) {
      return BudgetCommand.validateBudget(options);
    }
    
    // Default: show budget status/info
    return BudgetCommand.showBudgetInfo(options);
  }

  private static async initializeBudget(options: BudgetOptions): Promise<void> {
    const budgetPath = path.resolve(options.file || './budget.yaml');
    
    if (fs.existsSync(budgetPath)) {
      Logger.error(`Budget file already exists: ${budgetPath}`);
      Logger.info('Use --force to overwrite existing file');
      throw new Error('Budget file already exists');
    }

    Logger.info('🎯 Initializing budget configuration...');
    
    BudgetValidator.createDefaultBudgetConfig(budgetPath);
    
    Logger.info('');
    Logger.info('Next steps:');
    Logger.info('1. Edit the budget.yaml file to set your quality and cost thresholds');
    Logger.info('2. Run "evalops budget --validate" to test your budget rules');
    Logger.info('3. Use "evalops upload --check-budget" to enforce budgets during evaluations');
  }

  private static async validateBudget(options: BudgetOptions): Promise<void> {
    const budgetPath = path.resolve(options.file || './budget.yaml');
    
    if (!fs.existsSync(budgetPath)) {
      Logger.error(`Budget file not found: ${budgetPath}`);
      Logger.info('Run "evalops budget --init" to create a budget configuration');
      throw new Error('Budget file not found');
    }

    Logger.info('🎯 Validating budget configuration...');

    // Load budget configuration
    let validator: BudgetValidator;
    try {
      validator = new BudgetValidator(budgetPath, options.environment);
      Logger.success('✓ Budget configuration loaded successfully');
    } catch (error) {
      Logger.error(`Failed to load budget configuration: ${error instanceof Error ? error.message : error}`);
      throw error;
    }

    // If metrics provided, validate them
    if (options.metrics) {
      try {
        const metrics = JSON.parse(options.metrics) as EvaluationMetrics;
        const result = validator.validateMetrics(metrics);
        validator.displayResults(result);
        
        if (!result.passed) {
          process.exit(1);
        }
      } catch (error) {
        Logger.error(`Invalid metrics JSON: ${error instanceof Error ? error.message : error}`);
        throw error;
      }
    } else {
      // Just validate the configuration syntax
      Logger.success('✓ Budget configuration syntax is valid');
      Logger.info('');
      Logger.info('To test with actual metrics, use:');
      Logger.info('  evalops budget --validate --metrics \'{"quality_score": 0.75, "cost_usd": 2.5, "avg_latency_ms": 1200}\'');
    }
  }

  private static async showBudgetInfo(options: BudgetOptions): Promise<void> {
    const budgetPath = path.resolve(options.file || './budget.yaml');
    
    if (!fs.existsSync(budgetPath)) {
      Logger.info('No budget configuration found.');
      Logger.info('');
      Logger.info('Available commands:');
      Logger.info('  evalops budget --init     Create a new budget configuration');
      Logger.info('  evalops budget --validate  Validate existing budget configuration');
      return;
    }

    Logger.info('🎯 Budget Configuration Summary');
    Logger.info('');

    try {
      const validator = new BudgetValidator(budgetPath, options.environment);
      Logger.success(`✓ Budget configuration loaded from: ${budgetPath}`);
      
      if (options.environment) {
        Logger.info(`  Environment: ${options.environment}`);
      }
      
      Logger.info('');
      Logger.info('Available commands:');
      Logger.info('  evalops budget --validate                  Validate budget configuration');
      Logger.info('  evalops budget --validate --metrics "{}"   Test budget with sample metrics');
      Logger.info('  evalops upload --check-budget              Upload with budget enforcement');
      
    } catch (error) {
      Logger.error(`Failed to load budget configuration: ${error instanceof Error ? error.message : error}`);
      Logger.info('Run "evalops budget --init" to create a new budget configuration');
    }
  }
}