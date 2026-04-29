import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { version } from '../../package.json';
import * as Sentry from '@sentry/react-native';

export interface CrashReport {
  message: string;
  stack?: string;
  context?: string;
  platform: string;
  timestamp: string;
  isFatal: boolean;
  appVersion: string;
  userId?: string;
  username?: string;
}

let _navigationIntegration: ReturnType<typeof Sentry.reactNavigationIntegration> | null = null;
try {
  _navigationIntegration = Sentry.reactNavigationIntegration();
} catch (e) {
  console.warn('[CrashReporter] reactNavigationIntegration() unavailable (Expo Go):', e);
}
export const navigationIntegration = _navigationIntegration;

let _currentUserId: string | undefined;
let _currentUsername: string | undefined;

export function initSentry(): void {
  const dsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;
  console.log('[CrashReporter] DSN present:', !!dsn);
  if (!dsn) {
    console.warn('[CrashReporter] SENTRY_DSN not configured — Sentry disabled');
    return;
  }
  const release = (Constants.expoConfig?.version ?? version) as string;
  try {
    Sentry.init({
      dsn,
      release,
      environment: __DEV__ ? 'development' : 'production',
      debug: __DEV__,
      enableNativeNagger: false,
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      integrations: _navigationIntegration ? [_navigationIntegration] : [],
    });
    Sentry.addBreadcrumb({
      category: 'app.lifecycle',
      message: 'Sentry initialized',
      level: 'info',
      data: { environment: __DEV__ ? 'development' : 'production' },
    });
    console.log('[CrashReporter] Sentry initialized successfully');
  } catch (e) {
    console.error('[CrashReporter] Sentry.init() threw — running without Sentry:', e);
  }
}

export const TRUNCATION_SUFFIX = '…[truncated]';
export const MAX_MESSAGE_CHARS = 1024;
export const MAX_STACK_CHARS = 4096;
export const MAX_CONTEXT_CHARS = 2048;

export function buildReport(error: Error, context?: string, isFatal = false): CrashReport {
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
    userId: _currentUserId,
    username: _currentUsername,
  };
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
}

export function setSentryUser(id: string, username: string, isSuperAdmin?: boolean): void {
  _currentUserId = id;
  _currentUsername = username;
  Sentry.setUser({ id, username });
  Sentry.configureScope((scope) => {
    scope.setTag('isSuperAdmin', isSuperAdmin === true ? 'true' : 'false');
  });
}

export function clearSentryUser(): void {
  _currentUserId = undefined;
  _currentUsername = undefined;
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
