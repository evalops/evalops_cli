import { InitCommand } from '../src/commands/init';
import { ValidateCommand } from '../src/commands/validate';
import { UploadCommand } from '../src/commands/upload';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

// Mock ora
jest.mock('ora', () => {
  const mockSpinner = {
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis()
  };
  return jest.fn(() => mockSpinner);
});

// Mock EvalOpsAPIClient
jest.mock('../src/lib/api-client', () => ({
  EvalOpsAPIClient: jest.fn().mockImplementation(() => ({
    validateApiKey: jest.fn().mockResolvedValue(true),
    uploadTestSuite: jest.fn().mockResolvedValue({
      id: 'test-suite-123',
      name: 'Test Suite',
      status: 'created',
      url: 'https://evalops.dev/test-suites/test-suite-123'
    }),
    constructWebUrl: jest.fn().mockReturnValue('https://evalops.dev/test-suites/test-suite-123')
  }))
}));

// Mock ConfigManager
jest.mock('../src/utils/config', () => ({
  ConfigManager: {
    getApiKey: jest.fn().mockReturnValue('mock-api-key'),
    getApiUrl: jest.fn().mockReturnValue('https://api.evalops.dev')
  }
}));

describe('Commands', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evalops-commands-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });

  describe('InitCommand', () => {
    it('should create evalops.yaml with basic template', async () => {
      await InitCommand.execute({ template: 'basic' });

      const configPath = path.join(tempDir, 'evalops.yaml');
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('description: Basic EvalOps evaluation');
      expect(content).toContain('version: "1.0"');
      expect(content).toContain('openai/gpt-4');
    });

    it('should create evalops.yaml with advanced template', async () => {
      await InitCommand.execute({ template: 'advanced' });

      const configPath = path.join(tempDir, 'evalops.yaml');
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('description: Advanced EvalOps evaluation');
      expect(content).toContain('iterations: 3');
      expect(content).toContain('anthropic/claude-2');
    });

    it('should not overwrite existing file without force flag', async () => {
      const configPath = path.join(tempDir, 'evalops.yaml');
      fs.writeFileSync(configPath, 'existing content');

      await expect(InitCommand.execute({})).resolves.not.toThrow();
      
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toBe('existing content');
    });

    it('should overwrite existing file with force flag', async () => {
      const configPath = path.join(tempDir, 'evalops.yaml');
      fs.writeFileSync(configPath, 'existing content');

      await InitCommand.execute({ force: true, template: 'basic' });
      
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('Basic EvalOps evaluation');
    });

    it('should use interactive setup when no template specified', async () => {
      const inquirer = require('inquirer');
      inquirer.prompt.mockResolvedValue({
        description: 'Interactive test',
        version: '1.0',
        systemPrompt: 'Test system prompt',
        userPrompt: 'Test user prompt',
        providers: ['openai/gpt-4'],
        addDefaultAsserts: true,
        defaultAsserts: ['contains', 'llm-judge']
      });

      await InitCommand.execute({});

      expect(inquirer.prompt).toHaveBeenCalled();
      
      const configPath = path.join(tempDir, 'evalops.yaml');
      expect(fs.existsSync(configPath)).toBe(true);
      
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('Interactive test');
    });
  });

  describe('ValidateCommand', () => {
    it('should validate a correct configuration file', async () => {
      const configContent = `
description: Test configuration
version: "1.0"
prompts:
  - role: system
    content: You are helpful
  - role: user
    content: "Analyze: {{code}}"
providers:
  - "openai/gpt-4"
tests: []
`;
      fs.writeFileSync('evalops.yaml', configContent);

      await expect(ValidateCommand.execute({})).resolves.not.toThrow();
    });

    it('should fail validation for missing required fields', async () => {
      const configContent = `
description: Test configuration
# missing version, prompts, and providers
`;
      fs.writeFileSync('evalops.yaml', configContent);

      await expect(ValidateCommand.execute({})).rejects.toThrow();
    });

    it('should fail validation for non-existent file', async () => {
      await expect(ValidateCommand.execute({ file: 'nonexistent.yaml' })).rejects.toThrow('Configuration file not found');
    });

    it('should validate file references', async () => {
      const promptFile = 'system-prompt.txt';
      fs.writeFileSync(promptFile, 'You are a helpful assistant');

      const configContent = `
description: Test with file references
version: "1.0"
prompts: "@system-prompt.txt"
providers:
  - "openai/gpt-4"
tests: []
`;
      fs.writeFileSync('evalops.yaml', configContent);

      await expect(ValidateCommand.execute({})).resolves.not.toThrow();
    });

    it('should discover and report test cases', async () => {
      const configContent = `
description: Test configuration
version: "1.0"
prompts: "Analyze: {{code}}"
providers: ["openai/gpt-4"]
tests: []
`;
      fs.writeFileSync('evalops.yaml', configContent);

      // Create a test file
      const testFile = 'test.eval.ts';
      const testContent = `
@evalops_test({
  description: 'Test case'
})
function testFunction() {
  return 'test';
}
`;
      fs.writeFileSync(testFile, testContent);

      await expect(ValidateCommand.execute({ verbose: true })).resolves.not.toThrow();
    });
  });

  describe('UploadCommand', () => {
    it('should upload configuration successfully', async () => {
      const configContent = `
description: Upload test
version: "1.0"
prompts: "Test prompt"
providers: ["openai/gpt-4"]
tests: []
`;
      fs.writeFileSync('evalops.yaml', configContent);

      await expect(UploadCommand.execute({})).resolves.not.toThrow();

      const { EvalOpsAPIClient } = require('../src/lib/api-client');
      const mockInstance = EvalOpsAPIClient.mock.results[0].value;
      expect(mockInstance.uploadTestSuite).toHaveBeenCalled();
    });

    it('should fail without API key', async () => {
      const { ConfigManager } = require('../src/utils/config');
      ConfigManager.getApiKey.mockReturnValue(undefined);

      const configContent = `
description: Upload test
version: "1.0"
prompts: "Test prompt"
providers: ["openai/gpt-4"]
tests: []
`;
      fs.writeFileSync('evalops.yaml', configContent);

      await expect(UploadCommand.execute({})).rejects.toThrow('API key is required');
    });

    it('should fail for non-existent config file', async () => {
      await expect(UploadCommand.execute({})).rejects.toThrow('Configuration file not found');
    });

    it('should perform dry run without uploading', async () => {
      const configContent = `
description: Dry run test
version: "1.0"
prompts: "Test prompt"
providers: ["openai/gpt-4"]
tests: []
`;
      fs.writeFileSync('evalops.yaml', configContent);

      await expect(UploadCommand.execute({ dryRun: true })).resolves.not.toThrow();

      const { EvalOpsAPIClient } = require('../src/lib/api-client');
      const mockInstance = EvalOpsAPIClient.mock.results[0].value;
      expect(mockInstance.uploadTestSuite).not.toHaveBeenCalled();
    });

    it('should include discovered test cases in upload', async () => {
      const configContent = `
description: Test with discoveries
version: "1.0"
prompts: "Test prompt"
providers: ["openai/gpt-4"]
tests: []
`;
      fs.writeFileSync('evalops.yaml', configContent);

      // Create a test file
      const testFile = 'discovered.eval.ts';
      const testContent = `
@evalops_test({
  description: 'Discovered test'
})
function testDiscovered() {
  return 'discovered';
}
`;
      fs.writeFileSync(testFile, testContent);

      await expect(UploadCommand.execute({})).resolves.not.toThrow();

      const { EvalOpsAPIClient } = require('../src/lib/api-client');
      const mockInstance = EvalOpsAPIClient.mock.results[0].value;
      const uploadCall = mockInstance.uploadTestSuite.mock.calls[0][0];
      
      expect(uploadCall.content).toContain('Discovered test');
    });
  });
});