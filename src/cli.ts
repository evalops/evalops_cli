#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { InitCommand } from './commands/init';
import { ValidateCommand } from './commands/validate';
import { UploadCommand } from './commands/upload';
import { RunCommand } from './commands/run';

dotenv.config();

const program = new Command();

program
  .name('evalops')
  .description('CLI for evaluating code against LLMs using the EvalOps platform')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize a new EvalOps project')
  .option('-f, --force', 'Overwrite existing evalops.yaml file')
  .option('--template <template>', 'Use a specific template (basic, advanced)')
  .action(async (options) => {
    try {
      await InitCommand.execute(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate the evalops.yaml file and discovered test cases')
  .option('-v, --verbose', 'Show detailed validation output')
  .option('-f, --file <file>', 'Path to evalops.yaml file', './evalops.yaml')
  .action(async (options) => {
    try {
      await ValidateCommand.execute(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('upload')
  .description('Upload test suite to EvalOps platform')
  .option('-f, --file <file>', 'Path to evalops.yaml file', './evalops.yaml')
  .option('--api-key <key>', 'EvalOps API key')
  .option('--api-url <url>', 'EvalOps API URL', 'https://api.evalops.dev')
  .option('--name <name>', 'Name for the test suite')
  .option('--dry-run', 'Preview what would be uploaded without actually uploading')
  .action(async (options) => {
    try {
      await UploadCommand.execute(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Run evaluation locally (not implemented yet)')
  .option('-f, --file <file>', 'Path to evalops.yaml file', './evalops.yaml')
  .option('--provider <provider>', 'Specify provider to use')
  .option('--output <output>', 'Output file path')
  .action(async (options) => {
    try {
      await RunCommand.execute(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .on('command:*', (operands) => {
    console.error(chalk.red(`Unknown command: ${operands[0]}`));
    console.log('Available commands:');
    program.commands.forEach(cmd => {
      console.log(`  ${cmd.name()} - ${cmd.description()}`);
    });
    process.exit(1);
  });

if (process.argv.length < 3) {
  program.help();
}

program.parse();