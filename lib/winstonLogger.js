/**
 * Winston Logger - Logs structurés pour XCANNES
 * Production-ready logger avec rotation de fichiers
 */

import winston from 'winston';
import path from 'path';

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'xcannes-frontend' },
  transports: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880,
      maxFiles: 10,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  winstonLogger.add(new winston.transports.Console({ format: consoleFormat }));
}

// Helpers pour logs métier
winstonLogger.stripe = {
  payment: (data) => winstonLogger.info('STRIPE_PAYMENT', { category: 'stripe', ...data }),
  webhook: (data) => winstonLogger.info('STRIPE_WEBHOOK', { category: 'stripe', ...data }),
  fulfillment: (data) => winstonLogger.info('STRIPE_FULFILLMENT', { category: 'stripe', ...data }),
  error: (data) => winstonLogger.error('STRIPE_ERROR', { category: 'stripe', ...data }),
};

winstonLogger.xumm = {
  connect: (data) => winstonLogger.info('XUMM_CONNECT', { category: 'xumm', ...data }),
  sign: (data) => winstonLogger.info('XUMM_SIGN', { category: 'xumm', ...data }),
  balance: (data) => winstonLogger.info('XUMM_BALANCE', { category: 'xumm', ...data }),
  error: (data) => winstonLogger.error('XUMM_ERROR', { category: 'xumm', ...data }),
};

winstonLogger.xrpl = {
  payment: (data) => winstonLogger.info('XRPL_PAYMENT', { category: 'xrpl', ...data }),
  trustline: (data) => winstonLogger.info('XRPL_TRUSTLINE', { category: 'xrpl', ...data }),
  error: (data) => winstonLogger.error('XRPL_ERROR', { category: 'xrpl', ...data }),
};

export default winstonLogger;
