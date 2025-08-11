export interface EvaluationConfig {
  description: string;
  version: string;
  prompts: Prompt | Prompt[];
  providers: Provider[];
  defaultTest?: TestDefaults;
  tests: TestCase[];
  config?: ExecutionConfig;
  outputPath?: string;
  outputFormat?: 'json' | 'yaml' | 'csv';
  sharing?: SharingConfig;
}

export type Prompt = string | PromptMessage | PromptMessage[];

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type Provider = string | ProviderConfig;

export interface ProviderConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: any;
}

export interface TestDefaults {
  assert?: AssertConfig[];
  vars?: Record<string, any>;
}

export interface TestCase {
  description: string;
  vars?: Record<string, any>;
  assert?: AssertConfig[];
  prompt?: Prompt;
  skip?: boolean;
  tags?: string[];
}

export interface AssertConfig {
  type: 'contains' | 'not-contains' | 'equals' | 'not-equals' | 'llm-judge' | 'regex' | 'json-path' | 'similarity';
  value: any;
  weight?: number;
  threshold?: number;
}

export interface ExecutionConfig {
  iterations?: number;
  parallel?: boolean;
  timeout?: number;
  maxRetries?: number;
}

export interface SharingConfig {
  public?: boolean;
  allowForks?: boolean;
  collaborators?: string[];
}

export interface TestCaseMetadata {
  filePath: string;
  functionName: string;
  lineNumber: number;
  description?: string;
  tags?: string[];
}

export interface ParsedTestCase extends TestCase {
  metadata: TestCaseMetadata;
}

export interface EvalOpsTestDecorator {
  prompt?: Prompt;
  asserts?: AssertConfig[];
  vars?: Record<string, any>;
  description?: string;
  tags?: string[];
  skip?: boolean;
}

export interface APIUploadRequest {
  format: 'yaml' | 'json';
  content: string;
  name?: string;
}

export interface APIUploadResponse {
  id: string;
  url: string;
  name: string;
  status: 'created' | 'processing' | 'completed' | 'failed';
}

export interface CLIConfig {
  apiKey?: string;
  apiUrl?: string;
  defaultOutputFormat?: 'json' | 'yaml' | 'csv';
  debug?: boolean;
}
