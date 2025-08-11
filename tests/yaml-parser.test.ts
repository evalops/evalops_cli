import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { YamlParser } from '../src/lib/yaml-parser';
import type { EvaluationConfig } from '../src/types';

describe('YamlParser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evalops-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const validConfig: EvaluationConfig = {
    description: 'Test configuration',
    version: '1.0',
    prompts: [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Analyze: {{code}}' },
    ],
    providers: ['openai/gpt-4'],
    tests: [],
    config: {
      iterations: 1,
      parallel: true,
      timeout: 60,
    },
  };

  describe('parseString', () => {
    it('should parse valid YAML configuration', () => {
      const yamlString = `
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
config:
  iterations: 1
  parallel: true
  timeout: 60
`;

      const result = YamlParser.parseString(yamlString);
      expect(result.description).toBe('Test configuration');
      expect(result.version).toBe('1.0');
      expect(result.providers).toEqual(['openai/gpt-4']);
    });

    it('should throw error for invalid YAML', () => {
      const invalidYaml = `
description: Test
invalid: [unclosed array
`;

      expect(() => YamlParser.parseString(invalidYaml)).toThrow('Failed to parse YAML');
    });

    it('should throw error for missing required fields', () => {
      const incompleteYaml = `
description: Test
version: "1.0"
# missing prompts and providers
`;

      expect(() => YamlParser.parseString(incompleteYaml)).toThrow('Missing required field');
    });
  });

  describe('parseFile', () => {
    it('should parse configuration from file', () => {
      const configPath = path.join(tempDir, 'test-config.yaml');
      const yamlContent = YamlParser.stringify(validConfig);
      fs.writeFileSync(configPath, yamlContent);

      const result = YamlParser.parseFile(configPath);
      expect(result.description).toBe('Test configuration');
    });

    it('should throw error for non-existent file', () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.yaml');
      expect(() => YamlParser.parseFile(nonExistentPath)).toThrow(/Failed to read configuration file/);
    });
  });

  describe('stringify', () => {
    it('should convert configuration to YAML string', () => {
      const yamlString = YamlParser.stringify(validConfig);
      expect(yamlString).toContain('description: Test configuration');
      expect(yamlString).toMatch(/version: ['"]1\.0['"]/);
      expect(yamlString).toContain('- openai/gpt-4');
    });

    it('should handle complex provider configurations', () => {
      const configWithComplexProviders: EvaluationConfig = {
        ...validConfig,
        providers: [
          'openai/gpt-4',
          {
            provider: 'anthropic',
            model: 'claude-2',
            temperature: 0.7,
          },
        ],
      };

      const yamlString = YamlParser.stringify(configWithComplexProviders);
      expect(yamlString).toContain('provider: anthropic');
      expect(yamlString).toContain('temperature: 0.7');
    });
  });

  describe('writeFile', () => {
    it('should write configuration to file', () => {
      const configPath = path.join(tempDir, 'output.yaml');
      YamlParser.writeFile(configPath, validConfig);

      expect(fs.existsSync(configPath)).toBe(true);
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('description: Test configuration');
    });

    it('should create directories if they do not exist', () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'config.yaml');
      YamlParser.writeFile(nestedPath, validConfig);

      expect(fs.existsSync(nestedPath)).toBe(true);
    });
  });

  describe('resolveFileReferences', () => {
    it('should resolve file references with @ prefix', () => {
      const promptFile = path.join(tempDir, 'prompt.txt');
      fs.writeFileSync(promptFile, 'Analyze the following code carefully');

      const configWithRefs: EvaluationConfig = {
        ...validConfig,
        prompts: '@prompt.txt',
      };

      const resolved = YamlParser.resolveFileReferences(configWithRefs, tempDir);
      expect(resolved.prompts).toBe('Analyze the following code carefully');
    });

    it('should resolve nested file references', () => {
      const systemPromptFile = path.join(tempDir, 'system.txt');
      const userPromptFile = path.join(tempDir, 'user.txt');

      fs.writeFileSync(systemPromptFile, 'You are a helpful assistant');
      fs.writeFileSync(userPromptFile, 'Please analyze: {{code}}');

      const configWithRefs: EvaluationConfig = {
        ...validConfig,
        prompts: [
          { role: 'system', content: '@system.txt' },
          { role: 'user', content: '@user.txt' },
        ],
      };

      const resolved = YamlParser.resolveFileReferences(configWithRefs, tempDir);
      expect((resolved.prompts as any)[0].content).toBe('You are a helpful assistant');
      expect((resolved.prompts as any)[1].content).toBe('Please analyze: {{code}}');
    });

    it('should throw error for missing referenced file', () => {
      const configWithBadRef: EvaluationConfig = {
        ...validConfig,
        prompts: '@missing-file.txt',
      };

      expect(() => YamlParser.resolveFileReferences(configWithBadRef, tempDir)).toThrow(
        'Failed to read referenced file',
      );
    });

    it('should leave non-reference strings unchanged', () => {
      const config: EvaluationConfig = {
        ...validConfig,
        prompts: 'Regular prompt without reference',
      };

      const resolved = YamlParser.resolveFileReferences(config, tempDir);
      expect(resolved.prompts).toBe('Regular prompt without reference');
    });
  });
});
