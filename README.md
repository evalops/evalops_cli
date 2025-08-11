# EvalOps CLI

The EvalOps CLI is a powerful tool for evaluating code against Large Language Models (LLMs) using the EvalOps platform. It allows you to define, validate, and run evaluations directly from your command line.

## Features

- **Initialize Projects**: Quickly set up a new EvalOps project with `evalops init`
- **Validate Configurations**: Ensure your `evalops.yaml` file is correctly formatted and your test cases are discoverable with `evalops validate`
- **Upload Test Suites**: Upload your evaluation configurations to the EvalOps platform with `evalops upload`
- **Local Evaluations (Coming Soon)**: Run evaluations locally against different providers with `evalops run`
- **Automatic Test Discovery**: Automatically discover test cases in your codebase using Tree-sitter parsing
- **TypeScript & JavaScript Support**: Full support for both TypeScript and JavaScript test files
- **Multiple Test Patterns**: Support for decorators, function calls, and various file patterns

## Installation

Install globally via npm:

```bash
npm install -g evalops-cli
```

Or install locally in your project:

```bash
npm install --save-dev evalops-cli
```

## Getting Started

1. **Initialize a new project:**

   ```bash
   evalops init
   ```

   This will create a `evalops.yaml` file in your current directory. You can use the interactive prompt to configure your project or start with a template:

   ```bash
   evalops init --template basic
   ```

2. **Define your evaluation in `evalops.yaml`:**

   The `evalops.yaml` file is the heart of your evaluation. Here you can define:
   - A description and version for your evaluation.
   - The prompts to be used.
   - The LLM providers to test against.
   - Default and specific test cases with assertions.

3. **Add test cases to your code:**

   The CLI can automatically discover test cases in your code. You can define test cases in special `.eval.ts` or `.eval.js` files using decorators or function calls.

   **Using Decorator (TypeScript):**
   ```typescript
   // mycode.eval.ts
   @evalops_test({
     prompt: 'Analyze this function: {{code}}',
     asserts: [
       { type: 'contains', value: 'function', weight: 0.5 },
       { type: 'llm-judge', value: 'Is the analysis accurate?', weight: 0.8 }
     ],
     tags: ['analysis', 'functions']
   })
   function testMyFunction() {
     /**
      * This function calculates the factorial of a number
      */
     function factorial(n: number): number {
       if (n <= 1) return 1;
       return n * factorial(n - 1);
     }
     
     return factorial;
   }
   ```

   **Using Function Call (JavaScript):**
   ```javascript
   // mycode.eval.js
   evalops_test({
     prompt: 'Review this code for potential issues: {{code}}',
     asserts: [
       { type: 'contains', value: 'error handling', weight: 0.6 },
       { type: 'llm-judge', value: 'Does the review identify key issues?', weight: 0.9 }
     ],
     description: 'Test async function review'
   }, function() {
     async function fetchData(url) {
       const response = await fetch(url);
       return response.json();
     }
     
     return fetchData;
   });
   ```

   **File Patterns:**
   The CLI automatically discovers files matching these patterns:
   - `**/*.eval.{js,ts}` - Dedicated evaluation files
   - `**/*.test.{js,ts}` - Test files with evaluation decorators

4. **Validate your configuration:**

   Before uploading, it's a good practice to validate your configuration and discover your test cases:

   ```bash
   evalops validate
   ```

5. **Upload your test suite:**

   Once you're ready, upload your test suite to the EvalOps platform:

   ```bash
   evalops upload
   ```

   You will need to provide your EvalOps API key. You can do this by setting the `EVALOPS_API_KEY` environment variable or by using the `--api-key` flag.

## CLI Commands

### `init`

Initialize a new EvalOps project.

**Options:**
- `-f, --force`: Overwrite existing `evalops.yaml` file.
- `--template <template>`: Use a specific template (`basic`, `advanced`).

### `validate`

Validate the `evalops.yaml` file and discovered test cases.

**Options:**
- `-v, --verbose`: Show detailed validation output.
- `-f, --file <file>`: Path to `evalops.yaml` file (default: `./evalops.yaml`).

### `upload`

Upload test suite to the EvalOps platform.

**Options:**
- `-f, --file <file>`: Path to `evalops.yaml` file (default: `./evalops.yaml`).
- `--api-key <key>`: EvalOps API key.
- `--api-url <url>`: EvalOps API URL (default: `https://api.evalops.dev`).
- `--name <name>`: Name for the test suite.
- `--dry-run`: Preview what would be uploaded without actually uploading.

### `run`

Run evaluation locally (not yet implemented).

**Options:**
- `-f, --file <file>`: Path to `evalops.yaml` file (default: `./evalops.yaml`).
- `--provider <provider>`: Specify provider to use.
- `--output <output>`: Output file path.

## Configuration

The `evalops.yaml` file supports the following main sections:

### Basic Configuration

```yaml
description: "My Code Evaluation Project"
version: "1.0"

# Prompts can be strings, objects, or arrays
prompts:
  - role: "system"
    content: "You are a helpful code reviewer."
  - role: "user" 
    content: "Analyze this code: {{code}}"

# Providers can be simple strings or detailed configurations
providers:
  - "openai/gpt-4"
  - provider: "anthropic"
    model: "claude-2"
    temperature: 0.7

# Default assertions applied to all test cases
defaultTest:
  assert:
    - type: "contains"
      value: "analysis"
      weight: 0.5
    - type: "llm-judge"
      value: "Is the analysis helpful?"
      weight: 0.8

# Test cases (auto-discovered from code or defined manually)
tests: []

# Execution settings
config:
  iterations: 1
  parallel: true
  timeout: 60

# Output configuration
outputPath: "results.json"
outputFormat: "json"

# Sharing settings
sharing:
  public: false
  allowForks: true
```

### File References

You can reference external files using the `@` prefix:

```yaml
prompts: "@prompts/system-prompt.txt"

# Or in nested structures
prompts:
  - role: "system"
    content: "@prompts/system.txt"
  - role: "user"
    content: "@prompts/user.txt"
```

### Assertion Types

The CLI supports various assertion types:

- `contains` / `not-contains`: Check if output contains specific text
- `equals` / `not-equals`: Exact match comparisons
- `llm-judge`: Use another LLM to judge the output quality
- `regex`: Regular expression matching
- `json-path`: Extract and validate JSON path values
- `similarity`: Semantic similarity scoring

### Environment Variables

- `EVALOPS_API_KEY`: Your EvalOps API key
- `EVALOPS_API_URL`: Custom API URL (defaults to `https://api.evalops.dev`)

## Examples

Check the `examples/` directory for complete examples:

- `examples/basic.eval.ts` - TypeScript decorator examples
- `examples/functional-approach.eval.js` - JavaScript function call examples

## Development

To build and test the CLI locally:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Test CLI locally
npm run dev -- init --template basic
```

## Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests to the main repository.

## License

MIT License - see LICENSE file for details.
