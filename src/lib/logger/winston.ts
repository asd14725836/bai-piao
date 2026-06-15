import winston from 'winston'
import { config } from '@/config'
import { consoleFormat, fileFormat } from './formats'

const { LOG_LEVEL, LOG_CONSOLE_ENABLED, LOG_DIR } = config
// 只保留文件日志（简单追加），无需 rotating-file-stream
const LOG_FILE_ENABLED = false

/**
 * Winston Logger 实例
 */
class Logger {
  private logger: winston.Logger

  constructor() {
    const transports: winston.transport[] = []

    // Console 传输器
    if (LOG_CONSOLE_ENABLED) {
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
        }),
      )
    }

    // 文件日志（简单追加模式）
    if (LOG_FILE_ENABLED && LOG_DIR) {
      transports.push(
        new winston.transports.File({
          filename: `${LOG_DIR}/application.log`,
          format: fileFormat,
          level: LOG_LEVEL,
          maxsize: 20 * 1024 * 1024, // 20MB
          maxFiles: 5,
        }),
      )
      transports.push(
        new winston.transports.File({
          filename: `${LOG_DIR}/error.log`,
          format: fileFormat,
          level: 'error',
          maxsize: 20 * 1024 * 1024,
          maxFiles: 5,
        }),
      )
    }

    this.logger = winston.createLogger({
      level: LOG_LEVEL,
      transports,
      exitOnError: false,
    })

    // 异常处理（仅 console）
    this.logger.exceptions.handle(new winston.transports.Console({ format: consoleFormat }))
    this.logger.rejections.handle(new winston.transports.Console({ format: consoleFormat }))
  }

  child(service: string) {
    return this.logger.child({ service })
  }

  error(message: string, meta?: any) {
    this.logger.error(message, meta)
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta)
  }

  info(message: string, meta?: any) {
    this.logger.info(message, meta)
  }

  http(message: string, meta?: any) {
    this.logger.http(message, meta)
  }

  verbose(message: string, meta?: any) {
    this.logger.verbose(message, meta)
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, meta)
  }

  silly(message: string, meta?: any) {
    this.logger.silly(message, meta)
  }

  getInstance() {
    return this.logger
  }
}

export const logger = new Logger()
