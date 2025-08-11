import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import Parser from 'web-tree-sitter';
import { ParsedTestCase, EvalOpsTestDecorator, TestCaseMetadata } from '../types';

export class TestDiscovery {
  private parser: Parser | null = null;
  private jsLanguage: Parser.Language | null = null;
  private tsLanguage: Parser.Language | null = null;

  async initialize(): Promise<void> {
    try {
      await Parser.init();
      this.parser = new Parser();

      // Load language grammars
      this.jsLanguage = await Parser.Language.load(
        require.resolve('tree-sitter-javascript/tree-sitter-javascript.wasm')
      );
      this.tsLanguage = await Parser.Language.load(
        require.resolve('tree-sitter-typescript/tree-sitter-typescript.wasm')
      );
    } catch (error) {
      throw new Error(`Failed to initialize parser: ${error instanceof Error ? error.message : error}`);
    }
  }

  async discoverTestFiles(patterns: string[] = ['**/*.eval.{js,ts}', '**/*.test.{js,ts}']): Promise<string[]> {
    const allFiles: string[] = [];
    
    for (const pattern of patterns) {
      const files = await glob(pattern, { 
        ignore: ['node_modules/**', 'dist/**', 'build/**'] 
      });
      allFiles.push(...files);
    }
    
    return [...new Set(allFiles)];
  }

  async parseTestFile(filePath: string): Promise<ParsedTestCase[]> {
    if (!this.parser || !this.jsLanguage || !this.tsLanguage) {
      throw new Error('Parser not initialized. Call initialize() first.');
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const isTypeScript = filePath.endsWith('.ts');
    
    this.parser.setLanguage(isTypeScript ? this.tsLanguage : this.jsLanguage);
    const tree = this.parser.parse(content);
    
    const testCases: ParsedTestCase[] = [];
    
    this.traverseNode(tree.rootNode, content, filePath, testCases);
    
    return testCases;
  }

  private traverseNode(
    node: Parser.SyntaxNode, 
    content: string, 
    filePath: string, 
    testCases: ParsedTestCase[]
  ): void {
    // Look for decorated functions
    if (node.type === 'function_declaration' || node.type === 'method_definition') {
      const decorator = this.findEvalOpsDecorator(node, content);
      if (decorator) {
        const testCase = this.extractTestCase(node, decorator, content, filePath);
        if (testCase) {
          testCases.push(testCase);
        }
      }
    }

    // Look for evalops_test function calls
    if (node.type === 'call_expression') {
      const testCase = this.extractTestCaseFromCall(node, content, filePath);
      if (testCase) {
        testCases.push(testCase);
      }
    }

    for (let i = 0; i < node.childCount; i++) {
      this.traverseNode(node.child(i)!, content, filePath, testCases);
    }
  }

  private findEvalOpsDecorator(node: Parser.SyntaxNode, content: string): EvalOpsTestDecorator | null {
    let current = node.previousSibling;
    
    while (current) {
      if (current.type === 'decorator') {
        const decoratorText = content.slice(current.startIndex, current.endIndex);
        if (decoratorText.includes('evalops_test')) {
          return this.parseDecorator(decoratorText);
        }
      }
      current = current.previousSibling;
    }
    
    return null;
  }

  private parseDecorator(decoratorText: string): EvalOpsTestDecorator {
    try {
      // Extract the object from @evalops_test({...})
      const match = decoratorText.match(/@evalops_test\s*\(\s*({.*})\s*\)/s);
      if (!match) return {};
      
      // Use Function constructor to safely evaluate the object literal
      const objStr = match[1];
      const evalFunc = new Function('return ' + objStr);
      return evalFunc();
    } catch (error) {
      console.warn(`Failed to parse decorator: ${decoratorText}`);
      return {};
    }
  }

  private extractTestCase(
    node: Parser.SyntaxNode,
    decorator: EvalOpsTestDecorator,
    content: string,
    filePath: string
  ): ParsedTestCase | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const functionName = content.slice(nameNode.startIndex, nameNode.endIndex);
    const bodyNode = node.childForFieldName('body');
    
    let description = decorator.description;
    let codeContent = '';

    if (bodyNode) {
      // Look for docstring/comment
      if (!description) {
        description = this.extractDocstring(bodyNode, content);
      }
      
      // Extract function body as code
      codeContent = content.slice(bodyNode.startIndex, bodyNode.endIndex);
    }

    const metadata: TestCaseMetadata = {
      filePath,
      functionName,
      lineNumber: node.startPosition.row + 1,
      description,
      tags: decorator.tags
    };

    return {
      description: description || `Test case for ${functionName}`,
      vars: {
        code: codeContent,
        ...decorator.vars
      },
      assert: decorator.asserts || [],
      prompt: decorator.prompt,
      skip: decorator.skip,
      tags: decorator.tags,
      metadata
    };
  }

  private extractTestCaseFromCall(
    node: Parser.SyntaxNode,
    content: string,
    filePath: string
  ): ParsedTestCase | null {
    const functionNode = node.childForFieldName('function');
    if (!functionNode) return null;

    const functionName = content.slice(functionNode.startIndex, functionNode.endIndex);
    if (functionName !== 'evalops_test') return null;

    const argsNode = node.childForFieldName('arguments');
    if (!argsNode || argsNode.childCount < 2) return null;

    try {
      const configArg = argsNode.child(0);
      const testFuncArg = argsNode.child(2); // Skip comma

      if (!configArg || !testFuncArg) return null;

      const configText = content.slice(configArg.startIndex, configArg.endIndex);
      const testFuncText = content.slice(testFuncArg.startIndex, testFuncArg.endIndex);

      // Parse configuration object
      const evalFunc = new Function('return ' + configText);
      const config = evalFunc() as EvalOpsTestDecorator;

      const metadata: TestCaseMetadata = {
        filePath,
        functionName: 'inline_test',
        lineNumber: node.startPosition.row + 1,
        description: config.description,
        tags: config.tags
      };

      return {
        description: config.description || 'Inline test case',
        vars: {
          code: testFuncText,
          ...config.vars
        },
        assert: config.asserts || [],
        prompt: config.prompt,
        skip: config.skip,
        tags: config.tags,
        metadata
      };
    } catch (error) {
      console.warn(`Failed to parse evalops_test call at line ${node.startPosition.row + 1}`);
      return null;
    }
  }

  private extractDocstring(bodyNode: Parser.SyntaxNode, content: string): string | undefined {
    // Look for comment or string literal at the beginning of the function body
    for (let i = 0; i < bodyNode.childCount; i++) {
      const child = bodyNode.child(i);
      if (!child) continue;

      if (child.type === 'comment') {
        const comment = content.slice(child.startIndex, child.endIndex);
        return comment.replace(/^\/\*\*?\s*|\s*\*\/$/g, '').replace(/^\s*\*\s?/gm, '').trim();
      }

      if (child.type === 'expression_statement') {
        const expr = child.child(0);
        if (expr && expr.type === 'string') {
          const str = content.slice(expr.startIndex, expr.endIndex);
          return str.slice(1, -1); // Remove quotes
        }
      }

      // Stop at first non-comment, non-string statement
      if (child.type !== 'comment') {
        break;
      }
    }

    return undefined;
  }

  async discoverAllTests(patterns?: string[]): Promise<ParsedTestCase[]> {
    await this.initialize();
    
    const files = await this.discoverTestFiles(patterns);
    const allTests: ParsedTestCase[] = [];
    
    for (const file of files) {
      try {
        const tests = await this.parseTestFile(file);
        allTests.push(...tests);
      } catch (error) {
        console.warn(`Failed to parse test file ${file}: ${error instanceof Error ? error.message : error}`);
      }
    }
    
    return allTests;
  }
}