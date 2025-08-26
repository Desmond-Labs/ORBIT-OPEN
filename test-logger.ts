// Simple logger test
console.log("Testing basic logging...");

process.env.LOG_LEVEL = 'DEBUG';

class Logger {
  private static readonly LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  private static currentLevel = process.env.LOG_LEVEL ? 
    Logger.LOG_LEVELS[process.env.LOG_LEVEL as keyof typeof Logger.LOG_LEVELS] || Logger.LOG_LEVELS.INFO 
    : Logger.LOG_LEVELS.INFO;

  private static startTime = Date.now();

  static info(...args: any[]) {
    console.log(`[${Logger.getTimestamp()}] [INFO]`, ...args);
  }

  private static getTimestamp(): string {
    const elapsed = Date.now() - Logger.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const ms = elapsed % 1000;
    return `${seconds.toString().padStart(3, '0')}.${ms.toString().padStart(3, '0')}s`;
  }
}

Logger.info("Logger test successful!");
console.log("Test completed successfully");