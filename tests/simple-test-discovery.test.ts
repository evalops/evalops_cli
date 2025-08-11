import { SimpleTestDiscovery } from '../src/lib/simple-test-discovery';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('SimpleTestDiscovery', () => {
  let discovery: SimpleTestDiscovery;
  let tempDir: string;

  beforeEach(() => {
    discovery = new SimpleTestDiscovery();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evalops-discovery-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('discoverTestFiles', () => {
    it('should discover eval files by default patterns', async () => {
      const evalFile = path.join(tempDir, 'test.eval.ts');
      const testFile = path.join(tempDir, 'test.test.js');
      const regularFile = path.join(tempDir, 'regular.ts');
      
      fs.writeFileSync(evalFile, 'content');
      fs.writeFileSync(testFile, 'content');
      fs.writeFileSync(regularFile, 'content');

      process.chdir(tempDir);
      const files = await discovery.discoverTestFiles();

      expect(files.some(f => f.endsWith('test.eval.ts'))).toBe(true);
      expect(files.some(f => f.endsWith('test.test.js'))).toBe(true);
      expect(files.some(f => f.endsWith('regular.ts'))).toBe(false);
    });

    it('should ignore node_modules and dist directories', async () => {
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      const distDir = path.join(tempDir, 'dist');
      
      fs.mkdirSync(nodeModulesDir);
      fs.mkdirSync(distDir);
      
      const nodeModulesFile = path.join(nodeModulesDir, 'test.eval.ts');
      const distFile = path.join(distDir, 'test.eval.js');
      const validFile = path.join(tempDir, 'valid.eval.ts');
      
      fs.writeFileSync(nodeModulesFile, 'content');
      fs.writeFileSync(distFile, 'content');
      fs.writeFileSync(validFile, 'content');

      process.chdir(tempDir);
      const files = await discovery.discoverTestFiles();

      expect(files.some(f => f.includes('node_modules'))).toBe(false);
      expect(files.some(f => f.includes('dist'))).toBe(false);
      expect(files.some(f => f.endsWith('valid.eval.ts'))).toBe(true);
    });

    it('should use custom patterns when provided', async () => {
      const customFile = path.join(tempDir, 'custom.spec.ts');
      const evalFile = path.join(tempDir, 'test.eval.ts');
      
      fs.writeFileSync(customFile, 'content');
      fs.writeFileSync(evalFile, 'content');

      process.chdir(tempDir);
      const files = await discovery.discoverTestFiles(['**/*.spec.ts']);

      expect(files.some(f => f.endsWith('custom.spec.ts'))).toBe(true);
      expect(files.some(f => f.endsWith('test.eval.ts'))).toBe(false);
    });
  });

  describe('parseTestFile', () => {
    it('should parse TypeScript decorator syntax', async () => {
      const testFile = path.join(tempDir, 'decorator.eval.ts');
      const content = `
@evalops_test({
  prompt: 'Analyze this: {{code}}',
  asserts: [
    { type: 'contains', value: 'test', weight: 0.5 }
  ],
  description: 'Test function analysis',
  tags: ['analysis']
})
function testMyFunction() {
  function factorial(n: number): number {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
  }
  return factorial;
}
`;

      fs.writeFileSync(testFile, content);
      const testCases = await discovery.parseTestFile(testFile);

      expect(testCases).toHaveLength(1);
      expect(testCases[0].description).toBe('Test function analysis');
      expect(testCases[0].tags).toEqual(['analysis']);
      expect(testCases[0].assert).toHaveLength(1);
      expect(testCases[0].assert![0].type).toBe('contains');
      expect(testCases[0].vars?.code).toContain('factorial');
      expect(testCases[0].metadata.functionName).toBe('testMyFunction');
      expect(testCases[0].metadata.filePath).toBe(testFile);
    });

    it('should parse evalops_test function calls', async () => {
      const testFile = path.join(tempDir, 'functional.eval.js');
      const content = `
evalops_test({
  prompt: 'Review this code: {{code}}',
  asserts: [
    { type: 'llm-judge', value: 'Is it good?', weight: 0.8 }
  ],
  description: 'Code review test'
}, function() {
  async function fetchData(url) {
    const response = await fetch(url);
    return response.json();
  }
  return fetchData;
});
`;

      fs.writeFileSync(testFile, content);
      const testCases = await discovery.parseTestFile(testFile);

      expect(testCases).toHaveLength(1);
      expect(testCases[0].description).toBe('Code review test');
      expect(testCases[0].assert).toHaveLength(1);
      expect(testCases[0].assert![0].type).toBe('llm-judge');
      expect(testCases[0].vars?.code).toContain('fetchData');
      expect(testCases[0].metadata.functionName).toBe('inline_test');
    });

    it('should handle multiple test cases in one file', async () => {
      const testFile = path.join(tempDir, 'multiple.eval.ts');
      const content = `
@evalops_test({
  description: 'First test',
  tags: ['test1']
})
function testOne() {
  function add(a, b) { return a + b; }
  return add;
}

@evalops_test({
  description: 'Second test', 
  tags: ['test2']
})
function testTwo() {
  function multiply(a, b) { return a * b; }
  return multiply;
}
`;

      fs.writeFileSync(testFile, content);
      const testCases = await discovery.parseTestFile(testFile);

      expect(testCases).toHaveLength(2);
      expect(testCases[0].description).toBe('First test');
      expect(testCases[0].tags).toEqual(['test1']);
      expect(testCases[1].description).toBe('Second test');
      expect(testCases[1].tags).toEqual(['test2']);
    });

    it('should handle malformed decorators gracefully', async () => {
      const testFile = path.join(tempDir, 'malformed.eval.ts');
      const content = `
@evalops_test({
  invalid: syntax here
})
function testBroken() {
  return 'broken';
}

@evalops_test({
  description: 'Valid test'
})
function testValid() {
  return 'valid';
}
`;

      fs.writeFileSync(testFile, content);
      const testCases = await discovery.parseTestFile(testFile);

      // Should skip the malformed one and parse the valid one
      expect(testCases).toHaveLength(1);
      expect(testCases[0].description).toBe('Valid test');
    });

    it('should extract function bodies correctly', async () => {
      const testFile = path.join(tempDir, 'extraction.eval.ts');
      const content = `
@evalops_test({
  description: 'Function extraction test'
})
function testExtraction() {
  function complexFunction(param1, param2) {
    if (param1 > 0) {
      return param1 + param2;
    }
    return param2;
  }
  return complexFunction;
}
`;

      fs.writeFileSync(testFile, content);
      const testCases = await discovery.parseTestFile(testFile);

      expect(testCases).toHaveLength(1);
      expect(testCases[0].vars?.code).toContain('complexFunction');
      expect(testCases[0].vars?.code).toContain('param1 > 0');
      expect(testCases[0].vars?.code).toContain('return param1 + param2');
    });

    it('should handle files with no test cases', async () => {
      const testFile = path.join(tempDir, 'empty.eval.ts');
      const content = `
// Regular TypeScript file with no evalops tests
function regularFunction() {
  return 'nothing special';
}

const someVar = 42;
`;

      fs.writeFileSync(testFile, content);
      const testCases = await discovery.parseTestFile(testFile);

      expect(testCases).toHaveLength(0);
    });
  });

  describe('discoverAllTests', () => {
    it('should discover tests from multiple files', async () => {
      const file1 = path.join(tempDir, 'test1.eval.ts');
      const file2 = path.join(tempDir, 'test2.eval.js');
      
      fs.writeFileSync(file1, `
@evalops_test({ description: 'Test 1' })
function test1() { return 'test1'; }
`);

      fs.writeFileSync(file2, `
evalops_test({ description: 'Test 2' }, function() {
  return 'test2';
});
`);

      process.chdir(tempDir);
      const allTests = await discovery.discoverAllTests();

      expect(allTests).toHaveLength(2);
      expect(allTests[0].description).toBe('Test 1');
      expect(allTests[1].description).toBe('Test 2');
    });

    it('should handle file parsing errors gracefully', async () => {
      const validFile = path.join(tempDir, 'valid.eval.ts');
      const invalidFile = path.join(tempDir, 'invalid.eval.ts');
      
      fs.writeFileSync(validFile, `
@evalops_test({ description: 'Valid test' })
function validTest() { return 'valid'; }
`);

      // Create a file that will cause parsing errors
      fs.writeFileSync(invalidFile, 'This is not valid TypeScript content');

      process.chdir(tempDir);
      const allTests = await discovery.discoverAllTests();

      // Should only return the valid test, ignoring the invalid file
      expect(allTests).toHaveLength(1);
      expect(allTests[0].description).toBe('Valid test');
    });
  });
});