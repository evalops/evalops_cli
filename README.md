# EvalOps CLI

The EvalOps CLI is a powerful tool for evaluating code against Large Language Models (LLMs) using the EvalOps platform. It allows you to define, validate, and run evaluations directly from your command line.

## Features

### Core Functionality
- **Initialize Projects**: Quickly set up a new EvalOps project with `evalops init`
- **Validate Configurations**: Ensure your `evalops.yaml` file is correctly formatted and your test cases are discoverable with `evalops validate`
- **Upload Test Suites**: Upload your evaluation configurations to the EvalOps platform with `evalops upload`
- **Automatic Test Discovery**: Automatically discover test cases in your codebase using Tree-sitter parsing
- **TypeScript & JavaScript Support**: Full support for both TypeScript and JavaScript test files
- **Multiple Test Patterns**: Support for decorators, function calls, and various file patterns

### Advanced CI/CD Features
- **🎯 Quality Gates**: Enforce minimum quality scores with configurable thresholds
- **💰 Cost Budgeting**: Set and monitor evaluation cost limits with `evalops cost` and `evalops budget`
- **📊 Performance Monitoring**: Track latency and execution time metrics
- **🔧 Environment Support**: Different budget configurations for dev/staging/production
- **🚀 GitHub Actions Integration**: Official [GitHub Action](https://github.com/evalops/evalops-action) for seamless CI/CD
- **💬 Automated PR Comments**: Detailed evaluation results posted automatically to pull requests
- **⚡ Budget Enforcement**: Automatic CI build failures when budget constraints are violated

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

### Core Commands

#### `init`

Initialize a new EvalOps project.

**Options:**
- `-f, --force`: Overwrite existing `evalops.yaml` file.
- `--template <template>`: Use a specific template (`basic`, `advanced`).

#### `validate`

Validate the `evalops.yaml` file and discovered test cases.

**Options:**
- `-v, --verbose`: Show detailed validation output.
- `-f, --file <file>`: Path to `evalops.yaml` file (default: `./evalops.yaml`).

#### `upload`

Upload test suite to the EvalOps platform.

**Options:**
- `-f, --file <file>`: Path to `evalops.yaml` file (default: `./evalops.yaml`).
- `--api-key <key>`: EvalOps API key.
- `--api-url <url>`: EvalOps API URL (default: `https://api.evalops.dev`).
- `--name <name>`: Name for the test suite.
- `--dry-run`: Preview what would be uploaded without actually uploading.
- `--check-budget`: Enforce budget constraints before and after evaluation.
- `--budget-file <file>`: Path to budget.yaml file (default: `./budget.yaml`).

### Budget & Cost Management

#### `cost`

Estimate the cost of running evaluations.

**Options:**
- `-f, --file <file>`: Path to `evalops.yaml` file (default: `./evalops.yaml`).
- `--format <format>`: Output format (`table`, `json`, `csv`) (default: `table`).
- `-v, --verbose`: Show detailed breakdown including per-provider costs.

**Example:**
```bash
# Get cost estimate as table
evalops cost

# Get detailed JSON output
evalops cost --format json --verbose

# Estimate cost for specific config
evalops cost -f ./staging-evalops.yaml
```

#### `budget`

Manage evaluation budget and quality gates.

**Options:**
- `--init`: Initialize a new budget configuration.
- `--validate`: Validate budget configuration.
- `-f, --file <file>`: Path to budget.yaml file (default: `./budget.yaml`).
- `--environment <env>`: Environment-specific budget settings (`development`, `staging`, `production`).
- `--metrics <json>`: JSON string with metrics to validate against budget.

**Examples:**
```bash
# Initialize budget configuration
evalops budget --init

# Validate budget config
evalops budget --validate

# Test budget with sample metrics
evalops budget --validate --metrics '{"quality_score": 0.75, "cost_usd": 2.5, "avg_latency_ms": 1200}'

# Use production environment settings
evalops budget --validate --environment production
```


## CI/CD Integration

EvalOps CLI provides powerful CI/CD integration capabilities through GitHub Actions and budget management systems.

### GitHub Actions

Use the official [EvalOps GitHub Action](https://github.com/evalops/evalops-action) for seamless integration:

```yaml
name: 'EvalOps CI Pipeline'

on:
  pull_request:
    branches: [main]
    paths:
      - '**/*.eval.ts'
      - '**/*.eval.js'
      - 'evalops.yaml'
      - 'budget.yaml'

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run EvalOps Evaluation
        uses: evalops/evalops-action@v1
        with:
          api-key: ${{ secrets.EVALOPS_API_KEY }}
          check-budget: true
          comment-pr: true
          fail-on-violation: true
          quality-threshold: '0.8'
          cost-threshold: '10.00'
          environment: 'production'
```

### Budget Configuration

Create a `budget.yaml` file to enforce quality gates and cost limits:

```yaml
version: '1.0'
description: 'Budget configuration for EvalOps evaluations'

# Quality score thresholds
quality_score:
  min: 0.6        # Fail if below 0.6
  warning: 0.7    # Warn if below 0.7

# Cost constraints
cost:
  max_usd: 10.0         # Maximum cost in USD
  warning_usd: 5.0      # Warning threshold
  max_tokens: 100000    # Token limit
  warning_tokens: 50000

# Performance limits
performance:
  max_latency_ms: 5000        # Maximum average latency
  warning_latency_ms: 3000    # Latency warning
  max_execution_time_ms: 300000  # 5 minute total time limit

# Action configuration
actions:
  fail_on_violation: true   # Fail CI on violations
  fail_on_warning: false    # Don't fail on warnings
  create_issue: false       # Don't create GitHub issues

# Environment-specific overrides
environments:
  development:
    cost:
      max_usd: 1.0
      warning_usd: 0.5
  staging:
    cost:
      max_usd: 5.0
      warning_usd: 2.5
  production:
    quality_score:
      min: 0.8
      warning: 0.85
    cost:
      max_usd: 50.0
      warning_usd: 25.0
```

### Integration Patterns

#### Cost Gate Pattern
```yaml
jobs:
  cost-check:
    runs-on: ubuntu-latest
    outputs:
      cost-estimate: ${{ steps.cost.outputs.cost-estimate }}
      budget-passed: ${{ steps.evaluation.outputs.budget-passed }}
    steps:
      - uses: actions/checkout@v4
      - uses: evalops/evalops-action@v1
        id: evaluation
        with:
          api-key: ${{ secrets.EVALOPS_API_KEY }}
          cost-threshold: '5.00'
          
  deploy:
    needs: cost-check
    if: needs.cost-check.outputs.budget-passed == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: echo "Deploying with cost ${{ needs.cost-check.outputs.cost-estimate }}"
```

#### Multi-Environment Pattern
```yaml
strategy:
  matrix:
    environment: [development, staging, production]
    
steps:
- uses: evalops/evalops-action@v1
  with:
    api-key: ${{ secrets.EVALOPS_API_KEY }}
    environment: ${{ matrix.environment }}
    budget-file: budget-${{ matrix.environment }}.yaml
```

### Automated PR Comments

The GitHub Action automatically posts detailed evaluation results to pull requests:

```
## ✅ EvalOps Evaluation Results

### Summary
- **Quality Score**: 🟢 0.82
- **Estimated Cost**: $2.45
- **Budget Status**: PASSED
- **Violations**: 0
- **Warnings**: 0

### Quality Assessment
🎉 Excellent code quality! Your evaluation meets high standards.

### Cost Analysis
- Estimated evaluation cost: $2.45
- ✅ Within budget constraints

### Next Steps
- All checks passed! Ready for production deployment

---
*Powered by EvalOps CLI | Action*
```

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
