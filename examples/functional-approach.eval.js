/**
 * Example of EvalOps test cases using functional approach
 * This shows how to use evalops_test() function calls instead of decorators
 */

// Import or define the evalops_test function
// In a real project, this would be imported from the evalops library
function evalops_test(config, testFunction) {
  // This would be processed by the Tree-sitter parser
  return {
    config,
    testFunction
  };
}

// Basic function analysis test
evalops_test({
  prompt: 'Explain what this JavaScript function does: {{code}}',
  asserts: [
    {
      type: 'contains',
      value: 'factorial',
      weight: 0.5
    },
    {
      type: 'contains',
      value: 'recursive',
      weight: 0.6
    },
    {
      type: 'llm-judge',
      value: 'Does the explanation correctly identify this as a recursive factorial function?',
      weight: 0.8
    }
  ],
  description: 'Test factorial function explanation',
  tags: ['recursion', 'math']
}, function() {
  function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
  }
  
  return factorial;
});

// Array method chaining test
evalops_test({
  prompt: [
    { role: 'system', content: 'You are a JavaScript expert.' },
    { role: 'user', content: 'Analyze this array processing code and explain the data flow: {{code}}' }
  ],
  asserts: [
    {
      type: 'contains',
      value: 'map',
      weight: 0.3
    },
    {
      type: 'contains',
      value: 'filter',
      weight: 0.3
    },
    {
      type: 'contains',
      value: 'reduce',
      weight: 0.3
    },
    {
      type: 'llm-judge',
      value: 'Does the explanation accurately describe the transformation pipeline?',
      weight: 0.9
    }
  ],
  description: 'Test array method chaining explanation',
  tags: ['arrays', 'functional-programming']
}, function() {
  function processNumbers(numbers) {
    return numbers
      .filter(n => n > 0)
      .map(n => n * 2)
      .reduce((sum, n) => sum + n, 0);
  }
  
  return processNumbers;
});

// Async/await pattern test
evalops_test({
  prompt: 'Review this async code and suggest improvements: {{code}}',
  asserts: [
    {
      type: 'contains',
      value: 'try',
      weight: 0.4
    },
    {
      type: 'contains',
      value: 'catch',
      weight: 0.4
    },
    {
      type: 'llm-judge',
      value: 'Does the review mention error handling improvements?',
      weight: 0.8
    },
    {
      type: 'llm-judge',
      value: 'Are there suggestions for better async patterns?',
      weight: 0.7
    }
  ],
  description: 'Test async code review',
  tags: ['async', 'error-handling', 'promises']
}, function() {
  async function fetchMultipleUsers(userIds) {
    const users = [];
    for (const id of userIds) {
      const response = await fetch(`/api/users/${id}`);
      const user = await response.json();
      users.push(user);
    }
    return users;
  }
  
  return fetchMultipleUsers;
});

// Object-oriented design test
evalops_test({
  prompt: 'Analyze this class design and comment on its structure: {{code}}',
  asserts: [
    {
      type: 'contains',
      value: 'encapsulation',
      weight: 0.4
    },
    {
      type: 'contains',
      value: 'method',
      weight: 0.3
    },
    {
      type: 'regex',
      value: '(private|public|protected)',
      weight: 0.3
    },
    {
      type: 'llm-judge',
      value: 'Does the analysis discuss object-oriented design principles?',
      weight: 0.8
    }
  ],
  description: 'Test class design analysis',
  tags: ['oop', 'class-design']
}, function() {
  class Calculator {
    constructor() {
      this.history = [];
    }
    
    add(a, b) {
      const result = a + b;
      this.history.push(`${a} + ${b} = ${result}`);
      return result;
    }
    
    subtract(a, b) {
      const result = a - b;
      this.history.push(`${a} - ${b} = ${result}`);
      return result;
    }
    
    getHistory() {
      return [...this.history];
    }
    
    clearHistory() {
      this.history = [];
    }
  }
  
  return Calculator;
});

// Regular expression test
evalops_test({
  prompt: 'Explain what this regular expression does: {{code}}',
  asserts: [
    {
      type: 'contains',
      value: 'email',
      weight: 0.6
    },
    {
      type: 'contains',
      value: 'validation',
      weight: 0.5
    },
    {
      type: 'llm-judge',
      value: 'Does the explanation correctly identify this as email validation?',
      weight: 0.9
    },
    {
      type: 'llm-judge',
      value: 'Are the regex components (groups, quantifiers) explained?',
      weight: 0.7
    }
  ],
  description: 'Test regex explanation',
  tags: ['regex', 'validation']
}, function() {
  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  return validateEmail;
});

// Performance optimization test
evalops_test({
  prompt: 'How could this code be optimized for better performance? {{code}}',
  asserts: [
    {
      type: 'contains',
      value: 'performance',
      weight: 0.4
    },
    {
      type: 'regex',
      value: '(optimization|optimize|faster|efficient)',
      weight: 0.5
    },
    {
      type: 'llm-judge',
      value: 'Does the response suggest specific optimization techniques?',
      weight: 0.8
    },
    {
      type: 'llm-judge',
      value: 'Are the suggestions technically sound and relevant?',
      weight: 0.9
    }
  ],
  description: 'Test performance optimization suggestions',
  tags: ['performance', 'optimization']
}, function() {
  function findDuplicates(arr) {
    const duplicates = [];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[i] === arr[j] && !duplicates.includes(arr[i])) {
          duplicates.push(arr[i]);
        }
      }
    }
    return duplicates;
  }
  
  return findDuplicates;
});

console.log('Example test cases defined. Run evalops validate to discover and validate these tests.');