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
    // OpenAI Models - All prices per 1K tokens
    'openai/gpt-4': {
      inputTokenCost: 0.03, // $30 per 1M tokens
      outputTokenCost: 0.06, // $60 per 1M tokens
      requestCost: 0,
    },
    'openai/gpt-4-turbo': {
      inputTokenCost: 0.01, // $10 per 1M tokens
      outputTokenCost: 0.03, // $30 per 1M tokens
      requestCost: 0,
    },
    'openai/gpt-4o': {
      inputTokenCost: 0.0025, // $2.50 per 1M tokens
      outputTokenCost: 0.01, // $10 per 1M tokens
      requestCost: 0,
    },
    'openai/gpt-4o-mini': {
      inputTokenCost: 0.00015, // $0.15 per 1M tokens
      outputTokenCost: 0.0006, // $0.60 per 1M tokens
      requestCost: 0,
    },
    'openai/gpt-3.5-turbo': {
      inputTokenCost: 0.0005, // $0.50 per 1M tokens
      outputTokenCost: 0.0015, // $1.50 per 1M tokens
      requestCost: 0,
    },
    'openai/gpt-3.5-turbo-16k': {
      inputTokenCost: 0.003, // $3 per 1M tokens
      outputTokenCost: 0.004, // $4 per 1M tokens
      requestCost: 0,
    },
    
    // Anthropic Models - All prices per 1K tokens
    'anthropic/claude-3-opus': {
      inputTokenCost: 0.015, // $15 per 1M tokens
      outputTokenCost: 0.075, // $75 per 1M tokens
      requestCost: 0,
    },
    'anthropic/claude-3-sonnet': {
      inputTokenCost: 0.003, // $3 per 1M tokens
      outputTokenCost: 0.015, // $15 per 1M tokens
      requestCost: 0,
    },
    'anthropic/claude-3.5-sonnet': {
      inputTokenCost: 0.003, // $3 per 1M tokens
      outputTokenCost: 0.015, // $15 per 1M tokens
      requestCost: 0,
    },
    'anthropic/claude-3.7-sonnet': {
      inputTokenCost: 0.003, // $3 per 1M tokens (includes thinking tokens)
      outputTokenCost: 0.015, // $15 per 1M tokens
      requestCost: 0,
    },
    'anthropic/claude-sonnet-4': {
      inputTokenCost: 0.003, // $3 per 1M tokens
      outputTokenCost: 0.015, // $15 per 1M tokens
      requestCost: 0,
    },
    'anthropic/claude-3-haiku': {
      inputTokenCost: 0.00025, // $0.25 per 1M tokens
      outputTokenCost: 0.00125, // $1.25 per 1M tokens
      requestCost: 0,
    },
    'anthropic/claude-3.5-haiku': {
      inputTokenCost: 0.0008, // $0.80 per 1M tokens
      outputTokenCost: 0.004, // $4 per 1M tokens
      requestCost: 0,
    },
    'anthropic/claude-2.1': {
      inputTokenCost: 0.008, // $8 per 1M tokens
      outputTokenCost: 0.024, // $24 per 1M tokens
      requestCost: 0,
    },
    'anthropic/claude-2': {
      inputTokenCost: 0.008, // $8 per 1M tokens
      outputTokenCost: 0.024, // $24 per 1M tokens
      requestCost: 0,
    },
    
    // Google Models - All prices per 1K tokens
    'google/gemini-pro': {
      inputTokenCost: 0.0005, // $0.50 per 1M tokens
      outputTokenCost: 0.0015, // $1.50 per 1M tokens
      requestCost: 0,
    },
    'google/gemini-pro-vision': {
      inputTokenCost: 0.00025, // $0.25 per 1M tokens
      outputTokenCost: 0.00125, // $1.25 per 1M tokens
      requestCost: 0,
    },
    'google/gemini-1.5-pro': {
      inputTokenCost: 0.00125, // $1.25 per 1M tokens (up to 128K)
      outputTokenCost: 0.005, // $5.00 per 1M tokens (up to 128K)
      requestCost: 0,
    },
    'google/gemini-1.5-flash': {
      inputTokenCost: 0.000075, // $0.075 per 1M tokens (up to 128K)
      outputTokenCost: 0.0003, // $0.30 per 1M tokens (up to 128K)
      requestCost: 0,
    },
    'google/gemini-2.0-flash': {
      inputTokenCost: 0.0001, // $0.10 per 1M tokens
      outputTokenCost: 0.0004, // $0.40 per 1M tokens
      requestCost: 0,
    },
    'google/gemini-2.5-pro': {
      inputTokenCost: 0.00125, // $1.25 per 1M tokens (up to 200K)
      outputTokenCost: 0.01, // $10 per 1M tokens (up to 200K)
      requestCost: 0,
    },
    
    // Cohere Models
    'cohere/command': {
      inputTokenCost: 0.0015, // $1.50 per 1M tokens
      outputTokenCost: 0.002, // $2.00 per 1M tokens
      requestCost: 0,
    },
    'cohere/command-light': {
      inputTokenCost: 0.0003, // $0.30 per 1M tokens
      outputTokenCost: 0.0006, // $0.60 per 1M tokens
      requestCost: 0,
    },
    'cohere/command-r': {
      inputTokenCost: 0.0005, // $0.50 per 1M tokens
      outputTokenCost: 0.0015, // $1.50 per 1M tokens
      requestCost: 0,
    },
    'cohere/command-r-plus': {
      inputTokenCost: 0.003, // $3.00 per 1M tokens
      outputTokenCost: 0.015, // $15.00 per 1M tokens
      requestCost: 0,
    },
    
    // Meta Llama Models (via various providers)
    'meta/llama-3-8b': {
      inputTokenCost: 0.0002, // $0.20 per 1M tokens
      outputTokenCost: 0.0002, // $0.20 per 1M tokens
      requestCost: 0,
    },
    'meta/llama-3-70b': {
      inputTokenCost: 0.0008, // $0.80 per 1M tokens
      outputTokenCost: 0.0008, // $0.80 per 1M tokens
      requestCost: 0,
    },
    'meta/llama-3-405b': {
      inputTokenCost: 0.002, // $2.00 per 1M tokens
      outputTokenCost: 0.002, // $2.00 per 1M tokens
      requestCost: 0,
    },
    
    // Mistral Models
    'mistral/mistral-tiny': {
      inputTokenCost: 0.00025, // $0.25 per 1M tokens
      outputTokenCost: 0.00025, // $0.25 per 1M tokens
      requestCost: 0,
    },
    'mistral/mistral-small': {
      inputTokenCost: 0.001, // $1.00 per 1M tokens
      outputTokenCost: 0.003, // $3.00 per 1M tokens
      requestCost: 0,
    },
    'mistral/mistral-medium': {
      inputTokenCost: 0.0027, // $2.70 per 1M tokens
      outputTokenCost: 0.0081, // $8.10 per 1M tokens
      requestCost: 0,
    },
    'mistral/mistral-large': {
      inputTokenCost: 0.008, // $8.00 per 1M tokens
      outputTokenCost: 0.024, // $24.00 per 1M tokens
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

    if (options.format !== 'json') {
      Logger.info('💰 Calculating cost estimate...');
    }

    // Load and parse configuration
    let config: EvaluationConfig;
    try {
      config = YamlParser.parseFile(configPath);
      if (options.verbose && options.format !== 'json') {
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
      if (options.verbose && options.format !== 'json') {
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
      if (options.verbose && options.format !== 'json') {
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