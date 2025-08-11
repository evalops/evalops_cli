import chalk from 'chalk';

export class Logger {
  private static debugEnabled: boolean = false;

  static setDebug(debug: boolean): void {
    Logger.debugEnabled = debug;
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
    if (Logger.debugEnabled) {
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
