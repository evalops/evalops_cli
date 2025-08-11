import type { APIUploadRequest, APIUploadResponse, EvaluationConfig, PromptMessage } from '../types';

interface TestCase {
  name: string;
  description?: string;
  input: {
    prompt: string;
    context?: Record<string, unknown>;
    systemPrompt?: string;
  };
  expectedOutput?: {
    contains?: string[];
    notContains?: string[];
    matches?: string[];
  };
  assertions: Array<{
    type: string;
    config: Record<string, unknown>;
    weight?: number;
  }>;
  tags?: string[];
}

interface TestSuiteRequest {
  name: string;
  description?: string;
  testCases: TestCase[];
  config: {
    models: string[];
    iterations?: number;
    parallel?: boolean;
    timeout?: number;
    costLimit?: number;
  };
}

interface TestRunRequest {
  testSuiteId: string;
  visibility?: 'private' | 'team' | 'organization';
  config?: Record<string, unknown>;
}

interface TestRunResponse {
  id: string;
  testSuiteId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  metrics?: {
    qualityScore: number;
    totalCost: number;
    tokensUsed: number;
    avgLatencyMs: number;
    totalExecutionTimeMs: number;
  };
  results?: Array<{
    score: number;
    passed: boolean;
    feedback?: string;
  }>;
}

export class EvalOpsAPIClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.evalops.dev') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  async uploadTestSuite(request: APIUploadRequest): Promise<APIUploadResponse> {
    const url = `${this.baseUrl}/api/v1/test-suites/import`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'evalops-cli/1.0.0',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Use the raw error text if it's not JSON
          if (errorText) {
            errorMessage = errorText;
          }
        }

        throw new Error(`Upload failed: ${errorMessage}`);
      }

      const result = await response.json();
      return result as APIUploadResponse;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new Error(
            `Network error: Unable to connect to ${url}. Please check your internet connection and API URL.`,
          );
        }
        throw error;
      }
      throw new Error(`Upload failed: ${error}`);
    }
  }

  async validateApiKey(): Promise<boolean> {
    const url = `${this.baseUrl}/api/v1/auth/validate`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': 'evalops-cli/1.0.0',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async getTestSuite(id: string): Promise<any> {
    const url = `${this.baseUrl}/api/v1/test-suites/${id}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': 'evalops-cli/1.0.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch test suite: HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to fetch test suite: ${error}`);
    }
  }

  constructWebUrl(testSuiteId: string): string {
    // Convert API URL to web URL
    const webUrl = this.baseUrl.replace('api.', '').replace('/api', '');
    return `${webUrl}/test-suites/${testSuiteId}`;
  }

  /**
   * Transform EvalOps YAML configuration to platform API format
   */
  transformConfigToTestSuite(config: EvaluationConfig): TestSuiteRequest {
    // Extract models from providers
    const models = (config.providers || []).map(provider => {
      if (typeof provider === 'string') {
        return provider;
      }
      return `${provider.provider}/${provider.model}`;
    });

    // Transform test cases
    const testCases: TestCase[] = (config.tests || []).map((test, index) => {
      // Build the prompt from config
      let prompt = '';
      let systemPrompt: string | undefined;
      
      if (typeof config.prompts === 'string') {
        prompt = config.prompts;
      } else if (Array.isArray(config.prompts)) {
        // Handle array of PromptMessage objects
        const promptMessages = config.prompts.filter(p => typeof p === 'object' && 'role' in p) as PromptMessage[];
        prompt = promptMessages
          .filter(p => p.role === 'user')
          .map(p => p.content)
          .join('\n');
        systemPrompt = promptMessages.find(p => p.role === 'system')?.content;
      } else if (typeof config.prompts === 'object' && 'role' in config.prompts) {
        // Handle single PromptMessage object
        if (config.prompts.role === 'user') {
          prompt = config.prompts.content;
        } else if (config.prompts.role === 'system') {
          systemPrompt = config.prompts.content;
        }
      }

      // Merge with test-specific prompt
      if (test.vars?.prompt) {
        prompt = test.vars.prompt as string;
      }

      return {
        name: test.description || `Test Case ${index + 1}`,
        description: test.metadata?.description as string | undefined,
        input: {
          prompt,
          context: test.vars as Record<string, unknown> | undefined,
          systemPrompt,
        },
        expectedOutput: test.expected ? {
          contains: typeof test.expected === 'string' ? [test.expected] : undefined,
        } : undefined,
        assertions: (test.assert || config.defaultTest?.assert || []).map(assertion => ({
          type: assertion.type,
          config: {
            value: assertion.value,
            threshold: assertion.threshold,
            ...(assertion as any),
          },
          weight: assertion.weight,
        })),
        tags: test.metadata?.tags as string[] | undefined,
      };
    });

    return {
      name: config.description || 'EvalOps Test Suite',
      description: config.description,
      testCases,
      config: {
        models,
        iterations: config.config?.iterations,
        parallel: config.config?.parallel,
        timeout: config.config?.timeout,
        costLimit: config.config?.costLimit,
      },
    };
  }

  /**
   * Create a test suite on the platform
   */
  async createTestSuite(request: TestSuiteRequest): Promise<APIUploadResponse> {
    const url = `${this.baseUrl}/api/v1/test-suites`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'evalops-cli/1.0.0',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create test suite: ${errorText}`);
      }

      const result = await response.json() as any;
      return {
        id: result.id,
        name: result.name,
        status: 'created',
        url: `${this.baseUrl}/test-suites/${result.id}`,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to create test suite: ${error}`);
    }
  }

  /**
   * Execute a test run for a test suite
   */
  async createTestRun(testSuiteId: string, visibility?: string): Promise<TestRunResponse> {
    const url = `${this.baseUrl}/api/v1/test-runs`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'evalops-cli/1.0.0',
        },
        body: JSON.stringify({
          testSuiteId,
          visibility: visibility || 'team',
        } as TestRunRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create test run: ${errorText}`);
      }

      return await response.json() as TestRunResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to create test run: ${error}`);
    }
  }

  /**
   * Get test run status and results
   */
  async getTestRun(testRunId: string): Promise<TestRunResponse> {
    const url = `${this.baseUrl}/api/v1/test-runs/${testRunId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'evalops-cli/1.0.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch test run: HTTP ${response.status}`);
      }

      return await response.json() as TestRunResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to fetch test run: ${error}`);
    }
  }

  /**
   * Poll test run until completion
   */
  async pollTestRun(testRunId: string, maxWaitMs: number = 300000): Promise<TestRunResponse> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxWaitMs) {
      const testRun = await this.getTestRun(testRunId);
      
      if (testRun.status === 'completed' || testRun.status === 'failed') {
        return testRun;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Test run timeout after ${maxWaitMs}ms`);
  }
}
