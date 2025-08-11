/**
 * Basic example of EvalOps test cases using decorators
 */

interface EvalOpsTestConfig {
  prompt?: string | Array<{ role: string; content: string }>;
  asserts?: Array<{
    type: 'contains' | 'not-contains' | 'equals' | 'llm-judge' | 'regex';
    value: any;
    weight?: number;
  }>;
  vars?: Record<string, any>;
  description?: string;
  tags?: string[];
  skip?: boolean;
}

// Decorator function for TypeScript (for demo purposes)
function evalops_test(config: EvalOpsTestConfig) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // This would be processed by the Tree-sitter parser
    return descriptor;
  };
}

@evalops_test({
  prompt: [
    { role: 'system', content: 'You are a helpful code reviewer.' },
    { role: 'user', content: 'Analyze this function and explain what it does: {{code}}' }
  ],
  asserts: [
    {
      type: 'contains',
      value: 'function',
      weight: 0.3
    },
    {
      type: 'contains', 
      value: 'calculate',
      weight: 0.4
    },
    {
      type: 'llm-judge',
      value: 'Does the explanation accurately describe what the function does?',
      weight: 0.8
    }
  ],
  tags: ['basic', 'math']
})
function testCalculateSum() {
  /**
   * Test case for a simple sum calculation function.
   * The LLM should be able to identify this as a mathematical function.
   */
  function calculateSum(a: number, b: number): number {
    return a + b;
  }

  return calculateSum;
}

@evalops_test({
  prompt: 'Review this code and identify any potential issues: {{code}}',
  asserts: [
    {
      type: 'contains',
      value: 'async',
      weight: 0.5
    },
    {
      type: 'llm-judge',
      value: 'Does the review mention error handling or try-catch blocks?',
      weight: 0.7
    }
  ],
  tags: ['async', 'error-handling']
})
function testAsyncFunction() {
  /**
   * Test case for async function review.
   * LLM should identify potential issues with error handling.
   */
  async function fetchUserData(userId: string) {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  }

  return fetchUserData;
}

@evalops_test({
  prompt: [
    { role: 'system', content: 'You are an expert in data structures and algorithms.' },
    { role: 'user', content: 'Analyze the time complexity of this algorithm: {{code}}' }
  ],
  asserts: [
    {
      type: 'regex',
      value: 'O\\([^)]+\\)',
      weight: 0.6
    },
    {
      type: 'contains',
      value: 'complexity',
      weight: 0.4
    },
    {
      type: 'llm-judge',
      value: 'Is the time complexity analysis correct?',
      weight: 0.9
    }
  ],
  tags: ['algorithms', 'complexity']
})
function testBubbleSort() {
  /**
   * Test case for algorithm complexity analysis.
   * LLM should identify this as O(n²) bubble sort.
   */
  function bubbleSort(arr: number[]): number[] {
    const n = arr.length;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - i - 1; j++) {
        if (arr[j] > arr[j + 1]) {
          [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        }
      }
    }
    return arr;
  }

  return bubbleSort;
}

@evalops_test({
  prompt: 'What security vulnerabilities might exist in this code? {{code}}',
  asserts: [
    {
      type: 'contains',
      value: 'SQL injection',
      weight: 0.8
    },
    {
      type: 'contains',
      value: 'parameterized',
      weight: 0.6
    },
    {
      type: 'llm-judge',
      value: 'Does the analysis correctly identify the SQL injection vulnerability?',
      weight: 0.9
    }
  ],
  tags: ['security', 'sql-injection']
})
function testVulnerableCode() {
  /**
   * Test case for security vulnerability detection.
   * This code contains a classic SQL injection vulnerability.
   */
  function getUserById(userId: string) {
    const query = `SELECT * FROM users WHERE id = '${userId}'`;
    return database.query(query);
  }

  return getUserById;
}

// Export for potential use in other test files
export { 
  testCalculateSum, 
  testAsyncFunction, 
  testBubbleSort, 
  testVulnerableCode 
};