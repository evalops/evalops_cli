import chalk from 'chalk';

export class Logger {
  private static debug: boolean = false;

  static setDebug(debug: boolean): void {
    this.debug = debug;
  }

  static info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  static success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  static warn(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  static error(message: string): void {
    console.error(chalk.red('✗'), message);
  }

  static debug(message: string): void {
    if (this.debug) {
      console.log(chalk.gray('🔍'), chalk.gray(message));
    }
  }

  static plain(message: string): void {
    console.log(message);
  }

  static newline(): void {
    console.log();
  }
}