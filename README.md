# EvalOps CLI

The EvalOps CLI is a powerful tool for evaluating code against Large Language Models (LLMs) using the EvalOps platform. It allows you to define, validate, and run evaluations directly from your command line.

## Features

- **Initialize Projects**: Quickly set up a new EvalOps project with `evalops init`.
- **Validate Configurations**: Ensure your `evalops.yaml` file is correctly formatted and your test cases are discoverable with `evalops validate`.
- **Upload Test Suites**: Upload your evaluation configurations to the EvalOps platform with `evalops upload`.
- **Local Evaluations (Coming Soon)**: Run evaluations locally against different providers with `evalops run`.
- **Automatic Test Discovery**: Automatically discover test cases in your codebase defined with `@evalops_test` decorators or `evalops_test()` function calls.

## Installation

```bash
npm install -g evalops-cli
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

   The CLI can automatically discover test cases in your code. You can define a test case using the `@evalops_test` decorator or the `evalops_test()` function.

   **Using Decorator:**
   ```typescript
   import { evalops_test } from 'evalops-cli';

   @evalops_test({
     description: 'Test case for my function',
     tags: ['critical', 'refactor'],
   })
   function myFunction() {
     // Your code to be evaluated
   }
   ```

   **Using Function Call:**
   ```typescript
   import { evalops_test } from 'evalops-cli';

   evalops_test({
     description: 'Another test case',
   }, () => {
     // Your code to be evaluated
   });
   ```

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

- `description`: A brief description of the evaluation.
- `version`: The version of the evaluation configuration.
- `prompts`: The prompts to be sent to the LLM. Can be a single prompt or a list of messages with roles.
- `providers`: A list of LLM providers to use for the evaluation.
- `defaultTest`: Default assertions and variables for all test cases.
- `tests`: A list of specific test cases.
- `config`: Execution configuration like iterations, parallelism, and timeout.
- `outputPath`: The path to store the results of a local run.
- `outputFormat`: The format of the output file (`json`, `yaml`, `csv`).
- `sharing`: Configuration for sharing the evaluation results.
