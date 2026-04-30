import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const appVersion = (Constants.expoConfig?.version ?? version) as string;
  const buildNumber =
    Platform.OS === 'ios'
      ? (Constants.expoConfig?.ios?.buildNumber ?? '')
      : String(Constants.expoConfig?.android?.versionCode ?? '');
  const bundleId =
    Platform.OS === 'ios'
      ? (Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.bubble.mobile')
      : (Constants.expoConfig?.android?.package ?? 'com.bubble.mobile');
  const release = buildNumber
    ? `${bundleId}@${appVersion}+${buildNumber}`
    : `${bundleId}@${appVersion}`;
  try {
    Sentry.init({
      dsn,
      release,
      dist: buildNumber || undefined,
      environment: __DEV__ ? 'development' : 'production',
      debug: __DEV__,
      enableNativeNagger: false,
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      autoSessionTracking: true,
      integrations: _navigationIntegration ? [_navigationIntegration] : [],
    });
    Sentry.addBreadcrumb({
      category: 'app.lifecycle',
      message: 'Sentry initialized',
      level: 'info',
      data: { environment: __DEV__ ? 'development' : 'production' },
    });
    console.log(`[CrashReporter] Sentry initialized successfully (release: ${release})`);
  } catch (e) {
    console.error('[CrashReporter] Sentry.init() threw — running without Sentry:', e);
  }
}

export const TRUNCATION_SUFFIX = '…[truncated]';
export const MAX_MESSAGE_CHARS = 1024;
export const MAX_STACK_CHARS = 4096;
export const MAX_CONTEXT_CHARS = 2048;

export const DEDUP_WINDOW_MS = 500;

// ---------------------------------------------------------------------------
// Span-expiry ring buffer
// ---------------------------------------------------------------------------

/** The lifecycle phase at which a child span was found to have already ended. */
export type SpanExpiryPhase = 'pre-work' | 'post-work';

/** A single span-expiry event recorded by measureScreenLoad. */
export interface SpanExpiryEvent {
  screenName: string;
  phase: SpanExpiryPhase;
  timestamp: string;
  /** Identifies which app session produced this event. Used for session-boundary display. */
  sessionId: string;
}

const SPAN_EXPIRY_BUFFER_SIZE = 50;
const SPAN_EXPIRY_STORAGE_KEY = '@debug/spanExpiryEvents';

/**
 * A stable identifier for the current JS runtime session, set once at module
 * load time.  Events from a previous run will carry a different value, which
 * the debug UI uses to render session-boundary separators.
 */
export const CURRENT_SESSION_ID = `session-${Date.now()}`;

const _spanExpiryBuffer: SpanExpiryEvent[] = [];

/**
 * All AsyncStorage operations are serialised through this chain so that:
 *  1. Hydration always runs before any write.
 *  2. Concurrent writes/clears are applied in the order they were requested.
 * This prevents a span-expiry recorded before hydration completes from
 * overwriting persisted history with an incomplete (current-session-only)
 * snapshot.
 */
let _storageChain: Promise<void> = Promise.resolve();

/** Append an async storage operation to the serial chain (never throws). */
function _enqueueStorage(op: () => Promise<unknown>): void {
  _storageChain = _storageChain.then(op).catch(() => {
    // All storage failures are silently swallowed — instrumentation must
    // never crash the app.
  });
}

/**
 * Hydrate the in-memory ring buffer from AsyncStorage.
 * Call this once during app start (before any events can be recorded) so that
 * span-expiry events from previous sessions survive restarts.
 * The combined buffer is capped at SPAN_EXPIRY_BUFFER_SIZE.
 * Returns the hydration promise so callers can await completion when needed.
 */
export function hydrateSpanExpiryEvents(): Promise<void> {
  _enqueueStorage(async () => {
    const raw = await AsyncStorage.getItem(SPAN_EXPIRY_STORAGE_KEY);
    if (!raw) return;
    const stored: SpanExpiryEvent[] = JSON.parse(raw);
    if (!Array.isArray(stored)) return;
    // Prepend stored events (older) before any events already in the buffer
    // (there should be none this early in startup, but guard anyway).
    _spanExpiryBuffer.unshift(...stored);
    // Enforce cap — keep the most recent SPAN_EXPIRY_BUFFER_SIZE entries.
    if (_spanExpiryBuffer.length > SPAN_EXPIRY_BUFFER_SIZE) {
      _spanExpiryBuffer.splice(0, _spanExpiryBuffer.length - SPAN_EXPIRY_BUFFER_SIZE);
    }
  });
  return _storageChain;
}

/**
 * Push a new span-expiry event into the ring buffer and persist it.
 * When the buffer is full the oldest entry is discarded.
 * The write is serialised after any in-flight hydration so it always
 * captures the full merged buffer, not just the current session's events.
 * Safe to call from instrumentation — never throws.
 */
export function recordSpanExpiry(screenName: string, phase: SpanExpiryPhase): void {
  try {
    const event: SpanExpiryEvent = {
      screenName,
      phase,
      timestamp: new Date().toISOString(),
      sessionId: CURRENT_SESSION_ID,
    };
    _spanExpiryBuffer.push(event);
    if (_spanExpiryBuffer.length > SPAN_EXPIRY_BUFFER_SIZE) {
      _spanExpiryBuffer.shift();
    }
    // Snapshot the buffer now so the correct state is captured even if further
    // mutations happen before the enqueued write executes.
    const snapshot = JSON.stringify(_spanExpiryBuffer);
    _enqueueStorage(() => AsyncStorage.setItem(SPAN_EXPIRY_STORAGE_KEY, snapshot));
  } catch {
    // Instrumentation must never crash the app
  }
}

/**
 * Return a snapshot of all buffered span-expiry events, newest-first.
 * The returned array is a copy — callers may mutate it freely.
 */
export function getSpanExpiryEvents(): SpanExpiryEvent[] {
  return [..._spanExpiryBuffer].reverse();
}

/**
 * Clear all buffered span-expiry events and remove them from AsyncStorage.
 * The removal is serialised after any in-flight hydration or write so the
 * storage reflects the cleared state even if operations were queued ahead.
 * Exported so tests and the debug screen can reset state.
 */
export function clearSpanExpiryEvents(): void {
  _spanExpiryBuffer.length = 0;
  _enqueueStorage(() => AsyncStorage.removeItem(SPAN_EXPIRY_STORAGE_KEY));
}

const _recentMessages = new Map<string, number>();

export function isDuplicate(key: string): boolean {
  const now = Date.now();
  for (const [k, ts] of _recentMessages) {
    if (now - ts >= DEDUP_WINDOW_MS) {
      _recentMessages.delete(k);
    }
  }
  const last = _recentMessages.get(key);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) {
    return true;
  }
  _recentMessages.set(key, now);
  return false;
}

export function resetDedupCache(): void {
  _recentMessages.clear();
}

export function dedupCacheSize(): number {
  return _recentMessages.size;
}

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

/**
 * @param options.bypass - When true, skips the dedup guard so the event always
 *   reaches Sentry regardless of how recently the same message was sent.
 *   Use for high-priority or one-off events that must never be silently dropped.
 */
export function logAppEvent(
  message: string,
  attributes?: Record<string, string | number | boolean>,
  options?: { bypass?: boolean },
): void {
  if (__DEV__) {
    console.log(`[AppEvent] ${message}`, attributes ?? {});
  }
  if (!options?.bypass && isDuplicate(`event:${message}`)) return;
  Sentry.addBreadcrumb({
    category: 'app.event',
    message,
    data: attributes,
    level: 'info',
  });
}

/**
 * @param options.bypass - When true, skips the dedup guard so the warning always
 *   reaches Sentry regardless of how recently the same message was sent.
 *   Use for high-priority or one-off warnings that must never be silently dropped.
 */
export function logAppWarn(
  message: string,
  attributes?: Record<string, string | number | boolean>,
  options?: { bypass?: boolean },
): void {
  console.warn(`[AppWarn] ${message}`, attributes ?? {});
  if (!options?.bypass && isDuplicate(`warn:${message}`)) return;
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

/**
 * Measures how long a screen takes to load its initial data and records the
 * result as a custom measurement on the active Sentry transaction.  If no
 * transaction is active (e.g. Sentry disabled / no DSN) the function still
 * runs `work` normally and only skips the instrumentation.
 *
 * A dedicated child span is created via startInactiveSpan so that we never
 * call finish() on the span returned by getActiveSpan(), which may be the root
 * navigation transaction managed by reactNavigationIntegration.  Finishing
 * that span prematurely would close the transaction while the SDK is still
 * using it, causing lost or incomplete trace data.
 *
 * Usage:
 *   const data = await measureScreenLoad('Login', () => fetchLoginData());
 */
export async function measureScreenLoad<T>(
  screenName: string,
  work: () => Promise<T>,
): Promise<T> {
  const startMs = Date.now();

  // Capture whether a navigation transaction is active before work begins.
  // This flag is used in the finally block to decide whether to record
  // measurements — decoupled from child span creation so metrics are never
  // silently dropped even if startInactiveSpan is unavailable on older builds.
  let hasActiveSpan = false;
  let childSpan: ReturnType<typeof Sentry.startInactiveSpan> | undefined;
  try {
    hasActiveSpan = !!Sentry.getActiveSpan?.();
    if (hasActiveSpan) {
      // Create a dedicated child span so we never call finish/end on the root
      // navigation transaction managed by reactNavigationIntegration.
      childSpan = Sentry.startInactiveSpan?.({ name: `screen_load.${screenName}`, op: 'ui.load' });
      // Pre-work guard: detect spans that already timed out between the time
      // startInactiveSpan returned and when the work callback is about to begin.
      if (childSpan) {
        const preSpan = childSpan as { isRecording?: () => boolean };
        if (preSpan.isRecording?.() === false) {
          const msg = `[PerfTrace] ${screenName}: child span already ended before work began — span may have timed out`;
          console.warn(msg);
          Sentry.addBreadcrumb({ level: 'warning', category: 'performance', message: msg });
          recordSpanExpiry(screenName, 'pre-work');
        }
      }
    }
  } catch {
    // Instrumentation must never crash the app
  }

  try {
    return await work();
  } finally {
    const durationMs = Date.now() - startMs;
    try {
      // Record measurement whenever a navigation transaction was active at the
      // start of the load, even if startInactiveSpan was unavailable (older SDK).
      if (hasActiveSpan) {
        Sentry.setMeasurement('screen_load_ms', durationMs, 'millisecond');
        Sentry.getCurrentScope?.().setTag('screen', screenName);
      }
      // End only the dedicated child span — never the root transaction.
      // Sentry v7+ uses end(); finish() is a fallback for older SDK builds.
      if (childSpan) {
        const span = childSpan as { end?: () => void; finish?: () => void; isRecording?: () => boolean };
        // isRecording() returns false when the span has already been ended (e.g.
        // it timed out during a long async load).  Calling end()/finish() on a
        // finished span may silently discard the measurement, so we skip the
        // call and emit an observable warning instead so the team can detect
        // data loss in development and via Sentry breadcrumbs in production.
        const recording = span.isRecording?.();
        if (recording === false) {
          const msg = `[PerfTrace] ${screenName}: child span already ended before finish — screen_load_ms measurement may be lost`;
          console.warn(msg);
          Sentry.addBreadcrumb({ level: 'warning', category: 'performance', message: msg });
          recordSpanExpiry(screenName, 'post-work');
        } else {
          // recording === true OR isRecording is absent (older SDK) — proceed normally.
          (span.end ?? span.finish)?.();
        }
      }
      if (__DEV__) {
        console.log(`[PerfTrace] ${screenName} loaded in ${durationMs} ms`);
      }
    } catch {
      // Never let instrumentation crash the app
    }
  }
}

/**
 * Wraps an async background task so that any unhandled error is captured by
 * Sentry instead of being silently swallowed.  The wrapper tags the event with
 * `background_task: taskName` so it is easy to filter in the Sentry dashboard.
 *
 * Returns `undefined` when the task throws (the error is still reported).
 *
 * Usage:
 *   AppState.addEventListener('change', () =>
 *     withBackgroundTask('AppState.handleChange', () => myAsyncHandler())
 *   );
 */
export async function withBackgroundTask<T>(
  taskName: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[BackgroundTask] "${taskName}" threw:`, error.message);
    Sentry.withScope((scope) => {
      scope.setTag('background_task', taskName);
      scope.setTag('screen', `background.${taskName}`);
      scope.setTag('platform', Platform.OS);
      scope.setLevel('error');
      Sentry.captureException(error);
    });
    return undefined;
  }
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
