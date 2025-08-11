#!/usr/bin/env node

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

import chalk from 'chalk';
import { Command } from 'commander';
import dotenv from 'dotenv';
import { BudgetCommand } from './commands/budget';
import { CostCommand } from './commands/cost';
import { InitCommand } from './commands/init';
import { UploadCommand } from './commands/upload';
import { ValidateCommand } from './commands/validate';

dotenv.config();

const program = new Command();

program.name('evalops').description('CLI for evaluating code against LLMs using the EvalOps platform').version('1.0.0');

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
  .option('--check-budget', 'Enforce budget constraints before and after evaluation')
  .option('--budget-file <file>', 'Path to budget.yaml file', './budget.yaml')
  .action(async (options) => {
    try {
      await UploadCommand.execute(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('cost')
  .description('Estimate the cost of running evaluations')
  .option('-f, --file <file>', 'Path to evalops.yaml file', './evalops.yaml')
  .option('--format <format>', 'Output format (table, json, csv)', 'table')
  .option('-v, --verbose', 'Show detailed breakdown')
  .action(async (options) => {
    try {
      await CostCommand.execute(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('budget')
  .description('Manage evaluation budget and quality gates')
  .option('--init', 'Initialize a new budget configuration')
  .option('--validate', 'Validate budget configuration')
  .option('-f, --file <file>', 'Path to budget.yaml file', './budget.yaml')
  .option('--environment <env>', 'Environment-specific budget settings')
  .option('--metrics <json>', 'JSON string with metrics to validate against budget')
  .action(async (options) => {
    try {
      await BudgetCommand.execute(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.on('command:*', (operands) => {
  console.error(chalk.red(`Unknown command: ${operands[0]}`));
  console.log('Available commands:');
  program.commands.forEach((cmd) => {
    console.log(`  ${cmd.name()} - ${cmd.description()}`);
  });
  process.exit(1);
});

if (process.argv.length < 3) {
  program.help();
}

program.parse();
