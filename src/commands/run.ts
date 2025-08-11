import ora from 'ora';
import { EvalOpsAPIClient } from '../lib/api-client';
import { BudgetValidator } from '../lib/budget-validator';
import type { EvaluationMetrics } from '../lib/budget-validator';
import { ConfigManager } from '../utils/config';
import { Logger } from '../utils/logger';
import * as fs from 'fs';

interface RunOptions {
  testSuiteId: string;
  apiKey?: string;
  apiUrl?: string;
  wait?: boolean;
  checkBudget?: boolean;
  budgetFile?: string;
  environment?: string;
}

export class RunCommand {
  static async execute(options: RunOptions): Promise<void> {
    // Get API credentials
    const apiKey = options.apiKey || ConfigManager.getApiKey();
    const apiUrl = options.apiUrl || ConfigManager.getApiUrl();

    if (!apiKey) {
      Logger.error('API key is required');
      Logger.info('Set EVALOPS_API_KEY environment variable or use --api-key option');
      throw new Error('API key is required');
    }

    if (!options.testSuiteId) {
      Logger.error('Test suite ID is required');
      Logger.info('Usage: evalops run <test-suite-id>');
      throw new Error('Test suite ID is required');
    }

    const client = new EvalOpsAPIClient(apiKey, apiUrl);

    // Load budget validator if needed
    let budgetValidator: BudgetValidator | null = null;
    if (options.checkBudget && fs.existsSync(options.budgetFile || './budget.yaml')) {
      try {
        budgetValidator = new BudgetValidator(
          options.budgetFile || './budget.yaml',
          options.environment
        );
        Logger.info('🎯 Budget constraints loaded');
      } catch (error) {
        Logger.warn(`Failed to load budget: ${error instanceof Error ? error.message : error}`);
      }
    }

    // Start the test run
    const runSpinner = ora('Starting evaluation...').start();
    let testRun;
    try {
      testRun = await client.createTestRun(options.testSuiteId);
      runSpinner.succeed('Evaluation started');
      
      Logger.info('');
      Logger.info('📊 Evaluation Details:');
      Logger.info(`  Run ID: ${testRun.id}`);
      Logger.info(`  Test Suite: ${testRun.testSuiteId}`);
      Logger.info(`  Status: ${testRun.status}`);
    } catch (error) {
      runSpinner.fail('Failed to start evaluation');
      if (error instanceof Error) {
        Logger.error(error.message);
      }
      throw error;
    }

    // Wait for completion if requested
    if (options.wait) {
      const pollSpinner = ora('Waiting for evaluation to complete...').start();
      try {
        const completedRun = await client.pollTestRun(testRun.id, 600000); // 10 minutes max
        pollSpinner.succeed('Evaluation completed');
        
        // Display results
        if (completedRun.status === 'failed') {
          Logger.error('❌ Evaluation failed');
        } else if (completedRun.metrics) {
          Logger.info('');
          Logger.success('✅ Evaluation Results:');
          Logger.info(`  Quality Score: ${completedRun.metrics.qualityScore.toFixed(2)}`);
          Logger.info(`  Total Cost: $${completedRun.metrics.totalCost.toFixed(4)}`);
          Logger.info(`  Tokens Used: ${completedRun.metrics.tokensUsed.toLocaleString()}`);
          Logger.info(`  Avg Latency: ${completedRun.metrics.avgLatencyMs}ms`);
          Logger.info(`  Total Time: ${(completedRun.metrics.totalExecutionTimeMs / 1000).toFixed(1)}s`);
          
          // Display individual test results if available
          if (completedRun.results && completedRun.results.length > 0) {
            Logger.info('');
            Logger.info('📝 Test Results:');
            completedRun.results.forEach((result, index) => {
              const status = result.passed ? '✅' : '❌';
              Logger.info(`  ${index + 1}. ${status} Score: ${result.score.toFixed(2)}`);
              if (result.feedback) {
                Logger.info(`     ${result.feedback}`);
              }
            });
          }
          
          // Check budget if enabled
          if (budgetValidator) {
            const actualMetrics: EvaluationMetrics = {
              quality_score: completedRun.metrics.qualityScore,
              cost_usd: completedRun.metrics.totalCost,
              tokens_used: completedRun.metrics.tokensUsed,
              avg_latency_ms: completedRun.metrics.avgLatencyMs,
              total_execution_time_ms: completedRun.metrics.totalExecutionTimeMs
            };
            
            const budgetResult = budgetValidator.validateMetrics(actualMetrics);
            Logger.info('');
            Logger.info('🎯 Budget Validation:');
            budgetValidator.displayResults(budgetResult);
            
            if (!budgetResult.passed) {
              process.exit(1);
            }
          }
        }
      } catch (error) {
        pollSpinner.fail('Evaluation failed');
        if (error instanceof Error) {
          Logger.error(error.message);
        }
        throw error;
      }
    } else {
      Logger.info('');
      Logger.info('Use --wait to wait for completion and see results');
    }
  }
}