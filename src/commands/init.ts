import * as fs from 'fs';
import * as path from 'path';
import { inquirer } from 'inquirer';
import { EvaluationConfig } from '../types';
import { YamlParser } from '../lib/yaml-parser';
import { Logger } from '../utils/logger';

interface InitOptions {
  force?: boolean;
  template?: 'basic' | 'advanced';
}

export class InitCommand {
  static async execute(options: InitOptions): Promise<void> {
    const configPath = path.resolve('./evalops.yaml');
    
    // Check if file already exists
    if (fs.existsSync(configPath) && !options.force) {
      Logger.error(`Configuration file already exists: ${configPath}`);
      Logger.info('Use --force to overwrite the existing file');
      return;
    }

    Logger.info('Initializing new EvalOps project...');
    
    let config: EvaluationConfig;
    
    if (options.template) {
      config = this.getTemplate(options.template);
    } else {
      config = await this.interactiveSetup();
    }
    
    try {
      YamlParser.writeFile(configPath, config);
      Logger.success(`Created ${configPath}`);
      Logger.info('');
      Logger.info('Next steps:');
      Logger.info('1. Add test cases to your code using @evalops_test decorators');
      Logger.info('2. Run "evalops validate" to check your configuration');
      Logger.info('3. Run "evalops upload" to upload your test suite');
    } catch (error) {
      Logger.error(`Failed to create configuration file: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  private static async interactiveSetup(): Promise<EvaluationConfig> {
    Logger.info('Setting up your EvalOps configuration...');
    Logger.newline();

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Project description:',
        default: 'My EvalOps evaluation project',
        validate: (input: string) => input.trim().length > 0 || 'Description is required'
      },
      {
        type: 'list',
        name: 'version',
        message: 'Configuration version:',
        choices: ['1.0', '2.0'],
        default: '1.0'
      },
      {
        type: 'input',
        name: 'systemPrompt',
        message: 'System prompt:',
        default: 'You are a helpful assistant.'
      },
      {
        type: 'input',
        name: 'userPrompt',
        message: 'User prompt template (use {{code}} for code variable):',
        default: 'Analyze the following code: {{code}}'
      },
      {
        type: 'checkbox',
        name: 'providers',
        message: 'Select LLM providers:',
        choices: [
          { name: 'OpenAI GPT-4', value: 'openai/gpt-4', checked: true },
          { name: 'OpenAI GPT-3.5-turbo', value: 'openai/gpt-3.5-turbo' },
          { name: 'Anthropic Claude-2', value: 'anthropic/claude-2' },
          { name: 'Anthropic Claude-3-haiku', value: 'anthropic/claude-3-haiku' },
          { name: 'Custom provider', value: 'custom' }
        ],
        validate: (input: string[]) => input.length > 0 || 'At least one provider is required'
      },
      {
        type: 'input',
        name: 'customProvider',
        message: 'Enter custom provider (format: provider/model):',
        when: (answers: any) => answers.providers.includes('custom'),
        validate: (input: string) => /^[\w-]+\/[\w-]+$/.test(input) || 'Invalid format. Use: provider/model'
      },
      {
        type: 'confirm',
        name: 'addDefaultAsserts',
        message: 'Add default assertions?',
        default: true
      },
      {
        type: 'checkbox',
        name: 'defaultAsserts',
        message: 'Select default assertion types:',
        when: (answers: any) => answers.addDefaultAsserts,
        choices: [
          { name: 'Contains text', value: 'contains', checked: true },
          { name: 'LLM Judge', value: 'llm-judge', checked: true },
          { name: 'Regex match', value: 'regex' },
          { name: 'JSON path', value: 'json-path' }
        ]
      }
    ]);

    // Handle custom provider
    let providers = answers.providers.filter((p: string) => p !== 'custom');
    if (answers.customProvider) {
      providers.push(answers.customProvider);
    }

    // Build default assertions
    const defaultAsserts = [];
    if (answers.defaultAsserts) {
      for (const assertType of answers.defaultAsserts) {
        switch (assertType) {
          case 'contains':
            defaultAsserts.push({
              type: 'contains',
              value: 'summary',
              weight: 0.5
            });
            break;
          case 'llm-judge':
            defaultAsserts.push({
              type: 'llm-judge',
              value: 'Is the analysis accurate and helpful?',
              weight: 0.8
            });
            break;
          case 'regex':
            defaultAsserts.push({
              type: 'regex',
              value: '\\b(function|class|method)\\b',
              weight: 0.3
            });
            break;
          case 'json-path':
            defaultAsserts.push({
              type: 'json-path',
              value: '$.summary',
              weight: 0.4
            });
            break;
        }
      }
    }

    const config: EvaluationConfig = {
      description: answers.description,
      version: answers.version,
      prompts: [
        {
          role: 'system',
          content: answers.systemPrompt
        },
        {
          role: 'user',
          content: answers.userPrompt
        }
      ],
      providers,
      defaultTest: defaultAsserts.length > 0 ? { assert: defaultAsserts } : undefined,
      tests: [],
      config: {
        iterations: 1,
        parallel: true,
        timeout: 60
      },
      outputPath: 'results.json',
      outputFormat: 'json',
      sharing: {
        public: false,
        allowForks: true
      }
    };

    return config;
  }

  private static getTemplate(template: 'basic' | 'advanced'): EvaluationConfig {
    const basic: EvaluationConfig = {
      description: 'Basic EvalOps evaluation',
      version: '1.0',
      prompts: [
        {
          role: 'system',
          content: 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: 'Analyze the following code: {{code}}'
        }
      ],
      providers: ['openai/gpt-4'],
      defaultTest: {
        assert: [
          {
            type: 'contains',
            value: 'analysis',
            weight: 0.5
          },
          {
            type: 'llm-judge',
            value: 'Is the analysis accurate?',
            weight: 0.8
          }
        ]
      },
      tests: [],
      config: {
        iterations: 1,
        parallel: true,
        timeout: 60
      },
      outputPath: 'results.json',
      outputFormat: 'json'
    };

    const advanced: EvaluationConfig = {
      description: 'Advanced EvalOps evaluation with multiple providers',
      version: '1.0',
      prompts: [
        {
          role: 'system',
          content: 'You are an expert code reviewer and software architect.'
        },
        {
          role: 'user',
          content: 'Provide a comprehensive analysis of the following code, including:\n1. Code quality assessment\n2. Potential improvements\n3. Security considerations\n4. Performance implications\n\nCode: {{code}}'
        }
      ],
      providers: [
        'openai/gpt-4',
        'anthropic/claude-2',
        {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          temperature: 0.7
        }
      ],
      defaultTest: {
        assert: [
          {
            type: 'contains',
            value: 'quality',
            weight: 0.3
          },
          {
            type: 'contains',
            value: 'improvement',
            weight: 0.3
          },
          {
            type: 'llm-judge',
            value: 'Does the analysis cover code quality, improvements, security, and performance?',
            weight: 0.9
          },
          {
            type: 'regex',
            value: '\\b(security|performance|optimization)\\b',
            weight: 0.4
          }
        ]
      },
      tests: [],
      config: {
        iterations: 3,
        parallel: true,
        timeout: 120,
        maxRetries: 1
      },
      outputPath: 'results.json',
      outputFormat: 'json',
      sharing: {
        public: false,
        allowForks: true
      }
    };

    return template === 'basic' ? basic : advanced;
  }
}