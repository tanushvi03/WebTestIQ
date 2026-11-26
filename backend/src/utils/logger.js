const { createLogger, format, transports } = require('winston');
const { combine, timestamp, colorize, printf } = format;

const lineFormat = printf(({ level, message, timestamp }) =>
  `${timestamp} [${level}] ${message}`
);

const logger = createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'HH:mm:ss' }),
    colorize(),
    lineFormat
  ),
  transports: [new transports.Console()],
});

module.exports = logger;
