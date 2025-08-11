export interface BudgetThreshold {
  min?: number;
  max?: number;
  warning?: number;
}

export interface BudgetConfig {
  version: string;
  description?: string;
  
  // Quality thresholds
  quality_score?: BudgetThreshold;
  
  // Cost thresholds
  cost?: {
    max_usd?: number;
    max_tokens?: number;
    warning_usd?: number;
    warning_tokens?: number;
  };
  
  // Performance thresholds
  performance?: {
    max_latency_ms?: number;
    max_execution_time_ms?: number;
    warning_latency_ms?: number;
    warning_execution_time_ms?: number;
  };
  
  // Custom metric thresholds
  metrics?: {
    [metricName: string]: BudgetThreshold;
  };
  
  // Actions to take on violations
  actions?: {
    fail_on_violation?: boolean;
    fail_on_warning?: boolean;
    notify_channels?: string[];
    create_issue?: boolean;
  };
  
  // Environment-specific overrides
  environments?: {
    [envName: string]: Partial<BudgetConfig>;
  };
}

export interface BudgetViolation {
  type: 'error' | 'warning';
  category: 'quality' | 'cost' | 'performance' | 'custom';
  metric: string;
  actual: number;
  threshold: number;
  message: string;
}

export interface BudgetResult {
  passed: boolean;
  violations: BudgetViolation[];
  warnings: BudgetViolation[];
  summary: {
    totalViolations: number;
    totalWarnings: number;
    worstViolation?: BudgetViolation;
  };
}