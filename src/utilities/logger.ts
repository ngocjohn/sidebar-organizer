import { ALERT_MSG } from '@constants';

const LOG_STYLES = {
  prefix: ['color: #4fc3f7', 'font-weight: bold'].join(';'),
  error: ['color: #f44336', 'font-weight: bold'].join(';'),
  warn: ['color: #ff9800', 'font-weight: bold'].join(';'),
  info: ['color: #8bc34a', 'font-weight: bold'].join(';'),
  debug: ['color: #2196f3', 'font-weight: bold'].join(';'),
  log: ['color: #9e9e9e', 'font-weight: bold'].join(';'),
  reset: ['color: inherit'].join(';'),
};

export function info(message: string, ...data: unknown[]): void {
  writeLog(message, LOG_STYLES.info, console.info, ...data);
}
export function error(message: string, ...data: unknown[]): void {
  writeLog(message, LOG_STYLES.error, console.error, ...data);
}

export function warn(message: string, ...data: unknown[]): void {
  writeLog(message, LOG_STYLES.warn, console.warn, ...data);
}

export function log(message: string, ...data: unknown[]): void {
  writeLog(message, LOG_STYLES.log, console.log, ...data);
}

export function debug(message: string, ...data: unknown[]): void {
  writeLog(message, LOG_STYLES.debug, console.log, ...data);
}

function writeLog(
  message: string,
  style: string,
  consoleMethod: (...args: unknown[]) => void,
  ...data: unknown[]
): void {
  const [formattedMessage, formattedStyle] = formatLogMessage(message, style);
  if (data.length > 0) {
    consoleMethod(formattedMessage, formattedStyle, ...data);
  } else {
    consoleMethod(formattedMessage, formattedStyle);
  }
}

const formatLogMessage = (message: string, style: string): [string, string] => {
  const formattedMessage = `%c${message}`;
  const formattedStyle = style;
  return [formattedMessage, formattedStyle];
};

export const loggingMSG = (message: string, ...data: unknown[]): void => {
  const [formattedMessage, formattedStyle] = formatLogMessage(message, LOG_STYLES.prefix);
  const formattedData =
    data.length > 0 ? [formattedMessage, formattedStyle, ...data] : [formattedMessage, formattedStyle];
  console.log(...formattedData);
};

export const infoFrontendModule = (hacsUrl?: string): void => {
  const logMsg = [ALERT_MSG.FRONTEND_MODULE, hacsUrl ? `hacs path: ${hacsUrl}` : '', ALERT_MSG.INSTALLATION_LINK]
    .filter((line) => line)
    .join('\n');
  info('sidebar-organizer:', logMsg);
};
