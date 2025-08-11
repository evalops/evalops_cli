import * as fs from 'fs';
import * as path from 'path';
import type { EvaluationConfig } from '../types';
import { YamlParser } from '../lib/yaml-parser';
import { Logger } from '../utils/logger';

interface CostOptions {
  file?: string;
  format?: 'table' | 'json' | 'csv';
  verbose?: boolean;
}

interface ProviderCosts {
  [key: string]: {
    inputTokenCost: number; // per 1K tokens
    outputTokenCost: number; // per 1K tokens
    requestCost: number; // per request
  };
}

interface CostEstimate {
  provider: string;
  model: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  requests: number;
  inputCost: number;
  outputCost: number;
  requestCost: number;
  totalCost: number;
}

interface CostSummary {
  totalCost: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimates: CostEstimate[];
  warnings: string[];
}

export class CostCommand {
  // Pricing data (updated as of January 2025)
  private static readonly PROVIDER_COSTS: ProviderCosts = {
    'openai/gpt-4': {
      inputTokenCost: 0.03, // $0.03 per 1K tokens
      outputTokenCost: 0.06, // $0.06 per 1K tokens
      requestCost: 0,
    },
    'openai/gpt-4-turbo': {
      inputTokenCost: 0.01,
      outputTokenCost: 0.03,
      requestCost: 0,
    },
    'openai/gpt-3.5-turbo': {
      inputTokenCost: 0.0015,
      outputTokenCost: 0.002,
      requestCost: 0,
    },
    'anthropic/claude-3-opus': {
      inputTokenCost: 0.015,
      outputTokenCost: 0.075,
      requestCost: 0,
    },
    'anthropic/claude-3-sonnet': {
      inputTokenCost: 0.003,
      outputTokenCost: 0.015,
      requestCost: 0,
    },
    'anthropic/claude-3-haiku': {
      inputTokenCost: 0.00025,
      outputTokenCost: 0.00125,
      requestCost: 0,
    },
    'anthropic/claude-2': {
      inputTokenCost: 0.008,
      outputTokenCost: 0.024,
      requestCost: 0,
    },
  };

  static async execute(options: CostOptions): Promise<void> {
    const configPath = path.resolve(options.file || './evalops.yaml');

    if (!fs.existsSync(configPath)) {
      Logger.error(`Configuration file not found: ${configPath}`);
      Logger.info('Run "evalops init" to create a configuration file');
      throw new Error('Configuration file not found');
    }

    Logger.info('💰 Calculating cost estimate...');

    // Load and parse configuration
    let config: EvaluationConfig;
    try {
      config = YamlParser.parseFile(configPath);
      if (options.verbose) {
        Logger.success('✓ Configuration loaded');
      }
    } catch (error) {
      Logger.error(`Failed to load configuration: ${error instanceof Error ? error.message : error}`);
      throw error;
    }

    // Resolve file references
    try {
      const basePath = path.dirname(configPath);
      config = YamlParser.resolveFileReferences(config, basePath);
      if (options.verbose) {
        Logger.success('✓ File references resolved');
      }
    } catch (error) {
      Logger.error(`Failed to resolve file references: ${error instanceof Error ? error.message : error}`);
      throw error;
    }

    // Use test count from configuration only (avoid test discovery parsing issues)
    let totalTests = config.tests?.length || 0;
    if (totalTests === 0) {
      // Provide a reasonable default for cost estimation
      totalTests = 1;
      if (options.verbose) {
        Logger.info('ℹ No tests defined in configuration, using default count for estimation');
      }
    }

    // Calculate cost estimates
    const costSummary = await CostCommand.calculateCosts(config, totalTests);

    // Display results
    CostCommand.displayResults(costSummary, options.format || 'table', options.verbose);
  }

  private static async calculateCosts(config: EvaluationConfig, testCount: number): Promise<CostSummary> {
    const estimates: CostEstimate[] = [];
    const warnings: string[] = [];
    let totalCost = 0;
    let totalRequests = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // If no test cases, assume at least 1 for estimation
    const effectiveTestCount = Math.max(testCount, 1);
    const iterations = config.config?.iterations || 1;

    for (const provider of config.providers) {
      const providerKey = typeof provider === 'string' ? provider : `${provider.provider}/${provider.model}`;
      const pricing = CostCommand.PROVIDER_COSTS[providerKey];

      if (!pricing) {
        warnings.push(`No pricing data available for provider: ${providerKey}`);
        continue;
      }

      // Estimate token usage
      const promptText = CostCommand.extractPromptText(config.prompts);
      const estimatedInputTokens = CostCommand.estimateTokens(promptText) * effectiveTestCount * iterations;
      const estimatedOutputTokens = Math.round(estimatedInputTokens * 0.5); // Assume 50% of input length for output
      const requests = effectiveTestCount * iterations;

      // Calculate costs
      const inputCost = (estimatedInputTokens / 1000) * pricing.inputTokenCost;
      const outputCost = (estimatedOutputTokens / 1000) * pricing.outputTokenCost;
      const requestCost = requests * pricing.requestCost;
      const totalProviderCost = inputCost + outputCost + requestCost;

      estimates.push({
        provider: providerKey,
        model: providerKey.split('/')[1],
        estimatedInputTokens,
        estimatedOutputTokens,
        requests,
        inputCost,
        outputCost,
        requestCost,
        totalCost: totalProviderCost,
      });

      totalCost += totalProviderCost;
      totalRequests += requests;
      totalInputTokens += estimatedInputTokens;
      totalOutputTokens += estimatedOutputTokens;
    }

    return {
      totalCost,
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      estimates,
      warnings,
    };
  }

  private static extractPromptText(prompts: any): string {
    if (typeof prompts === 'string') {
      return prompts;
    }

    if (Array.isArray(prompts)) {
      return prompts
        .map((prompt) => (typeof prompt === 'string' ? prompt : prompt.content || ''))
        .join(' ');
    }

    return '';
  }

  private static estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    // More sophisticated tokenization could be added later
    return Math.ceil(text.length / 4);
  }

  private static displayResults(summary: CostSummary, format: string, verbose?: boolean): void {
    if (summary.warnings.length > 0) {
      Logger.info('⚠️  Warnings:');
      summary.warnings.forEach((warning) => Logger.warn(`  ${warning}`));
      Logger.info('');
    }

    switch (format) {
      case 'json':
        console.log(JSON.stringify(summary, null, 2));
        break;

      case 'csv':
        CostCommand.displayCSV(summary);
        break;

      default:
        CostCommand.displayTable(summary, verbose);
        break;
    }
  }

  private static displayTable(summary: CostSummary, verbose?: boolean): void {
    Logger.info('💰 Cost Estimation Summary');
    Logger.info('');

    // Summary table
    console.log('┌─────────────────────────────────────┬──────────────┐');
    console.log('│ Summary                             │ Value        │');
    console.log('├─────────────────────────────────────┼──────────────┤');
    console.log(`│ Total Estimated Cost                │ $${summary.totalCost.toFixed(4).padStart(11)} │`);
    console.log(`│ Total Requests                      │ ${summary.totalRequests.toString().padStart(12)} │`);
    console.log(`│ Total Input Tokens                  │ ${summary.totalInputTokens.toLocaleString().padStart(12)} │`);
    console.log(`│ Total Output Tokens                 │ ${summary.totalOutputTokens.toLocaleString().padStart(12)} │`);
    console.log('└─────────────────────────────────────┴──────────────┘');

    if (verbose || summary.estimates.length > 1) {
      Logger.info('');
      Logger.info('Per-Provider Breakdown:');
      Logger.info('');

      console.log('┌──────────────────────────┬──────────┬───────────┬───────────┬─────────────┐');
      console.log('│ Provider                 │ Requests │ Input ($) │ Output ($)│ Total ($)   │');
      console.log('├──────────────────────────┼──────────┼───────────┼───────────┼─────────────┤');

      summary.estimates.forEach((estimate) => {
        const provider = estimate.provider.length > 24 ? estimate.provider.substring(0, 21) + '...' : estimate.provider;
        console.log(
          `│ ${provider.padEnd(24)} │ ${estimate.requests.toString().padStart(8)} │ ${estimate.inputCost.toFixed(4).padStart(9)} │ ${estimate.outputCost.toFixed(4).padStart(9)} │ ${estimate.totalCost.toFixed(4).padStart(11)} │`,
        );
      });

      console.log('└──────────────────────────┴──────────┴───────────┴───────────┴─────────────┘');
    }

    Logger.info('');
    Logger.warn('📊 This is an estimate based on average token usage patterns.');
    Logger.warn('   Actual costs may vary depending on prompt complexity and response length.');

    // Show cost-saving tips
    if (summary.totalCost > 1.0) {
      Logger.info('');
      Logger.info('💡 Cost-saving tips:');
      Logger.info('   • Consider using smaller models for initial testing');
      Logger.info('   • Reduce the number of iterations in config.iterations');
      Logger.info('   • Use more targeted test cases instead of broad evaluations');
    }
  }

  private static displayCSV(summary: CostSummary): void {
    console.log('provider,model,requests,input_tokens,output_tokens,input_cost,output_cost,total_cost');
    summary.estimates.forEach((estimate) => {
      console.log(
        `${estimate.provider},${estimate.model},${estimate.requests},${estimate.estimatedInputTokens},${estimate.estimatedOutputTokens},${estimate.inputCost},${estimate.outputCost},${estimate.totalCost}`,
      );
    });
  }
}