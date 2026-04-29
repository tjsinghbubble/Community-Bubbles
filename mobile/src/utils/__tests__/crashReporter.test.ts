jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@sentry/react-native', () => ({
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

import * as Sentry from '@sentry/react-native';
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
  MAX_MESSAGE_CHARS,
  MAX_STACK_CHARS,
  MAX_CONTEXT_CHARS,
  TRUNCATION_SUFFIX,
  DEDUP_WINDOW_MS,
  isDuplicate,
  resetDedupCache,
  dedupCacheSize,
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
    jest.clearAllMocks();
    (Sentry.getCurrentScope as jest.Mock).mockReturnValue(mockCurrentScope);
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
