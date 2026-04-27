import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { version } from '../../package.json';
import * as Sentry from '@sentry/react-native';

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

export function initSentry(): void {
  const dsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;
  if (!dsn) {
    console.warn('[CrashReporter] SENTRY_DSN not configured — Sentry disabled');
    return;
  }
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    debug: __DEV__,
    enableNativeNagger: false,
  });
  Sentry.addBreadcrumb({
    category: 'app.lifecycle',
    message: 'Sentry initialized',
    level: 'info',
    data: { environment: __DEV__ ? 'development' : 'production' },
  });
  console.log('[CrashReporter] Sentry initialized successfully');
}

const TRUNCATION_SUFFIX = '…[truncated]';
const MAX_MESSAGE_CHARS = 1024;
const MAX_STACK_CHARS = 4096;
const MAX_CONTEXT_CHARS = 2048;

function buildReport(error: Error, context?: string, isFatal = false): CrashReport {
  let message = error.message;
  if (message && message.length > MAX_MESSAGE_CHARS) {
    message = message.slice(0, MAX_MESSAGE_CHARS - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
  }
  let stack = error.stack;
  if (stack && stack.length > MAX_STACK_CHARS) {
    stack = stack.slice(0, MAX_STACK_CHARS - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
  }
  let truncatedContext = context;
  if (truncatedContext && truncatedContext.length > MAX_CONTEXT_CHARS) {
    truncatedContext =
      truncatedContext.slice(0, MAX_CONTEXT_CHARS - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
  }
  return {
    message,
    stack,
    context: truncatedContext,
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
  }).catch(() => {});
}

export function reportError(error: Error, context?: string): void {
  const report = buildReport(error, context, false);
  console.error(`[CrashReporter] ERROR${context ? ` in ${context}` : ''}: ${report.message}`);
  Sentry.withScope((scope) => {
    if (context) scope.setTag('screen', context);
    scope.setTag('platform', report.platform);
    scope.setTag('appVersion', report.appVersion);
    scope.setLevel('error');
    Sentry.captureException(error);
  });
  sendToServer(report);
}

export function reportFatalError(
  error: Error,
  context?: string,
  componentStack?: string,
): void {
  const report = buildReport(error, context, true);
  console.error(`[CrashReporter] FATAL${context ? ` in ${context}` : ''}: ${report.message}`);
  Sentry.withScope((scope) => {
    if (context) scope.setTag('screen', context);
    scope.setTag('platform', report.platform);
    scope.setTag('appVersion', report.appVersion);
    scope.setLevel('fatal');
    if (componentStack) scope.setExtra('componentStack', componentStack);
    if (context) {
      scope.setFingerprint(['{{ default }}', context]);
    }
    Sentry.captureException(error);
  });
  sendToServer(report);
}

export function logAppEvent(
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  if (__DEV__) {
    console.log(`[AppEvent] ${message}`, attributes ?? {});
  }
  Sentry.addBreadcrumb({
    category: 'app.event',
    message,
    data: attributes,
    level: 'info',
  });
  const context = attributes ? JSON.stringify(attributes) : undefined;
  sendToServer(buildReport(new Error(message), context, false));
}

export function logAppWarn(
  message: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  console.warn(`[AppWarn] ${message}`, attributes ?? {});
  Sentry.withScope((scope) => {
    if (attributes) {
      Object.entries(attributes).forEach(([k, v]) => scope.setExtra(k, v));
    }
    scope.setTag('alert_type', 'app_warning');
    Sentry.captureMessage(`[AppWarn] ${message}`, 'warning');
  });
  const context = attributes ? JSON.stringify(attributes) : undefined;
  const report = buildReport(new Error(message), context, false);
  sendToServer(report);
}

export function setSentryUser(id: string, username: string, isSuperAdmin?: boolean): void {
  Sentry.setUser({ id, username });
  Sentry.configureScope((scope) => {
    scope.setTag('isSuperAdmin', isSuperAdmin === true ? 'true' : 'false');
  });
}

export function clearSentryUser(): void {
  Sentry.setUser(null);
  Sentry.configureScope((scope) => {
    scope.setTag('isSuperAdmin', 'false');
  });
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
