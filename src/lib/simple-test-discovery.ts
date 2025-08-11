import * as fs from 'fs';
import { glob } from 'glob';
import type { ParsedTestCase, TestCaseMetadata } from '../types';

export class SimpleTestDiscovery {
  async discoverTestFiles(patterns: string[] = ['**/*.eval.{js,ts}', '**/*.test.{js,ts}']): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        ignore: ['node_modules/**', 'dist/**', 'build/**'],
      });
      allFiles.push(...files);
    }

    return [...new Set(allFiles)];
  }

  async parseTestFile(filePath: string): Promise<ParsedTestCase[]> {
    const content = fs.readFileSync(filePath, 'utf8');
    const testCases: ParsedTestCase[] = [];

    // Simple regex-based parsing for @evalops_test decorators
    const decoratorRegex = /@evalops_test\s*\(\s*({[\s\S]*?})\s*\)/g;
    const functionRegex = /function\s+(\w+)\s*\([^)]*\)\s*{/g;

    let decoratorMatch;
    const decorators: Array<{ config: any; index: number }> = [];

    while ((decoratorMatch = decoratorRegex.exec(content)) !== null) {
      try {
        const configStr = decoratorMatch[1];
        const config = new Function('return ' + configStr)();
        decorators.push({ config, index: decoratorMatch.index });
      } catch (error) {
        // Silently skip malformed decorators in tests
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`Failed to parse decorator in ${filePath}:`, error);
        }
      }
    }

    let functionMatch;
    const functions: Array<{ name: string; index: number }> = [];

    while ((functionMatch = functionRegex.exec(content)) !== null) {
      functions.push({
        name: functionMatch[1],
        index: functionMatch.index,
      });
    }

    // Match decorators with functions
    for (const decorator of decorators) {
      const nextFunction = functions.find((fn) => fn.index > decorator.index);
      if (nextFunction) {
        const lineNumber = content.substring(0, decorator.index).split('\n').length;

        const metadata: TestCaseMetadata = {
          filePath,
          functionName: nextFunction.name,
          lineNumber,
          description: decorator.config.description,
          tags: decorator.config.tags,
        };

        const testCase: ParsedTestCase = {
          description: decorator.config.description || `Test case for ${nextFunction.name}`,
          vars: {
            code: this.extractFunctionBody(content, nextFunction.index),
            ...decorator.config.vars,
          },
          assert: decorator.config.asserts || [],
          prompt: decorator.config.prompt,
          skip: decorator.config.skip,
          tags: decorator.config.tags,
          metadata,
        };

        testCases.push(testCase);
      }
    }

    // Simple parsing for evalops_test() function calls
    const callRegex = /evalops_test\s*\(\s*({[\s\S]*?})\s*,\s*function[^{]*{/g;
    let callMatch;

    while ((callMatch = callRegex.exec(content)) !== null) {
      try {
        const configStr = callMatch[1];
        const config = new Function('return ' + configStr)();
        const lineNumber = content.substring(0, callMatch.index).split('\n').length;

        const metadata: TestCaseMetadata = {
          filePath,
          functionName: 'inline_test',
          lineNumber,
          description: config.description,
          tags: config.tags,
        };

        const testCase: ParsedTestCase = {
          description: config.description || 'Inline test case',
          vars: {
            code: this.extractFunctionFromCall(content, callMatch.index),
            ...config.vars,
          },
          assert: config.asserts || [],
          prompt: config.prompt,
          skip: config.skip,
          tags: config.tags,
          metadata,
        };

        testCases.push(testCase);
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`Failed to parse evalops_test call in ${filePath}:`, error);
        }
      }
    }

    return testCases;
  }

  private extractFunctionBody(content: string, startIndex: number): string {
    let braceCount = 0;
    let inFunction = false;
    let functionStart = -1;

    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];

      if (char === '{') {
        if (!inFunction) {
          inFunction = true;
          functionStart = i;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && inFunction) {
          return content.substring(functionStart, i + 1);
        }
      }
    }

    return '';
  }

  private extractFunctionFromCall(content: string, callIndex: number): string {
    // Find the function part after the comma
    let parenCount = 0;
    let foundComma = false;
    let functionStart = -1;

    for (let i = callIndex; i < content.length; i++) {
      const char = content[i];

      if (char === '(') {
        parenCount++;
      } else if (char === ')') {
        parenCount--;
        if (parenCount === 0) {
          return content.substring(functionStart, i);
        }
      } else if (char === ',' && parenCount === 1 && !foundComma) {
        foundComma = true;
        // Skip whitespace after comma
        for (let j = i + 1; j < content.length; j++) {
          if (content[j] !== ' ' && content[j] !== '\t' && content[j] !== '\n') {
            functionStart = j;
            break;
          }
        }
      }
    }

    return '';
  }

  async discoverAllTests(patterns?: string[]): Promise<ParsedTestCase[]> {
    const files = await this.discoverTestFiles(patterns);
    const allTests: ParsedTestCase[] = [];

    for (const file of files) {
      try {
        const tests = await this.parseTestFile(file);
        allTests.push(...tests);
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`Failed to parse test file ${file}: ${error instanceof Error ? error.message : error}`);
        }
      }
    }

    return allTests;
  }
}
