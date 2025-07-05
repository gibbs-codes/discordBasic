// src/utils/logger.js - Structured Logging Utility
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor() {
    this.logLevel = this.getLogLevel();
    this.enableColors = process.env.NODE_ENV !== 'production';
  }

  getLogLevel() {
    const level = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
    return LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : LOG_LEVELS.INFO;
  }

  formatTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, ...args) {
    const timestamp = this.formatTimestamp();
    const prefix = `[${timestamp}] [${level}]`;
    
    if (this.enableColors) {
      const colors = {
        ERROR: '\x1b[31m', // Red
        WARN: '\x1b[33m',  // Yellow
        INFO: '\x1b[36m',  // Cyan
        DEBUG: '\x1b[90m'  // Gray
      };
      const resetColor = '\x1b[0m';
      
      return `${colors[level]}${prefix}${resetColor} ${message}`;
    }
    
    return `${prefix} ${message}`;
  }

  log(level, levelNum, message, ...args) {
    if (levelNum <= this.logLevel) {
      const formattedMessage = this.formatMessage(level, message);
      
      if (args.length > 0) {
        console.log(formattedMessage, ...args);
      } else {
        console.log(formattedMessage);
      }
    }
  }

  error(message, ...args) {
    this.log('ERROR', LOG_LEVELS.ERROR, message, ...args);
  }

  warn(message, ...args) {
    this.log('WARN', LOG_LEVELS.WARN, message, ...args);
  }

  info(message, ...args) {
    this.log('INFO', LOG_LEVELS.INFO, message, ...args);
  }

  debug(message, ...args) {
    this.log('DEBUG', LOG_LEVELS.DEBUG, message, ...args);
  }

  // Special method for Discord events
  discord(event, details) {
    this.info(`📡 Discord ${event}:`, details);
  }

  // Special method for LLM interactions
  llm(provider, action, details) {
    this.info(`🧠 LLM ${provider} ${action}:`, details);
  }

  // Special method for reconciliation events
  reconciliation(action, details) {
    this.info(`💰 Reconciliation ${action}:`, details);
  }

  // Special method for memory operations
  memory(action, details) {
    this.info(`🧠 Memory ${action}:`, details);
  }
}

export const logger = new Logger();