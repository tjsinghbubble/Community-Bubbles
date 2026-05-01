const mockAddEventListener = jest.fn().mockReturnValue({ remove: jest.fn() });

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: {
    addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
  },
}));

const mockNetInfoAddEventListener = jest.fn().mockReturnValue(jest.fn());

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (...args: unknown[]) => mockNetInfoAddEventListener(...args),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../sentry-stub', () => ({
  init: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  configureScope: jest.fn(),
  setUser: jest.fn(),
  reactNavigationIntegration: jest.fn().mockReturnValue({ registerNavigationContainer: jest.fn() }),
  getActiveSpan: jest.fn(),
  startInactiveSpan: jest.fn(),
  setMeasurement: jest.fn(),
  getCurrentScope: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
  },
}));

jest.mock('../../package.json', () => ({ version: '1.0.0' }), { virtual: true });

import * as Sentry from '../sentry-stub';
import Constants from 'expo-constants';

import {
  buildReport,
  reportError,
  reportFatalError,
  logAppEvent,
  logAppWarn,
  setSentryUser,
  clearSentryUser,
  installGlobalHandlers,
  initSentry,
  measureScreenLoad,
  withBackgroundTask,
  recordSpanExpiry,
  getSpanExpiryEvents,
  clearSpanExpiryEvents,
  MAX_MESSAGE_CHARS,
  MAX_STACK_CHARS,
  MAX_CONTEXT_CHARS,
  TRUNCATION_SUFFIX,
  DEDUP_WINDOW_MS,
  isDuplicate,
  resetDedupCache,
  dedupCacheSize,
  sendToServer,
  queueReport,
  flushOfflineQueue,
  clearOfflineQueue,
  readOfflineQueue,
  readRetryState,
  resetRetryState,
  initOfflineRetry,
  OFFLINE_QUEUE_MAX_SIZE,
  OFFLINE_QUEUE_STORAGE_KEY,
  RETRY_STATE_STORAGE_KEY,
  BACKOFF_BASE_MS,
  BACKOFF_CAP_MS,
} from '../crashReporter';

function makeError(message: string, stackLength: number): Error {
  const err = new Error(message);
  err.stack = 'a'.repeat(stackLength);
  return err;
}

describe('buildReport — stack truncation', () => {
  it('does not truncate stack when it is under the limit', () => {
    const stack = 'b'.repeat(MAX_STACK_CHARS);
    const err = new Error('test');
    err.stack = stack;

    const report = buildReport(err);

    expect(report.stack).toBe(stack);
    expect(report.stack!.endsWith(TRUNCATION_SUFFIX)).toBe(false);
    expect(report.stack!.length).toBe(MAX_STACK_CHARS);
  });

  it('does not truncate stack when it is exactly at the limit', () => {
    const stack = 'c'.repeat(MAX_STACK_CHARS);
    const err = new Error('test');
    err.stack = stack;

    const report = buildReport(err);

    expect(report.stack).toBe(stack);
    expect(report.stack!.length).toBe(MAX_STACK_CHARS);
  });

  it('truncates stack when it exceeds the limit', () => {
    const err = makeError('overflow', MAX_STACK_CHARS + 100);

    const report = buildReport(err);

    expect(report.stack!.length).toBe(MAX_STACK_CHARS);
    expect(report.stack!.endsWith(TRUNCATION_SUFFIX)).toBe(true);
  });

  it('applies the truncation suffix correctly after slicing', () => {
    const overflow = 500;
    const err = makeError('big stack', MAX_STACK_CHARS + overflow);
    const expectedPrefix = 'a'.repeat(MAX_STACK_CHARS - TRUNCATION_SUFFIX.length);

    const report = buildReport(err);

    expect(report.stack).toBe(expectedPrefix + TRUNCATION_SUFFIX);
  });
});

describe('buildReport — context truncation', () => {
  it('does not truncate context when it is under the limit', () => {
    const context = 'd'.repeat(MAX_CONTEXT_CHARS);
    const err = new Error('test');

    const report = buildReport(err, context);

    expect(report.context).toBe(context);
    expect(report.context!.endsWith(TRUNCATION_SUFFIX)).toBe(false);
    expect(report.context!.length).toBe(MAX_CONTEXT_CHARS);
  });

  it('does not truncate context when it is exactly at the limit', () => {
    const context = 'e'.repeat(MAX_CONTEXT_CHARS);
    const err = new Error('test');

    const report = buildReport(err, context);

    expect(report.context).toBe(context);
    expect(report.context!.length).toBe(MAX_CONTEXT_CHARS);
  });

  it('truncates context when it exceeds the limit', () => {
    const context = 'f'.repeat(MAX_CONTEXT_CHARS + 200);
    const err = new Error('test');

    const report = buildReport(err, context);

    expect(report.context!.length).toBe(MAX_CONTEXT_CHARS);
    expect(report.context!.endsWith(TRUNCATION_SUFFIX)).toBe(true);
  });

  it('applies the truncation suffix correctly after slicing', () => {
    const context = 'g'.repeat(MAX_CONTEXT_CHARS + 50);
    const expectedPrefix = 'g'.repeat(MAX_CONTEXT_CHARS - TRUNCATION_SUFFIX.length);
    const err = new Error('test');

    const report = buildReport(err, context);

    expect(report.context).toBe(expectedPrefix + TRUNCATION_SUFFIX);
  });
});

describe('buildReport — both fields over the limit', () => {
  it('truncates both stack and context independently', () => {
    const err = makeError('double overflow', MAX_STACK_CHARS + 300);
    const context = 'h'.repeat(MAX_CONTEXT_CHARS + 300);

    const report = buildReport(err, context);

    expect(report.stack!.length).toBe(MAX_STACK_CHARS);
    expect(report.stack!.endsWith(TRUNCATION_SUFFIX)).toBe(true);
    expect(report.context!.length).toBe(MAX_CONTEXT_CHARS);
    expect(report.context!.endsWith(TRUNCATION_SUFFIX)).toBe(true);
  });
});

describe('buildReport — no context provided', () => {
  it('leaves context undefined when no context argument is given', () => {
    const err = new Error('no context');

    const report = buildReport(err);

    expect(report.context).toBeUndefined();
  });
});

describe('buildReport — isFatal flag', () => {
  it('defaults isFatal to false', () => {
    const report = buildReport(new Error('test'));
    expect(report.isFatal).toBe(false);
  });

  it('sets isFatal to true when specified', () => {
    const report = buildReport(new Error('test'), undefined, true);
    expect(report.isFatal).toBe(true);
  });
});

describe('buildReport — message truncation', () => {
  it('does not truncate message when it is under the limit', () => {
    const msg = 'm'.repeat(MAX_MESSAGE_CHARS);
    const report = buildReport(new Error(msg));

    expect(report.message).toBe(msg);
    expect(report.message.endsWith(TRUNCATION_SUFFIX)).toBe(false);
    expect(report.message.length).toBe(MAX_MESSAGE_CHARS);
  });

  it('does not truncate message when it is exactly at the limit', () => {
    const msg = 'n'.repeat(MAX_MESSAGE_CHARS);
    const report = buildReport(new Error(msg));

    expect(report.message).toBe(msg);
    expect(report.message.length).toBe(MAX_MESSAGE_CHARS);
  });

  it('truncates message when it exceeds the limit', () => {
    const msg = 'o'.repeat(MAX_MESSAGE_CHARS + 200);
    const report = buildReport(new Error(msg));

    expect(report.message.length).toBe(MAX_MESSAGE_CHARS);
    expect(report.message.endsWith(TRUNCATION_SUFFIX)).toBe(true);
  });

  it('applies the truncation suffix correctly after slicing', () => {
    const msg = 'p'.repeat(MAX_MESSAGE_CHARS + 50);
    const expectedPrefix = 'p'.repeat(MAX_MESSAGE_CHARS - TRUNCATION_SUFFIX.length);
    const report = buildReport(new Error(msg));

    expect(report.message).toBe(expectedPrefix + TRUNCATION_SUFFIX);
  });
});

type MockScope = {
  setTag: jest.Mock;
  setLevel: jest.Mock;
  setExtra: jest.Mock;
  setFingerprint: jest.Mock;
};

function makeMockScope(): MockScope {
  return {
    setTag: jest.fn(),
    setLevel: jest.fn(),
    setExtra: jest.fn(),
    setFingerprint: jest.fn(),
  };
}

describe('reportError', () => {
  let mockScope: MockScope;

  beforeEach(() => {
    mockScope = makeMockScope();
    jest.clearAllMocks();
    (Sentry.withScope as jest.Mock).mockImplementation(
      (cb: (scope: MockScope) => void) => { cb(mockScope); },
    );
  });

  it('calls Sentry.captureException with the provided error', () => {
    const error = new Error('something went wrong');

    reportError(error);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('sets Sentry level to "error"', () => {
    reportError(new Error('non-fatal'));

    expect(mockScope.setLevel).toHaveBeenCalledWith('error');
  });

  it('does not set Sentry level to "fatal"', () => {
    reportError(new Error('non-fatal'));

    expect(mockScope.setLevel).not.toHaveBeenCalledWith('fatal');
  });

  it('tags the scope with the provided context as screen', () => {
    reportError(new Error('ctx error'), 'HomeScreen');

    expect(mockScope.setTag).toHaveBeenCalledWith('screen', 'HomeScreen');
  });

  it('does not set the screen tag when no context is given', () => {
    reportError(new Error('no ctx'));

    const screenCall = (mockScope.setTag as jest.Mock).mock.calls.find(
      ([key]: [string]) => key === 'screen',
    );
    expect(screenCall).toBeUndefined();
  });
});

describe('reportFatalError', () => {
  let mockScope: MockScope;

  beforeEach(() => {
    mockScope = makeMockScope();
    jest.clearAllMocks();
    (Sentry.withScope as jest.Mock).mockImplementation(
      (cb: (scope: MockScope) => void) => { cb(mockScope); },
    );
  });

  it('calls Sentry.captureException with the provided error', () => {
    const error = new Error('fatal boom');

    reportFatalError(error);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('sets Sentry level to "fatal"', () => {
    reportFatalError(new Error('critical'));

    expect(mockScope.setLevel).toHaveBeenCalledWith('fatal');
  });

  it('does not set Sentry level to "error"', () => {
    reportFatalError(new Error('critical'));

    expect(mockScope.setLevel).not.toHaveBeenCalledWith('error');
  });

  it('tags the scope with the provided context as screen', () => {
    reportFatalError(new Error('fatal ctx'), 'CrashScreen');

    expect(mockScope.setTag).toHaveBeenCalledWith('screen', 'CrashScreen');
  });

  it('does not set the screen tag when no context is given', () => {
    reportFatalError(new Error('no ctx'));

    const screenCall = (mockScope.setTag as jest.Mock).mock.calls.find(
      ([key]: [string]) => key === 'screen',
    );
    expect(screenCall).toBeUndefined();
  });

  it('attaches componentStack as an extra when provided', () => {
    reportFatalError(new Error('with stack'), 'SomeScreen', 'at Component\n  at App');

    expect(mockScope.setExtra).toHaveBeenCalledWith(
      'componentStack',
      'at Component\n  at App',
    );
  });

  it('does not call setExtra when componentStack is omitted', () => {
    reportFatalError(new Error('no component stack'));

    expect(mockScope.setExtra).not.toHaveBeenCalled();
  });

  it('sets a custom fingerprint when context is provided', () => {
    reportFatalError(new Error('fingerprint test'), 'PaymentScreen');

    expect(mockScope.setFingerprint).toHaveBeenCalledWith([
      '{{ default }}',
      'PaymentScreen',
    ]);
  });

  it('does not set a fingerprint when no context is given', () => {
    reportFatalError(new Error('no context fingerprint'));

    expect(mockScope.setFingerprint).not.toHaveBeenCalled();
  });
});

describe('logAppEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetDedupCache();
  });

  it('calls Sentry.addBreadcrumb with level "info"', () => {
    logAppEvent('user_signed_in');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
    const call = (Sentry.addBreadcrumb as jest.Mock).mock.calls[0][0];
    expect(call.level).toBe('info');
  });

  it('calls Sentry.addBreadcrumb with category "app.event"', () => {
    logAppEvent('page_viewed');

    const call = (Sentry.addBreadcrumb as jest.Mock).mock.calls[0][0];
    expect(call.category).toBe('app.event');
  });

  it('calls Sentry.addBreadcrumb with the provided message', () => {
    logAppEvent('button_tapped');

    const call = (Sentry.addBreadcrumb as jest.Mock).mock.calls[0][0];
    expect(call.message).toBe('button_tapped');
  });

  it('forwards optional attributes as breadcrumb data', () => {
    const attributes = { screen: 'HomeScreen', count: 3, visible: true };

    logAppEvent('item_loaded', attributes);

    const call = (Sentry.addBreadcrumb as jest.Mock).mock.calls[0][0];
    expect(call.data).toEqual(attributes);
  });

  it('sets breadcrumb data to undefined when no attributes are provided', () => {
    logAppEvent('app_opened');

    const call = (Sentry.addBreadcrumb as jest.Mock).mock.calls[0][0];
    expect(call.data).toBeUndefined();
  });
});

describe('logAppWarn', () => {
  let mockScope: MockScope;

  beforeEach(() => {
    mockScope = makeMockScope();
    jest.clearAllMocks();
    resetDedupCache();
    (Sentry.withScope as jest.Mock).mockImplementation(
      (cb: (scope: MockScope) => void) => { cb(mockScope); },
    );
  });

  it('calls Sentry.captureMessage with level "warning"', () => {
    logAppWarn('low disk space');

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    const [, level] = (Sentry.captureMessage as jest.Mock).mock.calls[0] as [string, string];
    expect(level).toBe('warning');
  });

  it('includes the message text in the captureMessage call', () => {
    logAppWarn('slow network detected');

    const [msg] = (Sentry.captureMessage as jest.Mock).mock.calls[0] as [string];
    expect(msg).toContain('slow network detected');
  });

  it('forwards optional attributes as scope extras', () => {
    const attributes = { latency: 500, retries: 2, cached: false };

    logAppWarn('request degraded', attributes);

    expect(mockScope.setExtra).toHaveBeenCalledWith('latency', 500);
    expect(mockScope.setExtra).toHaveBeenCalledWith('retries', 2);
    expect(mockScope.setExtra).toHaveBeenCalledWith('cached', false);
  });

  it('does not call setExtra when no attributes are provided', () => {
    logAppWarn('generic warning');

    expect(mockScope.setExtra).not.toHaveBeenCalled();
  });

  it('sets the alert_type tag to "app_warning"', () => {
    logAppWarn('config missing');

    expect(mockScope.setTag).toHaveBeenCalledWith('alert_type', 'app_warning');
  });
});

describe('setSentryUser / clearSentryUser — role propagation', () => {
  let mockScope: MockScope;

  beforeEach(() => {
    mockScope = makeMockScope();
    jest.clearAllMocks();
    clearSentryUser();
    (Sentry.configureScope as jest.Mock).mockImplementation(
      (cb: (scope: MockScope) => void) => { cb(mockScope); },
    );
  });

  it('sets isSuperAdmin tag to "false" for a regular user', () => {
    setSentryUser('u1', 'alice', false);

    expect(mockScope.setTag).toHaveBeenCalledWith('isSuperAdmin', 'false');
  });

  it('sets isSuperAdmin tag to "true" when user is promoted to super-admin', () => {
    setSentryUser('u1', 'alice', true);

    expect(mockScope.setTag).toHaveBeenCalledWith('isSuperAdmin', 'true');
  });

  it('reflects a mid-session role promotion: tag changes from "false" to "true"', () => {
    setSentryUser('u1', 'alice', false);
    jest.clearAllMocks();
    mockScope = makeMockScope();
    (Sentry.configureScope as jest.Mock).mockImplementation(
      (cb: (scope: MockScope) => void) => { cb(mockScope); },
    );

    setSentryUser('u1', 'alice', true);

    expect(mockScope.setTag).toHaveBeenCalledWith('isSuperAdmin', 'true');
    expect(mockScope.setTag).not.toHaveBeenCalledWith('isSuperAdmin', 'false');
  });

  it('calls Sentry.setUser with id and username', () => {
    setSentryUser('u42', 'bob', false);

    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'u42', username: 'bob' });
  });

  it('sets the isSuperAdmin tag to "false" when isSuperAdmin is omitted', () => {
    setSentryUser('user-3', 'unknown');

    expect(mockScope.setTag).toHaveBeenCalledWith('isSuperAdmin', 'false');
  });

  it('clearSentryUser resets isSuperAdmin tag to "false"', () => {
    setSentryUser('u1', 'alice', true);
    jest.clearAllMocks();
    mockScope = makeMockScope();
    (Sentry.configureScope as jest.Mock).mockImplementation(
      (cb: (scope: MockScope) => void) => { cb(mockScope); },
    );

    clearSentryUser();

    expect(mockScope.setTag).toHaveBeenCalledWith('isSuperAdmin', 'false');
  });

  it('clearSentryUser calls Sentry.setUser(null)', () => {
    clearSentryUser();

    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });
});

describe('buildReport — user identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Sentry.configureScope as jest.Mock).mockImplementation(() => {});
    clearSentryUser();
  });

  it('includes userId and username in the report after setSentryUser', () => {
    setSentryUser('u99', 'carol', false);

    const report = buildReport(new Error('oops'));

    expect(report.userId).toBe('u99');
    expect(report.username).toBe('carol');
  });

  it('omits userId and username when no user is set', () => {
    const report = buildReport(new Error('oops'));

    expect(report.userId).toBeUndefined();
    expect(report.username).toBeUndefined();
  });

  it('clears userId and username after clearSentryUser', () => {
    setSentryUser('u99', 'carol', false);
    clearSentryUser();

    const report = buildReport(new Error('oops'));

    expect(report.userId).toBeUndefined();
    expect(report.username).toBeUndefined();
  });
});

describe('setSentryUser', () => {
  let mockScope: MockScope;

  beforeEach(() => {
    mockScope = makeMockScope();
    jest.clearAllMocks();
    (Sentry.configureScope as jest.Mock).mockImplementation(
      (cb: (scope: MockScope) => void) => { cb(mockScope); },
    );
  });

  it('calls Sentry.setUser with the provided id and username', () => {
    setSentryUser('user-42', 'alice');

    expect(Sentry.setUser).toHaveBeenCalledTimes(1);
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user-42', username: 'alice' });
  });

  it('sets the isSuperAdmin tag to "true" when isSuperAdmin is true', () => {
    setSentryUser('user-1', 'admin', true);

    expect(mockScope.setTag).toHaveBeenCalledWith('isSuperAdmin', 'true');
  });

  it('sets the isSuperAdmin tag to "false" when isSuperAdmin is false', () => {
    setSentryUser('user-2', 'regular', false);

    expect(mockScope.setTag).toHaveBeenCalledWith('isSuperAdmin', 'false');
  });

  it('calls configureScope exactly once', () => {
    setSentryUser('user-4', 'bob', true);

    expect(Sentry.configureScope).toHaveBeenCalledTimes(1);
  });
});

describe('clearSentryUser', () => {
  let mockScope: MockScope;

  beforeEach(() => {
    mockScope = makeMockScope();
    jest.clearAllMocks();
    (Sentry.configureScope as jest.Mock).mockImplementation(
      (cb: (scope: MockScope) => void) => { cb(mockScope); },
    );
  });

  it('calls Sentry.setUser with null', () => {
    clearSentryUser();

    expect(Sentry.setUser).toHaveBeenCalledTimes(1);
    expect(Sentry.setUser).toHaveBeenCalledWith(null);
  });

  it('resets the isSuperAdmin tag to "false"', () => {
    clearSentryUser();

    expect(mockScope.setTag).toHaveBeenCalledWith('isSuperAdmin', 'false');
  });

  it('calls configureScope exactly once', () => {
    clearSentryUser();

    expect(Sentry.configureScope).toHaveBeenCalledTimes(1);
  });
});

describe('initSentry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not call Sentry.init when DSN is absent', () => {
    (Constants as { expoConfig: { extra: Record<string, unknown> } }).expoConfig.extra = {};

    initSentry();

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('calls Sentry.init with the configured DSN when present', () => {
    const testDsn = 'https://abc123@sentry.example.io/42';
    (Constants as { expoConfig: { extra: Record<string, unknown> } }).expoConfig.extra = {
      sentryDsn: testDsn,
    };

    initSentry();

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const initArg = (Sentry.init as jest.Mock).mock.calls[0][0] as { dsn: string };
    expect(initArg.dsn).toBe(testDsn);
  });

  it('adds an initialization breadcrumb after successful init', () => {
    const testDsn = 'https://abc123@sentry.example.io/42';
    (Constants as { expoConfig: { extra: Record<string, unknown> } }).expoConfig.extra = {
      sentryDsn: testDsn,
    };

    initSentry();

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Sentry initialized' }),
    );
  });

  it('does not add a breadcrumb when DSN is absent', () => {
    (Constants as { expoConfig: { extra: Record<string, unknown> } }).expoConfig.extra = {};

    initSentry();

    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
  });

  afterEach(() => {
    (Constants as { expoConfig: { extra: Record<string, unknown> } }).expoConfig.extra = {};
  });
});

type MockErrorUtils = {
  getGlobalHandler: jest.Mock;
  setGlobalHandler: jest.Mock;
};

type MockPromise = {
  _unhandledRejectionCallback?: (reason: unknown) => void;
};

describe('installGlobalHandlers', () => {
  let mockScope: MockScope;
  let originalErrorUtils: unknown;
  let originalRejectionCallback: ((reason: unknown) => void) | undefined;

  beforeEach(() => {
    mockScope = makeMockScope();
    jest.clearAllMocks();
    (Sentry.withScope as jest.Mock).mockImplementation(
      (cb: (scope: MockScope) => void) => { cb(mockScope); },
    );
    originalErrorUtils = (global as Record<string, unknown>).ErrorUtils;
    originalRejectionCallback = (Promise as unknown as MockPromise)._unhandledRejectionCallback;
  });

  afterEach(() => {
    (global as Record<string, unknown>).ErrorUtils = originalErrorUtils;
    (Promise as unknown as MockPromise)._unhandledRejectionCallback = originalRejectionCallback;
  });

  describe('ErrorUtils handler', () => {
    function setupErrorUtils(): {
      mockPreviousHandler: jest.Mock;
      mockErrorUtils: MockErrorUtils;
      getInstalledHandler: () => (error: Error, isFatal: boolean) => void;
    } {
      const mockPreviousHandler = jest.fn();
      let installedHandler: ((error: Error, isFatal: boolean) => void) | undefined;

      const mockErrorUtils: MockErrorUtils = {
        getGlobalHandler: jest.fn(() => mockPreviousHandler),
        setGlobalHandler: jest.fn((handler: (error: Error, isFatal: boolean) => void) => {
          installedHandler = handler;
        }),
      };

      (global as Record<string, unknown>).ErrorUtils = mockErrorUtils;
      installGlobalHandlers();

      return {
        mockPreviousHandler,
        mockErrorUtils,
        getInstalledHandler: () => {
          if (!installedHandler) throw new Error('handler was not installed');
          return installedHandler;
        },
      };
    }

    it('installs a new global handler via setGlobalHandler', () => {
      const { mockErrorUtils } = setupErrorUtils();

      expect(mockErrorUtils.setGlobalHandler).toHaveBeenCalledTimes(1);
    });

    it('reads the previous handler via getGlobalHandler before replacing it', () => {
      const { mockErrorUtils } = setupErrorUtils();

      expect(mockErrorUtils.getGlobalHandler).toHaveBeenCalledTimes(1);
    });

    it('calls reportFatalError (Sentry level "fatal") when isFatal is true', () => {
      const { getInstalledHandler } = setupErrorUtils();
      const error = new Error('fatal error');

      getInstalledHandler()(error, true);

      expect(mockScope.setLevel).toHaveBeenCalledWith('fatal');
      expect(mockScope.setLevel).not.toHaveBeenCalledWith('error');
    });

    it('calls reportError (Sentry level "error") when isFatal is false', () => {
      const { getInstalledHandler } = setupErrorUtils();
      const error = new Error('non-fatal error');

      getInstalledHandler()(error, false);

      expect(mockScope.setLevel).toHaveBeenCalledWith('error');
      expect(mockScope.setLevel).not.toHaveBeenCalledWith('fatal');
    });

    it('chains through to the previous handler when isFatal is true', () => {
      const { mockPreviousHandler, getInstalledHandler } = setupErrorUtils();
      const error = new Error('chain fatal');

      getInstalledHandler()(error, true);

      expect(mockPreviousHandler).toHaveBeenCalledTimes(1);
      expect(mockPreviousHandler).toHaveBeenCalledWith(error, true);
    });

    it('chains through to the previous handler when isFatal is false', () => {
      const { mockPreviousHandler, getInstalledHandler } = setupErrorUtils();
      const error = new Error('chain non-fatal');

      getInstalledHandler()(error, false);

      expect(mockPreviousHandler).toHaveBeenCalledTimes(1);
      expect(mockPreviousHandler).toHaveBeenCalledWith(error, false);
    });

    it('does not install a handler when ErrorUtils is absent from global', () => {
      delete (global as Record<string, unknown>).ErrorUtils;
      const mockPreviousHandler = jest.fn();

      expect(() => installGlobalHandlers()).not.toThrow();
      expect(mockPreviousHandler).not.toHaveBeenCalled();
    });
  });

  describe('unhandled Promise rejection callback', () => {
    it('installs a _unhandledRejectionCallback on Promise', () => {
      installGlobalHandlers();

      expect(
        (Promise as unknown as MockPromise)._unhandledRejectionCallback,
      ).toBeDefined();
    });

    it('calls reportError (Sentry level "error") when an Error is rejected', () => {
      installGlobalHandlers();
      const callback = (Promise as unknown as MockPromise)._unhandledRejectionCallback!;
      const error = new Error('rejected promise');

      callback(error);

      expect(mockScope.setLevel).toHaveBeenCalledWith('error');
    });

    it('wraps a non-Error rejection reason in an Error before reporting', () => {
      installGlobalHandlers();
      const callback = (Promise as unknown as MockPromise)._unhandledRejectionCallback!;

      callback('plain string reason');

      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
      const capturedArg = (Sentry.captureException as jest.Mock).mock.calls[0][0] as Error;
      expect(capturedArg).toBeInstanceOf(Error);
      expect(capturedArg.message).toBe('plain string reason');
    });

    it('chains through to the previous _unhandledRejectionCallback', () => {
      const mockPreviousRejectionHandler = jest.fn();
      (Promise as unknown as MockPromise)._unhandledRejectionCallback = mockPreviousRejectionHandler;

      installGlobalHandlers();
      const callback = (Promise as unknown as MockPromise)._unhandledRejectionCallback!;
      const reason = new Error('rejection chain');

      callback(reason);

      expect(mockPreviousRejectionHandler).toHaveBeenCalledTimes(1);
      expect(mockPreviousRejectionHandler).toHaveBeenCalledWith(reason);
    });

    it('does not throw when there is no previous _unhandledRejectionCallback', () => {
      delete (Promise as unknown as MockPromise)._unhandledRejectionCallback;

      installGlobalHandlers();
      const callback = (Promise as unknown as MockPromise)._unhandledRejectionCallback!;

      expect(() => callback(new Error('no previous handler'))).not.toThrow();
    });
  });
});

describe('deduplication guard — isDuplicate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetDedupCache();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns false on the first call for a key', () => {
    expect(isDuplicate('some-key')).toBe(false);
  });

  it('returns true when the same key is seen again within the dedup window', () => {
    isDuplicate('repeat-key');

    jest.advanceTimersByTime(DEDUP_WINDOW_MS - 1);

    expect(isDuplicate('repeat-key')).toBe(true);
  });

  it('returns false when the dedup window has fully elapsed', () => {
    isDuplicate('expired-key');

    jest.advanceTimersByTime(DEDUP_WINDOW_MS);

    expect(isDuplicate('expired-key')).toBe(false);
  });

  it('treats different keys as independent entries', () => {
    isDuplicate('key-a');

    expect(isDuplicate('key-b')).toBe(false);
  });

  it('resetDedupCache clears all tracked keys so they are no longer duplicates', () => {
    isDuplicate('cached-key');
    resetDedupCache();

    expect(isDuplicate('cached-key')).toBe(false);
  });

  it('exports DEDUP_WINDOW_MS as 500', () => {
    expect(DEDUP_WINDOW_MS).toBe(500);
  });

  it('evicts expired entries so the cache does not retain stale keys', () => {
    const staleKeys = ['stale-a', 'stale-b', 'stale-c'];
    staleKeys.forEach((k) => isDuplicate(k));

    expect(dedupCacheSize()).toBe(3);

    jest.advanceTimersByTime(DEDUP_WINDOW_MS);

    isDuplicate('trigger-sweep');

    expect(dedupCacheSize()).toBe(1);

    staleKeys.forEach((k) => {
      expect(isDuplicate(k)).toBe(false);
    });
  });

  it('keeps memory bounded: expired keys are removed, not just re-evaluated', () => {
    for (let i = 0; i < 100; i++) {
      isDuplicate(`unique-key-${i}`);
    }

    expect(dedupCacheSize()).toBe(100);

    jest.advanceTimersByTime(DEDUP_WINDOW_MS);

    isDuplicate('sweep-trigger');

    expect(dedupCacheSize()).toBe(1);

    expect(isDuplicate('fresh-key')).toBe(false);
    expect(isDuplicate('fresh-key')).toBe(true);
  });
});

describe('logAppWarn — deduplication guard', () => {
  let mockScope: MockScope;

  beforeEach(() => {
    mockScope = makeMockScope();
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetDedupCache();
    (Sentry.withScope as jest.Mock).mockImplementation(
      (cb: (scope: MockScope) => void) => { cb(mockScope); },
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends only the first of several identical warnings within the dedup window', () => {
    logAppWarn('network error');
    logAppWarn('network error');
    logAppWarn('network error');

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it('allows a second send after the dedup window expires', () => {
    logAppWarn('cache miss');
    jest.advanceTimersByTime(DEDUP_WINDOW_MS);
    jest.clearAllMocks();

    logAppWarn('cache miss');

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it('does not deduplicate distinct warning messages', () => {
    logAppWarn('warning-alpha');
    logAppWarn('warning-beta');

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(2);
  });

  it('bypasses dedup and always fires when bypass option is true', () => {
    logAppWarn('forced warning', undefined, { bypass: true });
    logAppWarn('forced warning', undefined, { bypass: true });
    logAppWarn('forced warning', undefined, { bypass: true });

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(3);
  });

  it('does not apply bypass when the option is false', () => {
    logAppWarn('guarded warning', undefined, { bypass: false });
    logAppWarn('guarded warning', undefined, { bypass: false });

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });
});

describe('logAppEvent — deduplication guard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    resetDedupCache();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends only the first of several identical events within the dedup window', () => {
    logAppEvent('screen_view');
    logAppEvent('screen_view');
    logAppEvent('screen_view');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
  });

  it('allows a second send after the dedup window expires', () => {
    logAppEvent('tap');
    jest.advanceTimersByTime(DEDUP_WINDOW_MS);
    jest.clearAllMocks();

    logAppEvent('tap');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
  });

  it('does not deduplicate distinct event messages', () => {
    logAppEvent('event-one');
    logAppEvent('event-two');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(2);
  });

  it('bypasses dedup and always fires when bypass option is true', () => {
    logAppEvent('forced-event', undefined, { bypass: true });
    logAppEvent('forced-event', undefined, { bypass: true });

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(2);
  });

  it('does not deduplicate events separately from warnings with the same text', () => {
    logAppEvent('shared-key');
    logAppWarn('shared-key');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });
});

describe('measureScreenLoad', () => {
  type MockCurrentScope = { setTag: jest.Mock };

  let mockCurrentScope: MockCurrentScope;

  beforeEach(() => {
    mockCurrentScope = { setTag: jest.fn() };
    jest.resetAllMocks();
    (Sentry.getCurrentScope as jest.Mock).mockReturnValue(mockCurrentScope);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves with the value returned by work', async () => {
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(null);

    const result = await measureScreenLoad('HomeScreen', async () => 42);

    expect(result).toBe(42);
  });

  it('does not call finish() on the root navigation span returned by getActiveSpan', async () => {
    const rootSpan = { finish: jest.fn(), end: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn() };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);

    await measureScreenLoad('LoginScreen', async () => 'data');

    expect(rootSpan.finish).not.toHaveBeenCalled();
    expect(rootSpan.end).not.toHaveBeenCalled();
  });

  it('creates a child span via startInactiveSpan with correct name and op', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn() };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);

    await measureScreenLoad('LoginScreen', async () => 'data');

    expect(Sentry.startInactiveSpan).toHaveBeenCalledTimes(1);
    expect(Sentry.startInactiveSpan).toHaveBeenCalledWith({
      name: 'screen_load.LoginScreen',
      op: 'ui.load',
    });
  });

  it('calls setMeasurement and setTag on the child span, then ends it', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn() };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);

    await measureScreenLoad('LoginScreen', async () => 'data');

    expect(Sentry.setMeasurement).toHaveBeenCalledTimes(1);
    expect(Sentry.setMeasurement).toHaveBeenCalledWith(
      'screen_load_ms',
      expect.any(Number),
      'millisecond',
    );
    expect(mockCurrentScope.setTag).toHaveBeenCalledTimes(1);
    expect(mockCurrentScope.setTag).toHaveBeenCalledWith('screen', 'LoginScreen');
    expect(childSpan.end).toHaveBeenCalledTimes(1);
  });

  it('uses finish() as a fallback when end() is absent on the child span', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { finish: jest.fn() };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);

    await measureScreenLoad('FallbackScreen', async () => 'ok');

    expect(childSpan.finish).toHaveBeenCalledTimes(1);
  });

  it('skips instrumentation silently when no active span exists', async () => {
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(null);

    await measureScreenLoad('ProfileScreen', async () => 'ok');

    expect(Sentry.startInactiveSpan).not.toHaveBeenCalled();
    expect(Sentry.setMeasurement).not.toHaveBeenCalled();
    expect(mockCurrentScope.setTag).not.toHaveBeenCalled();
  });

  it('skips instrumentation when active span appears mid-work but was absent at start', async () => {
    // getActiveSpan returns null at function entry (snapshot taken before work);
    // even if a span becomes active during work, the start-time snapshot is
    // false so measurements are not recorded.  This documents the intentional
    // timing assumption: the navigation transaction must already be active when
    // measureScreenLoad is called, not created asynchronously during work.
    (Sentry.getActiveSpan as jest.Mock).mockReturnValueOnce(null);
    const lateSpan = { end: jest.fn() };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(lateSpan);

    await measureScreenLoad('LateSpanScreen', async () => {
      (Sentry.getActiveSpan as jest.Mock).mockReturnValue(lateSpan);
      return 'ok';
    });

    expect(Sentry.startInactiveSpan).not.toHaveBeenCalled();
    expect(Sentry.setMeasurement).not.toHaveBeenCalled();
    expect(mockCurrentScope.setTag).not.toHaveBeenCalled();
    expect(lateSpan.end).not.toHaveBeenCalled();
  });

  it('still records measurement and tag when startInactiveSpan returns falsy (older SDK fallback)', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(undefined);

    await measureScreenLoad('FallbackScreen', async () => 'ok');

    expect(Sentry.setMeasurement).toHaveBeenCalledTimes(1);
    expect(Sentry.setMeasurement).toHaveBeenCalledWith('screen_load_ms', expect.any(Number), 'millisecond');
    expect(mockCurrentScope.setTag).toHaveBeenCalledTimes(1);
    expect(mockCurrentScope.setTag).toHaveBeenCalledWith('screen', 'FallbackScreen');
    expect(rootSpan.finish).not.toHaveBeenCalled();
  });

  it('propagates exceptions from work and still ends the child span', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn() };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);
    const boom = new Error('load failed');

    await expect(
      measureScreenLoad('ErrorScreen', async () => { throw boom; }),
    ).rejects.toThrow(boom);

    expect(rootSpan.finish).not.toHaveBeenCalled();
    expect(Sentry.setMeasurement).toHaveBeenCalledTimes(1);
    expect(Sentry.setMeasurement).toHaveBeenCalledWith(
      'screen_load_ms',
      expect.any(Number),
      'millisecond',
    );
    expect(mockCurrentScope.setTag).toHaveBeenCalledTimes(1);
    expect(mockCurrentScope.setTag).toHaveBeenCalledWith('screen', 'ErrorScreen');
    expect(childSpan.end).toHaveBeenCalledTimes(1);
  });

  it('always calls the work callback regardless of span state', async () => {
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(null);
    const work = jest.fn().mockResolvedValue('result');

    await measureScreenLoad('AnyScreen', work);

    expect(work).toHaveBeenCalledTimes(1);
  });

  it('still returns work result when getActiveSpan throws', async () => {
    (Sentry.getActiveSpan as jest.Mock).mockImplementation(() => {
      throw new Error('span error');
    });

    const result = await measureScreenLoad('HomeScreen', async () => 'safe');

    expect(result).toBe('safe');
  });

  it('still returns work result when setMeasurement throws', async () => {
    const fakeSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(fakeSpan);
    (Sentry.setMeasurement as jest.Mock).mockImplementation(() => {
      throw new Error('measurement error');
    });

    const result = await measureScreenLoad('HomeScreen', async () => 99);

    expect(result).toBe(99);
  });

  it('does not throw when getActiveSpan throws', async () => {
    (Sentry.getActiveSpan as jest.Mock).mockImplementation(() => {
      throw new Error('instrumentation failure');
    });

    await expect(
      measureScreenLoad('SafeScreen', async () => 'value'),
    ).resolves.toBe('value');
  });

  it('does not throw when setMeasurement throws', async () => {
    const fakeSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(fakeSpan);
    (Sentry.setMeasurement as jest.Mock).mockImplementation(() => {
      throw new Error('measurement boom');
    });

    await expect(
      measureScreenLoad('SafeScreen', async () => 'value'),
    ).resolves.toBe('value');
  });

  it('does not call end() when isRecording() returns false (span expired mid-load)', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(false) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await measureScreenLoad('ExpiredScreen', async () => 'ok');

    expect(childSpan.end).not.toHaveBeenCalled();
  });

  it('does not call finish() when isRecording() returns false (span expired mid-load)', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { finish: jest.fn(), isRecording: jest.fn().mockReturnValue(false) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await measureScreenLoad('ExpiredScreen', async () => 'ok');

    expect(childSpan.finish).not.toHaveBeenCalled();
  });

  it('emits console.warn when the child span has already ended (isRecording() === false)', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(false) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await measureScreenLoad('ExpiredScreen', async () => 'ok');

    // Two warnings are expected: one pre-work (span timed out before work) and
    // one post-work (span already ended before finish).
    expect(warnSpy).toHaveBeenCalledTimes(2);
    const warnMessages = warnSpy.mock.calls.map(([msg]: [string]) => msg);
    expect(warnMessages.some((m) => m.includes('ExpiredScreen') && m.includes('already ended'))).toBe(true);
  });

  it('adds a Sentry breadcrumb with level warning when isRecording() returns false', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(false) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await measureScreenLoad('ExpiredScreen', async () => 'ok');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        category: 'performance',
        message: expect.stringContaining('ExpiredScreen'),
      }),
    );
  });

  it('still records the measurement even when the child span has already ended', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(false) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await measureScreenLoad('ExpiredScreen', async () => 'ok');

    expect(Sentry.setMeasurement).toHaveBeenCalledWith(
      'screen_load_ms',
      expect.any(Number),
      'millisecond',
    );
  });

  it('calls end() normally when isRecording() returns true', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(true) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);

    await measureScreenLoad('ActiveScreen', async () => 'ok');

    expect(childSpan.end).toHaveBeenCalledTimes(1);
  });

  it('calls end() normally when isRecording is absent (older SDK, no guard needed)', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn() };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);

    await measureScreenLoad('OldSdkScreen', async () => 'ok');

    expect(childSpan.end).toHaveBeenCalledTimes(1);
  });

  it('emits console.warn when span is already ended before work begins (pre-work expiry)', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(false) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await measureScreenLoad('PreWorkExpiredScreen', async () => 'ok');

    const preWorkWarn = warnSpy.mock.calls.find(
      ([msg]: [string]) => typeof msg === 'string' && msg.includes('before work began'),
    );
    expect(preWorkWarn).toBeDefined();
    expect(preWorkWarn![0]).toContain('PreWorkExpiredScreen');
  });

  it('adds a Sentry breadcrumb when span is already ended before work begins (pre-work expiry)', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(false) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await measureScreenLoad('PreWorkExpiredScreen', async () => 'ok');

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warning',
        category: 'performance',
        message: expect.stringContaining('before work began'),
      }),
    );
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('PreWorkExpiredScreen'),
      }),
    );
  });

  it('does not emit pre-work warning when span is still recording before work begins', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(true) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await measureScreenLoad('ActivePreWorkScreen', async () => 'ok');

    const preWorkWarn = warnSpy.mock.calls.find(
      ([msg]: [string]) => typeof msg === 'string' && msg.includes('before work began'),
    );
    expect(preWorkWarn).toBeUndefined();
  });

  it('does not emit pre-work warning when isRecording is absent on the span (older SDK)', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn() };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await measureScreenLoad('OldSdkPreWorkScreen', async () => 'ok');

    const preWorkWarn = warnSpy.mock.calls.find(
      ([msg]: [string]) => typeof msg === 'string' && msg.includes('before work began'),
    );
    expect(preWorkWarn).toBeUndefined();
  });

  it('still executes work and returns result when span is already ended before work begins', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(false) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await measureScreenLoad('PreWorkExpiredScreen', async () => 'still-runs');

    expect(result).toBe('still-runs');
  });
});

describe('recordSpanExpiry', () => {
  beforeEach(() => {
    clearSpanExpiryEvents();
  });

  it('stores a single event in the buffer', () => {
    recordSpanExpiry('HomeScreen', 'pre-work');

    const events = getSpanExpiryEvents();
    expect(events).toHaveLength(1);
    expect(events[0].screenName).toBe('HomeScreen');
    expect(events[0].phase).toBe('pre-work');
  });

  it('stores the correct screenName and phase for post-work events', () => {
    recordSpanExpiry('SettingsScreen', 'post-work');

    const events = getSpanExpiryEvents();
    expect(events[0].screenName).toBe('SettingsScreen');
    expect(events[0].phase).toBe('post-work');
  });

  it('records a timestamp in ISO 8601 format', () => {
    recordSpanExpiry('ProfileScreen', 'pre-work');

    const events = getSpanExpiryEvents();
    expect(events[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('accumulates multiple events up to the buffer limit', () => {
    for (let i = 0; i < 10; i++) {
      recordSpanExpiry(`Screen${i}`, 'pre-work');
    }

    expect(getSpanExpiryEvents()).toHaveLength(10);
  });

  it('evicts the oldest event when the buffer exceeds 50 entries', () => {
    for (let i = 0; i < 50; i++) {
      recordSpanExpiry(`Screen${i}`, 'pre-work');
    }
    recordSpanExpiry('NewestScreen', 'post-work');

    const events = getSpanExpiryEvents();
    expect(events).toHaveLength(50);
    const screenNames = events.map((e) => e.screenName);
    expect(screenNames).toContain('NewestScreen');
    expect(screenNames).not.toContain('Screen0');
  });

  it('keeps the correct 50 entries after multiple overflows', () => {
    for (let i = 0; i < 60; i++) {
      recordSpanExpiry(`Screen${i}`, 'pre-work');
    }

    const events = getSpanExpiryEvents();
    expect(events).toHaveLength(50);
    const screenNames = events.map((e) => e.screenName);
    expect(screenNames).not.toContain('Screen0');
    expect(screenNames).not.toContain('Screen9');
    expect(screenNames).toContain('Screen59');
    expect(screenNames).toContain('Screen10');
  });
});

describe('getSpanExpiryEvents', () => {
  beforeEach(() => {
    clearSpanExpiryEvents();
  });

  it('returns an empty array when the buffer is empty', () => {
    expect(getSpanExpiryEvents()).toEqual([]);
  });

  it('returns events in newest-first order', () => {
    recordSpanExpiry('First', 'pre-work');
    recordSpanExpiry('Second', 'post-work');
    recordSpanExpiry('Third', 'pre-work');

    const events = getSpanExpiryEvents();
    expect(events[0].screenName).toBe('Third');
    expect(events[1].screenName).toBe('Second');
    expect(events[2].screenName).toBe('First');
  });

  it('returns a copy — mutations do not affect the internal buffer', () => {
    recordSpanExpiry('Screen', 'pre-work');

    const copy = getSpanExpiryEvents();
    copy.length = 0;

    expect(getSpanExpiryEvents()).toHaveLength(1);
  });

  it('returns a copy — pushes to the returned array do not affect the buffer', () => {
    recordSpanExpiry('Screen', 'pre-work');

    const copy = getSpanExpiryEvents();
    copy.push({ screenName: 'Injected', phase: 'post-work', timestamp: new Date().toISOString() });

    expect(getSpanExpiryEvents()).toHaveLength(1);
  });
});

describe('clearSpanExpiryEvents', () => {
  beforeEach(() => {
    clearSpanExpiryEvents();
  });

  it('empties the buffer when events are present', () => {
    recordSpanExpiry('Screen', 'pre-work');
    recordSpanExpiry('Screen', 'post-work');

    clearSpanExpiryEvents();

    expect(getSpanExpiryEvents()).toEqual([]);
  });

  it('is a no-op on an already empty buffer', () => {
    expect(() => clearSpanExpiryEvents()).not.toThrow();
    expect(getSpanExpiryEvents()).toEqual([]);
  });

  it('allows new events to be recorded after clearing', () => {
    recordSpanExpiry('OldScreen', 'pre-work');
    clearSpanExpiryEvents();
    recordSpanExpiry('NewScreen', 'post-work');

    const events = getSpanExpiryEvents();
    expect(events).toHaveLength(1);
    expect(events[0].screenName).toBe('NewScreen');
  });
});

describe('measureScreenLoad — ring buffer integration', () => {
  type MockCurrentScope = { setTag: jest.Mock };
  let mockCurrentScope: MockCurrentScope;

  beforeEach(() => {
    mockCurrentScope = { setTag: jest.fn() };
    jest.resetAllMocks();
    (Sentry.getCurrentScope as jest.Mock).mockReturnValue(mockCurrentScope);
    clearSpanExpiryEvents();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearSpanExpiryEvents();
  });

  it('records a pre-work ring buffer entry when the child span is already expired before work', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(false) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);

    await measureScreenLoad('RingPreWorkScreen', async () => 'ok');

    const events = getSpanExpiryEvents();
    const preWork = events.find((e) => e.phase === 'pre-work');
    expect(preWork).toBeDefined();
    expect(preWork!.screenName).toBe('RingPreWorkScreen');
  });

  it('records a post-work ring buffer entry when the child span is expired after work', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(false) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);

    await measureScreenLoad('RingPostWorkScreen', async () => 'ok');

    const events = getSpanExpiryEvents();
    const postWork = events.find((e) => e.phase === 'post-work');
    expect(postWork).toBeDefined();
    expect(postWork!.screenName).toBe('RingPostWorkScreen');
  });

  it('records both pre-work and post-work entries for an expired span', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(false) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);

    await measureScreenLoad('BothPhasesScreen', async () => 'ok');

    const events = getSpanExpiryEvents();
    const phases = events.map((e) => e.phase);
    expect(phases).toContain('pre-work');
    expect(phases).toContain('post-work');
  });

  it('does not record any ring buffer entry when the child span is still recording', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(true) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);

    await measureScreenLoad('ActiveScreen', async () => 'ok');

    expect(getSpanExpiryEvents()).toHaveLength(0);
  });

  it('does not record any ring buffer entry when no active span exists', async () => {
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(null);

    await measureScreenLoad('NoSpanScreen', async () => 'ok');

    expect(getSpanExpiryEvents()).toHaveLength(0);
  });

  it('records the correct screenName on both entries', async () => {
    const rootSpan = { finish: jest.fn() };
    (Sentry.getActiveSpan as jest.Mock).mockReturnValue(rootSpan);
    const childSpan = { end: jest.fn(), isRecording: jest.fn().mockReturnValue(false) };
    (Sentry.startInactiveSpan as jest.Mock).mockReturnValue(childSpan);

    await measureScreenLoad('TargetScreen', async () => 'ok');

    const events = getSpanExpiryEvents();
    events.forEach((e) => {
      expect(e.screenName).toBe('TargetScreen');
    });
  });
});

describe('withBackgroundTask', () => {
  const mockWithScope = Sentry.withScope as jest.Mock;
  const mockCaptureException = Sentry.captureException as jest.Mock;

  function makeFakeScope() {
    return { setTag: jest.fn(), setLevel: jest.fn() };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockWithScope.mockImplementation((cb: (s: ReturnType<typeof makeFakeScope>) => void) => {
      cb(makeFakeScope());
    });
  });

  it('returns the resolved value when the task succeeds', async () => {
    const result = await withBackgroundTask('test.success', async () => 42);
    expect(result).toBe(42);
  });

  it('returns undefined when the task throws', async () => {
    const result = await withBackgroundTask('test.fail', async () => {
      throw new Error('boom');
    });
    expect(result).toBeUndefined();
  });

  it('calls captureException with the thrown Error inside withScope', async () => {
    const boom = new Error('background boom');
    let captureCalledInsideScope = false;

    mockWithScope.mockImplementationOnce((cb: (s: ReturnType<typeof makeFakeScope>) => void) => {
      const scope = makeFakeScope();
      cb(scope);
      captureCalledInsideScope = mockCaptureException.mock.calls.length > 0;
    });

    await withBackgroundTask('test.capture', async () => {
      throw boom;
    });

    expect(captureCalledInsideScope).toBe(true);
    expect(mockCaptureException).toHaveBeenCalledWith(boom);
  });

  it('normalizes a non-Error throw to an Error before reporting', async () => {
    await withBackgroundTask('test.string-throw', async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw 'plain string error';
    });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const capturedArg = mockCaptureException.mock.calls[0][0] as Error;
    expect(capturedArg).toBeInstanceOf(Error);
    expect(capturedArg.message).toBe('plain string error');
  });

  it('sets background_task tag and captures exception in the same withScope call', async () => {
    const taskName = 'AppState.handleChange';
    let scopeAtCapture: ReturnType<typeof makeFakeScope> | null = null;
    let capturedError: Error | null = null;

    mockWithScope.mockImplementationOnce((cb: (s: ReturnType<typeof makeFakeScope>) => void) => {
      const scope = makeFakeScope();
      mockCaptureException.mockImplementationOnce((e: Error) => {
        capturedError = e;
        scopeAtCapture = scope;
      });
      cb(scope);
    });

    const thrown = new Error('tagged error');
    await withBackgroundTask(taskName, async () => {
      throw thrown;
    });

    expect(scopeAtCapture).not.toBeNull();
    expect((scopeAtCapture!.setTag as jest.Mock)).toHaveBeenCalledWith('background_task', taskName);
    expect(capturedError).toBe(thrown);
  });

  it('does not swallow a task that resolves with undefined', async () => {
    const result = await withBackgroundTask('test.void', async () => undefined);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Offline queue helpers
// ---------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';

function makeSampleReport(): import('../crashReporter').CrashReport {
  return {
    message: 'Test error',
    platform: 'ios',
    timestamp: new Date().toISOString(),
    isFatal: false,
    appVersion: '1.0.0',
  };
}

describe('queueReport', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('writes a serialised QueuedReport array to AsyncStorage', async () => {
    const report = makeSampleReport();

    await queueReport(report);

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const [key, raw] = (AsyncStorage.setItem as jest.Mock).mock.calls[0] as [string, string];
    expect(key).toBe(OFFLINE_QUEUE_STORAGE_KEY);
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].report).toEqual(report);
  });

  it('assigns a unique id and queuedAt timestamp to each entry', async () => {
    await queueReport(makeSampleReport());

    const [, raw] = (AsyncStorage.setItem as jest.Mock).mock.calls[0] as [string, string];
    const [entry] = JSON.parse(raw);
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);
    expect(entry.queuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('appends to an existing queue rather than replacing it', async () => {
    const existing = [{ id: 'old-1', report: makeSampleReport(), queuedAt: new Date().toISOString() }];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existing));

    await queueReport(makeSampleReport());

    const [, raw] = (AsyncStorage.setItem as jest.Mock).mock.calls[0] as [string, string];
    expect(JSON.parse(raw)).toHaveLength(2);
  });

  it('enforces the OFFLINE_QUEUE_MAX_SIZE cap by evicting the oldest entry', async () => {
    const fullQueue = Array.from({ length: OFFLINE_QUEUE_MAX_SIZE }, (_, i) => ({
      id: `id-${i}`,
      report: { ...makeSampleReport(), message: `msg-${i}` },
      queuedAt: new Date().toISOString(),
    }));
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(fullQueue));

    await queueReport({ ...makeSampleReport(), message: 'newest' });

    const [, raw] = (AsyncStorage.setItem as jest.Mock).mock.calls[0] as [string, string];
    const saved = JSON.parse(raw);
    expect(saved).toHaveLength(OFFLINE_QUEUE_MAX_SIZE);
    expect(saved[saved.length - 1].report.message).toBe('newest');
    expect(saved[0].id).toBe('id-1');
  });

  it('does not throw when AsyncStorage.getItem rejects', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('storage failure'));

    await expect(queueReport(makeSampleReport())).resolves.toBeUndefined();
  });

  it('does not throw when AsyncStorage.setItem rejects', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('write failure'));

    await expect(queueReport(makeSampleReport())).resolves.toBeUndefined();
  });
});

describe('sendToServer', () => {
  const TEST_URL = 'https://crash.example.com/reports';
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete global.fetch;
  });

  it('POSTs to the provided URL with JSON content-type', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const report = makeSampleReport();

    await sendToServer(report, TEST_URL);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TEST_URL);
    expect(options.method).toBe('POST');
    expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('sends the report as JSON in the request body', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const report = makeSampleReport();

    await sendToServer(report, TEST_URL);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual(report);
  });

  it('does not queue the report when the server responds with 2xx', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await sendToServer(makeSampleReport(), TEST_URL);

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('queues the report when fetch throws (network offline)', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));

    await sendToServer(makeSampleReport(), TEST_URL);

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const [key] = (AsyncStorage.setItem as jest.Mock).mock.calls[0] as [string, string];
    expect(key).toBe(OFFLINE_QUEUE_STORAGE_KEY);
  });

  it('queues the report when the server returns a non-2xx status', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    await sendToServer(makeSampleReport(), TEST_URL);

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('does not throw when both fetch and queueReport fail', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('storage dead'));

    await expect(sendToServer(makeSampleReport(), TEST_URL)).resolves.toBeUndefined();
  });
});

describe('flushOfflineQueue', () => {
  const FLUSH_URL = 'https://crash.example.com/reports';
  let mockFetch: jest.Mock;

  function makeQueuedReport(msgSuffix: string) {
    return {
      id: `id-${msgSuffix}`,
      report: { ...makeSampleReport(), message: `msg-${msgSuffix}` },
      queuedAt: new Date().toISOString(),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete global.fetch;
  });

  it('does nothing when the queue is empty', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    await flushOfflineQueue(FLUSH_URL);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('POSTs each queued report to the server URL', async () => {
    const queue = [makeQueuedReport('a'), makeQueuedReport('b')];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));
    mockFetch.mockResolvedValue({ ok: true });

    await flushOfflineQueue(FLUSH_URL);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('removes all reports from the queue when all sends succeed', async () => {
    const queue = [makeQueuedReport('1'), makeQueuedReport('2')];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));
    mockFetch.mockResolvedValue({ ok: true });

    await flushOfflineQueue(FLUSH_URL);

    const [, raw] = (AsyncStorage.setItem as jest.Mock).mock.calls[
      (AsyncStorage.setItem as jest.Mock).mock.calls.length - 1
    ] as [string, string];
    expect(JSON.parse(raw)).toHaveLength(0);
  });

  it('retains all reports when the first send fails and stops retrying', async () => {
    const queue = [makeQueuedReport('x'), makeQueuedReport('y')];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));
    mockFetch.mockRejectedValue(new Error('offline'));

    await flushOfflineQueue(FLUSH_URL);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const queueCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
      ([key]: [string]) => key === OFFLINE_QUEUE_STORAGE_KEY,
    ) as [string, string];
    expect(JSON.parse(queueCall[1])).toHaveLength(2);
  });

  it('delivers reports in insertion order (oldest first)', async () => {
    const queue = [makeQueuedReport('first'), makeQueuedReport('second')];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));
    mockFetch.mockResolvedValue({ ok: true });

    await flushOfflineQueue(FLUSH_URL);

    const bodies = (mockFetch as jest.Mock).mock.calls.map(
      ([, opts]: [string, RequestInit]) => (JSON.parse(opts.body as string) as { message: string }).message,
    );
    expect(bodies[0]).toBe('msg-first');
    expect(bodies[1]).toBe('msg-second');
  });

  it('delivers the first report and retains only the failing second', async () => {
    const queue = [makeQueuedReport('ok'), makeQueuedReport('fail')];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));
    mockFetch
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('offline'));

    await flushOfflineQueue(FLUSH_URL);

    const queueCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
      ([key]: [string]) => key === OFFLINE_QUEUE_STORAGE_KEY,
    ) as [string, string];
    const remaining = JSON.parse(queueCall[1]);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].report.message).toBe('msg-fail');
  });

  it('does not throw when AsyncStorage read fails', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('read error'));

    await expect(flushOfflineQueue(FLUSH_URL)).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw when AsyncStorage write fails after successful sends', async () => {
    const queue = [makeQueuedReport('a')];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));
    mockFetch.mockResolvedValue({ ok: true });
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('write error'));

    await expect(flushOfflineQueue(FLUSH_URL)).resolves.toBeUndefined();
  });
});

describe('initOfflineRetry', () => {
  const SERVER_URL = 'https://crash.example.com/reports';
  let mockFetch: jest.Mock;
  let mockRemove: jest.Mock;
  let mockNetInfoUnsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRemove = jest.fn();
    mockNetInfoUnsubscribe = jest.fn();
    mockAddEventListener.mockReturnValue({ remove: mockRemove });
    mockNetInfoAddEventListener.mockReturnValue(mockNetInfoUnsubscribe);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // Cleanup: remove any lingering listeners.
    initOfflineRetry(null);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete global.fetch;
  });

  it('registers a NetInfo connectivity listener', () => {
    initOfflineRetry(SERVER_URL);

    expect(mockNetInfoAddEventListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('registers an AppState "change" listener as a supplemental trigger', () => {
    initOfflineRetry(SERVER_URL);

    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('does not register any listeners when serverUrl is null', () => {
    initOfflineRetry(null);

    expect(mockNetInfoAddEventListener).not.toHaveBeenCalled();
    expect(mockAddEventListener).not.toHaveBeenCalled();
  });

  it('unsubscribes the previous NetInfo listener before registering a new one', () => {
    initOfflineRetry(SERVER_URL);
    const firstUnsubscribe = mockNetInfoUnsubscribe;

    initOfflineRetry(SERVER_URL);

    expect(firstUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('removes the previous AppState listener before registering a new one', () => {
    initOfflineRetry(SERVER_URL);
    const firstRemove = mockRemove;

    initOfflineRetry(SERVER_URL);

    expect(firstRemove).toHaveBeenCalledTimes(1);
  });

  it('flushes the queue when NetInfo reports internet reachable (false → true transition)', async () => {
    const queue = [{ id: 'q1', report: makeSampleReport(), queuedAt: new Date().toISOString() }];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));

    initOfflineRetry(SERVER_URL);

    // Simulate NetInfo: not reachable, then reachable.
    const [netInfoHandler] = mockNetInfoAddEventListener.mock.calls[0] as [(state: object) => void];
    netInfoHandler({ isInternetReachable: false });
    await new Promise(setImmediate);
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));
    mockFetch.mockResolvedValue({ ok: true });

    netInfoHandler({ isInternetReachable: true });
    await new Promise(setImmediate);

    expect(mockFetch).toHaveBeenCalled();
  });

  it('does not flush again when NetInfo remains reachable (true → true, no new transition)', async () => {
    const queue = [{ id: 'q2', report: makeSampleReport(), queuedAt: new Date().toISOString() }];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));
    mockFetch.mockResolvedValue({ ok: true });

    initOfflineRetry(SERVER_URL);

    const [netInfoHandler] = mockNetInfoAddEventListener.mock.calls[0] as [(state: object) => void];

    // First transition: null → true (initial state unknown → reachable).
    netInfoHandler({ isInternetReachable: true });
    await new Promise(setImmediate);
    const firstCallCount = mockFetch.mock.calls.length;

    // Still reachable: should not trigger another flush.
    netInfoHandler({ isInternetReachable: true });
    await new Promise(setImmediate);

    expect(mockFetch.mock.calls.length).toBe(firstCallCount);
  });

  it('flushes the queue when the AppState transitions to "active"', async () => {
    const queue = [{ id: 'q3', report: makeSampleReport(), queuedAt: new Date().toISOString() }];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));
    mockFetch.mockResolvedValue({ ok: true });

    initOfflineRetry(SERVER_URL);

    // Capture the AppState handler before clearing mocks.
    const [, appStateHandler] = mockAddEventListener.mock.calls[0] as [string, (state: string) => void];

    // Clear any calls from the initial flush.
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));
    mockFetch.mockResolvedValue({ ok: true });

    appStateHandler('active');
    await new Promise(setImmediate);

    expect(mockFetch).toHaveBeenCalled();
  });

  it('does not flush when AppState transitions to "background"', async () => {
    initOfflineRetry(SERVER_URL);

    // Capture the AppState handler before clearing mocks.
    const [, appStateHandler] = mockAddEventListener.mock.calls[0] as [string, (state: string) => void];

    jest.clearAllMocks();

    appStateHandler('background');
    await new Promise(setImmediate);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('end-to-end: reportError offline → queue persisted → connectivity restored → flushed', () => {
  const SERVER_URL = 'https://crash.example.com/reports';
  let mockFetch: jest.Mock;
  let mockRemove: jest.Mock;
  let mockNetInfoUnsubscribe: jest.Mock;
  let storedQueue: string | null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRemove = jest.fn();
    mockNetInfoUnsubscribe = jest.fn();
    mockAddEventListener.mockReturnValue({ remove: mockRemove });
    mockNetInfoAddEventListener.mockReturnValue(mockNetInfoUnsubscribe);

    // Simulate a real AsyncStorage that accumulates state.
    storedQueue = null;
    (AsyncStorage.getItem as jest.Mock).mockImplementation(() =>
      Promise.resolve(storedQueue),
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation((_key: string, value: string) => {
      storedQueue = value;
      return Promise.resolve(undefined);
    });
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(() => {
      storedQueue = null;
      return Promise.resolve(undefined);
    });

    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Provide a full mock scope so reportError / reportFatalError don't throw.
    (Sentry.withScope as jest.Mock).mockImplementation(
      (cb: (scope: ReturnType<typeof makeMockScope>) => void) => { cb(makeMockScope()); },
    );

    // Wire up offline retry (as App.tsx does at startup).
    initOfflineRetry(SERVER_URL);
  });

  afterEach(() => {
    initOfflineRetry(null);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete global.fetch;
  });

  it('queues a report from reportError when the server is offline, then delivers it on NetInfo reconnect', async () => {
    // Step 1: device is offline — sendToServer should queue.
    mockFetch.mockRejectedValue(new Error('Network request failed'));

    reportError(new Error('offline error'), 'TestScreen');

    // Allow the async sendToServer → queueReport chain to settle.
    await new Promise(setImmediate);
    await new Promise(setImmediate);

    // The queue should contain exactly one entry.
    const queueAfterOffline = JSON.parse(storedQueue ?? '[]');
    expect(queueAfterOffline).toHaveLength(1);
    expect(queueAfterOffline[0].report.message).toBe('offline error');

    // Step 2: connectivity restored — NetInfo fires isInternetReachable = true.
    mockFetch.mockResolvedValue({ ok: true });

    const [netInfoHandler] = mockNetInfoAddEventListener.mock.calls[0] as [(s: object) => void];
    // Simulate transition: offline (false) → online (true)
    netInfoHandler({ isInternetReachable: false });
    await new Promise(setImmediate);
    netInfoHandler({ isInternetReachable: true });

    // Allow the flush to complete (multiple micro-tasks due to chain).
    await new Promise(setImmediate);
    await new Promise(setImmediate);
    await new Promise(setImmediate);

    // The report should have been POSTed.
    const postCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === SERVER_URL,
    );
    expect(postCalls.length).toBeGreaterThan(0);

    // The queue should now be empty.
    const queueAfterFlush = JSON.parse(storedQueue ?? '[]');
    expect(queueAfterFlush).toHaveLength(0);
  });

  it('queues a report from reportFatalError when offline, then delivers on AppState foreground', async () => {
    // Step 1: offline.
    mockFetch.mockRejectedValue(new Error('offline'));

    reportFatalError(new Error('fatal offline'), 'CrashScreen');

    await new Promise(setImmediate);
    await new Promise(setImmediate);

    const queuedBefore = JSON.parse(storedQueue ?? '[]');
    expect(queuedBefore).toHaveLength(1);
    expect(queuedBefore[0].report.isFatal).toBe(true);

    // Step 2: app comes to foreground — assume connectivity now available.
    mockFetch.mockResolvedValue({ ok: true });

    const [, appStateHandler] = mockAddEventListener.mock.calls[0] as [string, (s: string) => void];
    appStateHandler('active');

    await new Promise(setImmediate);
    await new Promise(setImmediate);
    await new Promise(setImmediate);

    const queueAfterFlush = JSON.parse(storedQueue ?? '[]');
    expect(queueAfterFlush).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalled();
  });
});

describe('flushOfflineQueue — exponential backoff', () => {
  const FLUSH_URL = 'https://crash.example.com/reports';
  let mockFetch: jest.Mock;

  function makeQueuedReport(msgSuffix: string) {
    return {
      id: `id-${msgSuffix}`,
      report: { ...makeSampleReport(), message: `msg-${msgSuffix}` },
      queuedAt: new Date().toISOString(),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete global.fetch;
  });

  it('skips the flush attempt when the backoff window has not yet elapsed', async () => {
    const retryState = { nextRetryAt: Date.now() + 60_000, attempt: 1 };
    const queue = [makeQueuedReport('a')];
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === RETRY_STATE_STORAGE_KEY) return Promise.resolve(JSON.stringify(retryState));
      if (key === OFFLINE_QUEUE_STORAGE_KEY) return Promise.resolve(JSON.stringify(queue));
      return Promise.resolve(null);
    });

    await flushOfflineQueue(FLUSH_URL);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('proceeds with the flush when the backoff window has elapsed', async () => {
    const retryState = { nextRetryAt: Date.now() - 1, attempt: 1 };
    const queue = [makeQueuedReport('b')];
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === RETRY_STATE_STORAGE_KEY) return Promise.resolve(JSON.stringify(retryState));
      if (key === OFFLINE_QUEUE_STORAGE_KEY) return Promise.resolve(JSON.stringify(queue));
      return Promise.resolve(null);
    });
    mockFetch.mockResolvedValue({ ok: true });

    await flushOfflineQueue(FLUSH_URL);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('records a RetryState in AsyncStorage after the first failure', async () => {
    const queue = [makeQueuedReport('c')];
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === RETRY_STATE_STORAGE_KEY) return Promise.resolve(null);
      if (key === OFFLINE_QUEUE_STORAGE_KEY) return Promise.resolve(JSON.stringify(queue));
      return Promise.resolve(null);
    });
    mockFetch.mockRejectedValue(new Error('network down'));

    const before = Date.now();
    await flushOfflineQueue(FLUSH_URL);

    const retryCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
      ([key]: [string]) => key === RETRY_STATE_STORAGE_KEY,
    ) as [string, string] | undefined;
    expect(retryCall).toBeDefined();
    const saved = JSON.parse(retryCall![1]);
    expect(saved.attempt).toBe(1);
    expect(saved.nextRetryAt).toBeGreaterThanOrEqual(before + BACKOFF_BASE_MS);
    expect(saved.nextRetryAt).toBeLessThanOrEqual(before + BACKOFF_BASE_MS + 200);
  });

  it('doubles the delay on the second consecutive failure', async () => {
    const priorState = { nextRetryAt: Date.now() - 1, attempt: 1 };
    const queue = [makeQueuedReport('d')];
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === RETRY_STATE_STORAGE_KEY) return Promise.resolve(JSON.stringify(priorState));
      if (key === OFFLINE_QUEUE_STORAGE_KEY) return Promise.resolve(JSON.stringify(queue));
      return Promise.resolve(null);
    });
    mockFetch.mockRejectedValue(new Error('still down'));

    const before = Date.now();
    await flushOfflineQueue(FLUSH_URL);

    const retryCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
      ([key]: [string]) => key === RETRY_STATE_STORAGE_KEY,
    ) as [string, string] | undefined;
    expect(retryCall).toBeDefined();
    const saved = JSON.parse(retryCall![1]);
    expect(saved.attempt).toBe(2);
    const expectedDelay = BACKOFF_BASE_MS * 2; // 60 s
    expect(saved.nextRetryAt).toBeGreaterThanOrEqual(before + expectedDelay);
    expect(saved.nextRetryAt).toBeLessThanOrEqual(before + expectedDelay + 200);
  });

  it('caps the backoff delay at BACKOFF_CAP_MS regardless of the attempt count', async () => {
    const priorState = { nextRetryAt: Date.now() - 1, attempt: 10 };
    const queue = [makeQueuedReport('e')];
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === RETRY_STATE_STORAGE_KEY) return Promise.resolve(JSON.stringify(priorState));
      if (key === OFFLINE_QUEUE_STORAGE_KEY) return Promise.resolve(JSON.stringify(queue));
      return Promise.resolve(null);
    });
    mockFetch.mockRejectedValue(new Error('still down'));

    const before = Date.now();
    await flushOfflineQueue(FLUSH_URL);

    const retryCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
      ([key]: [string]) => key === RETRY_STATE_STORAGE_KEY,
    ) as [string, string] | undefined;
    expect(retryCall).toBeDefined();
    const saved = JSON.parse(retryCall![1]);
    expect(saved.nextRetryAt).toBeLessThanOrEqual(before + BACKOFF_CAP_MS + 200);
    expect(saved.nextRetryAt).toBeGreaterThanOrEqual(before + BACKOFF_CAP_MS - 200);
  });

  it('removes the RetryState from AsyncStorage after a successful delivery', async () => {
    const priorState = { nextRetryAt: Date.now() - 1, attempt: 3 };
    const queue = [makeQueuedReport('f')];
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === RETRY_STATE_STORAGE_KEY) return Promise.resolve(JSON.stringify(priorState));
      if (key === OFFLINE_QUEUE_STORAGE_KEY) return Promise.resolve(JSON.stringify(queue));
      return Promise.resolve(null);
    });
    mockFetch.mockResolvedValue({ ok: true });

    await flushOfflineQueue(FLUSH_URL);

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(RETRY_STATE_STORAGE_KEY);
    const retrySetCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
      ([key]: [string]) => key === RETRY_STATE_STORAGE_KEY,
    );
    expect(retrySetCall).toBeUndefined();
  });

  it('clears a stale RetryState when the queue is already empty', async () => {
    const staleState = { nextRetryAt: Date.now() - 1, attempt: 2 };
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === RETRY_STATE_STORAGE_KEY) return Promise.resolve(JSON.stringify(staleState));
      if (key === OFFLINE_QUEUE_STORAGE_KEY) return Promise.resolve(null);
      return Promise.resolve(null);
    });

    await flushOfflineQueue(FLUSH_URL);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(RETRY_STATE_STORAGE_KEY);
  });

  it('does not write a RetryState when there is no prior state and the queue is empty', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    await flushOfflineQueue(FLUSH_URL);

    expect(mockFetch).not.toHaveBeenCalled();
    const retrySetCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
      ([key]: [string]) => key === RETRY_STATE_STORAGE_KEY,
    );
    expect(retrySetCall).toBeUndefined();
  });
});

describe('readRetryState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('returns null when AsyncStorage has no entry', async () => {
    const result = await readRetryState();
    expect(result).toBeNull();
  });

  it('returns the parsed RetryState when a valid entry exists', async () => {
    const state = { nextRetryAt: 12345, attempt: 2 };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(state));

    const result = await readRetryState();

    expect(result).toEqual(state);
  });

  it('returns null when the stored JSON is missing nextRetryAt', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ attempt: 1 }));

    const result = await readRetryState();

    expect(result).toBeNull();
  });

  it('returns null when the stored JSON is missing attempt', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ nextRetryAt: Date.now() + 1000 }),
    );

    const result = await readRetryState();

    expect(result).toBeNull();
  });

  it('returns null when AsyncStorage.getItem throws', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('storage error'));

    const result = await readRetryState();

    expect(result).toBeNull();
  });
});

describe('resetRetryState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('removes the retry state key from AsyncStorage', async () => {
    await resetRetryState();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(RETRY_STATE_STORAGE_KEY);
  });

  it('does not throw when AsyncStorage.removeItem rejects', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('storage dead'));

    await expect(resetRetryState()).resolves.toBeUndefined();
  });
});

describe('queueReport — concurrent writes do not overwrite each other', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Simulate AsyncStorage that returns an empty queue initially and accumulates writes.
    let stored: string | null = null;
    (AsyncStorage.getItem as jest.Mock).mockImplementation(() =>
      Promise.resolve(stored),
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation((_key: string, value: string) => {
      stored = value;
      return Promise.resolve(undefined);
    });
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('serialises concurrent queueReport calls so no entry is lost', async () => {
    const reports = Array.from({ length: 5 }, (_, i) => ({
      ...makeSampleReport(),
      message: `concurrent-${i}`,
    }));

    // Fire all five queueReport calls concurrently.
    await Promise.all(reports.map((r) => queueReport(r)));

    const queue = await readOfflineQueue();
    expect(queue).toHaveLength(5);
    const messages = queue.map((e) => e.report.message);
    reports.forEach((r) => expect(messages).toContain(r.message));
  });
});
