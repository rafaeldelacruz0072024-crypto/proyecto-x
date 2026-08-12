/**
 * Logger - Sistema de logging centralizado
 * Usa Winston para logs estructurados
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logFile = process.env.LOG_FILE || 'logs/control-mission.log';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.ensureLogDirExists();
  }

  ensureLogDirExists() {
    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const dataStr = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  write(level, message, data = {}) {
    const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = logLevels[level] || 2;
    const configuredLevel = logLevels[this.logLevel] || 2;

    if (currentLevel <= configuredLevel) {
      const formattedMessage = this.formatMessage(level, message, data);
      
      // Consola
      console.log(formattedMessage);
      
      // Archivo
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    }
  }

  info(message, data = {}) {
    this.write('info', message, data);
  }

  warn(message, data = {}) {
    this.write('warn', message, data);
  }

  error(message, data = {}) {
    this.write('error', message, data);
  }

  debug(message, data = {}) {
    this.write('debug', message, data);
  }

  // Logs especiales para el sistema
  logTask(taskId, action, details = {}) {
    this.info(`[TAREA:${taskId}] ${action}`, details);
  }

  logAgent(agentId, action, details = {}) {
    this.info(`[AGENTE:${agentId}] ${action}`, details);
  }

  logTelegram(userId, action, details = {}) {
    this.info(`[TELEGRAM:${userId}] ${action}`, details);
  }
}

module.exports = Logger;
