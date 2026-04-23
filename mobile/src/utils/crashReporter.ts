import { Platform } from 'react-native';
import { version } from '../../package.json';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://163cfc20-e221-41ad-b2c3-67afe2df4e33-00-15yrg27byh3aa.spock.replit.dev' ||
  'http://localhost:3000';

const CRASH_REPORT_URL = `${API_URL}/api/crash-report`;

export interface CrashReport {
  message: string;
  stack?: string;
  context?: string;
  platform: string;
  timestamp: string;
  isFatal: boolean;
  appVersion: string;
}

function buildReport(error: Error, context?: string, isFatal = false): CrashReport {
  return {
    message: error.message,
    stack: error.stack,
    context,
    platform: Platform.OS,
    timestamp: new Date().toISOString(),
    isFatal,
    appVersion: version ?? 'unknown',
  };
}

function sendToServer(report: CrashReport): void {
  fetch(CRASH_REPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  }).catch(() => {
  });
}

export function reportError(error: Error, context?: string): void {
  const report = buildReport(error, context, false);
  console.error(
    `[CrashReporter] ERROR${context ? ` in ${context}` : ''}:`,
    report.message,
    '\nStack:', report.stack ?? 'no stack',
    '\nTimestamp:', report.timestamp,
  );
  sendToServer(report);
}

export function reportFatalError(error: Error, context?: string): void {
  const report = buildReport(error, context, true);
  console.error(
    `[CrashReporter] FATAL${context ? ` in ${context}` : ''}:`,
    report.message,
    '\nStack:', report.stack ?? 'no stack',
    '\nTimestamp:', report.timestamp,
  );
  sendToServer(report);
}

export function installGlobalHandlers(): void {
  const globalObj = global as Record<string, unknown>;

  const errorUtils = globalObj.ErrorUtils as {
    getGlobalHandler?: () => (error: Error, isFatal: boolean) => void;
    setGlobalHandler?: (handler: (error: Error, isFatal: boolean) => void) => void;
  } | undefined;

  if (errorUtils?.setGlobalHandler && errorUtils?.getGlobalHandler) {
    const previousHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
      if (isFatal) {
        reportFatalError(error, 'GlobalErrorUtils');
      } else {
        reportError(error, 'GlobalErrorUtils');
      }
      previousHandler?.(error, isFatal);
    });
  }

  const PromiseAny = Promise as unknown as {
    _unhandledRejectionCallback?: (reason: unknown) => void;
  };
  const previousRejectionHandler = PromiseAny._unhandledRejectionCallback;
  PromiseAny._unhandledRejectionCallback = (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    reportError(error, 'UnhandledPromiseRejection');
    previousRejectionHandler?.(reason);
  };
}
