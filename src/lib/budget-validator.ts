import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { BudgetConfig, BudgetViolation, BudgetResult, BudgetThreshold } from '../types/budget';
import { Logger } from '../utils/logger';

export interface EvaluationMetrics {
  quality_score: number;
  cost_usd: number;
  tokens_used: number;
  avg_latency_ms: number;
  total_execution_time_ms: number;
  custom_metrics?: { [key: string]: number };
}

export class BudgetValidator {
  private config: BudgetConfig;

  constructor(configPath: string, environment?: string) {
    this.config = BudgetValidator.loadBudgetConfig(configPath, environment);
  }

  static loadBudgetConfig(configPath: string, environment?: string): BudgetConfig {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Budget configuration file not found: ${configPath}`);
    }

    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(content) as BudgetConfig;
      
      // Apply environment-specific overrides
      if (environment && config.environments?.[environment]) {
        return { ...config, ...config.environments[environment] };
      }
      
      return config;
    } catch (error) {
      throw new Error(`Failed to parse budget configuration: ${error instanceof Error ? error.message : error}`);
    }
  }

  validateMetrics(metrics: EvaluationMetrics): BudgetResult {
    const violations: BudgetViolation[] = [];
    const warnings: BudgetViolation[] = [];

    // Quality score validation
    if (this.config.quality_score) {
      const qualityViolations = this.checkThreshold(
        'quality_score',
        'quality',
        metrics.quality_score,
        this.config.quality_score
      );
      violations.push(...qualityViolations.violations);
      warnings.push(...qualityViolations.warnings);
    }

    // Cost validation
    if (this.config.cost) {
      if (this.config.cost.max_usd && metrics.cost_usd > this.config.cost.max_usd) {
        violations.push({
          type: 'error',
          category: 'cost',
          metric: 'cost_usd',
          actual: metrics.cost_usd,
          threshold: this.config.cost.max_usd,
          message: `Cost $${metrics.cost_usd} exceeds budget limit $${this.config.cost.max_usd}`
        });
      }

      if (this.config.cost.warning_usd && metrics.cost_usd > this.config.cost.warning_usd) {
        warnings.push({
          type: 'warning',
          category: 'cost',
          metric: 'cost_usd',
          actual: metrics.cost_usd,
          threshold: this.config.cost.warning_usd,
          message: `Cost $${metrics.cost_usd} exceeds warning threshold $${this.config.cost.warning_usd}`
        });
      }

      if (this.config.cost.max_tokens && metrics.tokens_used > this.config.cost.max_tokens) {
        violations.push({
          type: 'error',
          category: 'cost',
          metric: 'tokens_used',
          actual: metrics.tokens_used,
          threshold: this.config.cost.max_tokens,
          message: `Token usage ${metrics.tokens_used} exceeds limit ${this.config.cost.max_tokens}`
        });
      }
    }

    // Performance validation
    if (this.config.performance) {
      if (this.config.performance.max_latency_ms && metrics.avg_latency_ms > this.config.performance.max_latency_ms) {
        violations.push({
          type: 'error',
          category: 'performance',
          metric: 'avg_latency_ms',
          actual: metrics.avg_latency_ms,
          threshold: this.config.performance.max_latency_ms,
          message: `Average latency ${metrics.avg_latency_ms}ms exceeds limit ${this.config.performance.max_latency_ms}ms`
        });
      }

      if (this.config.performance.warning_latency_ms && metrics.avg_latency_ms > this.config.performance.warning_latency_ms) {
        warnings.push({
          type: 'warning',
          category: 'performance',
          metric: 'avg_latency_ms',
          actual: metrics.avg_latency_ms,
          threshold: this.config.performance.warning_latency_ms,
          message: `Average latency ${metrics.avg_latency_ms}ms exceeds warning threshold ${this.config.performance.warning_latency_ms}ms`
        });
      }

      if (this.config.performance.max_execution_time_ms && metrics.total_execution_time_ms > this.config.performance.max_execution_time_ms) {
        violations.push({
          type: 'error',
          category: 'performance',
          metric: 'total_execution_time_ms',
          actual: metrics.total_execution_time_ms,
          threshold: this.config.performance.max_execution_time_ms,
          message: `Total execution time ${metrics.total_execution_time_ms}ms exceeds limit ${this.config.performance.max_execution_time_ms}ms`
        });
      }
    }

    // Custom metrics validation
    if (this.config.metrics && metrics.custom_metrics) {
      for (const [metricName, threshold] of Object.entries(this.config.metrics)) {
        const actualValue = metrics.custom_metrics[metricName];
        if (actualValue !== undefined) {
          const metricViolations = this.checkThreshold(
            metricName,
            'custom',
            actualValue,
            threshold
          );
          violations.push(...metricViolations.violations);
          warnings.push(...metricViolations.warnings);
        }
      }
    }

    const passed = violations.length === 0 && (this.config.actions?.fail_on_warning !== true || warnings.length === 0);
    const worstViolation = [...violations, ...warnings]
      .sort((a, b) => Math.abs(b.actual - b.threshold) - Math.abs(a.actual - a.threshold))[0];

    return {
      passed,
      violations,
      warnings,
      summary: {
        totalViolations: violations.length,
        totalWarnings: warnings.length,
        worstViolation
      }
    };
  }

  private checkThreshold(
    metricName: string,
    category: BudgetViolation['category'],
    actual: number,
    threshold: BudgetThreshold
  ): { violations: BudgetViolation[], warnings: BudgetViolation[] } {
    const violations: BudgetViolation[] = [];
    const warnings: BudgetViolation[] = [];

    if (threshold.min !== undefined && actual < threshold.min) {
      violations.push({
        type: 'error',
        category,
        metric: metricName,
        actual,
        threshold: threshold.min,
        message: `${metricName} value ${actual} is below minimum threshold ${threshold.min}`
      });
    }

    if (threshold.max !== undefined && actual > threshold.max) {
      violations.push({
        type: 'error',
        category,
        metric: metricName,
        actual,
        threshold: threshold.max,
        message: `${metricName} value ${actual} exceeds maximum threshold ${threshold.max}`
      });
    }

    if (threshold.warning !== undefined) {
      if ((threshold.min !== undefined && actual < threshold.warning) ||
          (threshold.max !== undefined && actual > threshold.warning)) {
        warnings.push({
          type: 'warning',
          category,
          metric: metricName,
          actual,
          threshold: threshold.warning,
          message: `${metricName} value ${actual} exceeds warning threshold ${threshold.warning}`
        });
      }
    }

    return { violations, warnings };
  }

  static createDefaultBudgetConfig(outputPath: string): void {
    const defaultConfig: BudgetConfig = {
      version: '1.0',
      description: 'Default budget configuration for EvalOps evaluations',
      
      quality_score: {
        min: 0.6,
        warning: 0.7
      },
      
      cost: {
        max_usd: 10.0,
        warning_usd: 5.0,
        max_tokens: 100000,
        warning_tokens: 50000
      },
      
      performance: {
        max_latency_ms: 5000,
        warning_latency_ms: 3000,
        max_execution_time_ms: 300000 // 5 minutes
      },
      
      actions: {
        fail_on_violation: true,
        fail_on_warning: false,
        notify_channels: [],
        create_issue: false
      },
      
      environments: {
        development: {
          cost: { max_usd: 1.0, warning_usd: 0.5 }
        },
        staging: {
          cost: { max_usd: 5.0, warning_usd: 2.5 }
        },
        production: {
          quality_score: { min: 0.8, warning: 0.85 },
          cost: { max_usd: 50.0, warning_usd: 25.0 }
        }
      }
    };

    const yamlContent = yaml.dump(defaultConfig, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });

    fs.writeFileSync(outputPath, yamlContent, 'utf8');
    Logger.success(`Created default budget configuration: ${outputPath}`);
  }

  displayResults(result: BudgetResult): void {
    if (result.passed) {
      Logger.success('✅ All budget checks passed!');
    } else {
      Logger.error(`❌ Budget validation failed with ${result.summary.totalViolations} violation(s)`);
    }

    if (result.summary.totalWarnings > 0) {
      Logger.warn(`⚠️  ${result.summary.totalWarnings} warning(s) detected`);
    }

    // Display violations
    if (result.violations.length > 0) {
      Logger.info('');
      Logger.info('🚨 Budget Violations:');
      result.violations.forEach((violation, index) => {
        Logger.error(`  ${index + 1}. ${violation.message}`);
      });
    }

    // Display warnings
    if (result.warnings.length > 0) {
      Logger.info('');
      Logger.info('⚠️  Budget Warnings:');
      result.warnings.forEach((warning, index) => {
        Logger.warn(`  ${index + 1}. ${warning.message}`);
      });
    }

    // Show summary table
    if (result.violations.length > 0 || result.warnings.length > 0) {
      Logger.info('');
      Logger.info('📊 Budget Summary:');
      console.log('┌─────────────────────────────────────┬──────────────┐');
      console.log('│ Metric                              │ Status       │');
      console.log('├─────────────────────────────────────┼──────────────┤');
      console.log(`│ Total Violations                    │ ${result.summary.totalViolations.toString().padStart(12)} │`);
      console.log(`│ Total Warnings                     │ ${result.summary.totalWarnings.toString().padStart(12)} │`);
      console.log(`│ Overall Status                      │ ${(result.passed ? 'PASS' : 'FAIL').padStart(12)} │`);
      console.log('└─────────────────────────────────────┴──────────────┘');
    }
  }
}