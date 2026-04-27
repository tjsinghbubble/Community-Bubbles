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
  MAX_MESSAGE_CHARS,
  MAX_STACK_CHARS,
  MAX_CONTEXT_CHARS,
  TRUNCATION_SUFFIX,
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
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);
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

  it('sends a report with isFatal set to false', () => {
    reportError(new Error('check isFatal'));

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { isFatal: boolean };
    expect(body.isFatal).toBe(false);
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
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);
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

  it('sends a report with isFatal set to true', () => {
    reportFatalError(new Error('check isFatal'));

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { isFatal: boolean };
    expect(body.isFatal).toBe(true);
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
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);
    jest.clearAllMocks();
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

  it('posts to the server via fetch', () => {
    logAppEvent('checkout_completed');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/crash-report');
  });

  it('posts the event message as the report message', () => {
    logAppEvent('profile_updated');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { message: string };
    expect(body.message).toBe('profile_updated');
  });

  it('serialises attributes into the report context when provided', () => {
    const attributes = { tab: 'home', itemId: 7 };

    logAppEvent('tab_switched', attributes);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { context: string };
    expect(body.context).toBe(JSON.stringify(attributes));
  });

  it('omits context from the report when no attributes are given', () => {
    logAppEvent('session_started');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { context?: string };
    expect(body.context).toBeUndefined();
  });
});

describe('logAppWarn', () => {
  let mockScope: MockScope;

  beforeEach(() => {
    mockScope = makeMockScope();
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);
    jest.clearAllMocks();
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

  it('posts to the server via fetch', () => {
    logAppWarn('memory pressure');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/crash-report');
  });

  it('posts the warning message as the report message', () => {
    logAppWarn('token expired');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { message: string };
    expect(body.message).toBe('token expired');
  });

  it('serialises attributes into the report context when provided', () => {
    const attributes = { code: 401, retry: true };

    logAppWarn('auth failed', attributes);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { context: string };
    expect(body.context).toBe(JSON.stringify(attributes));
  });

  it('omits context from the report when no attributes are given', () => {
    logAppWarn('fallback used');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { context?: string };
    expect(body.context).toBeUndefined();
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
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);
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

    it('sends a report with isFatal=true when the handler is called with isFatal=true', () => {
      const { getInstalledHandler } = setupErrorUtils();

      getInstalledHandler()(new Error('fatal payload'), true);

      const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { isFatal: boolean };
      expect(body.isFatal).toBe(true);
    });

    it('calls reportError (Sentry level "error") when isFatal is false', () => {
      const { getInstalledHandler } = setupErrorUtils();
      const error = new Error('non-fatal error');

      getInstalledHandler()(error, false);

      expect(mockScope.setLevel).toHaveBeenCalledWith('error');
      expect(mockScope.setLevel).not.toHaveBeenCalledWith('fatal');
    });

    it('sends a report with isFatal=false when the handler is called with isFatal=false', () => {
      const { getInstalledHandler } = setupErrorUtils();

      getInstalledHandler()(new Error('non-fatal payload'), false);

      const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { isFatal: boolean };
      expect(body.isFatal).toBe(false);
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

    it('sends a report with isFatal=false for an unhandled rejection', () => {
      installGlobalHandlers();
      const callback = (Promise as unknown as MockPromise)._unhandledRejectionCallback!;

      callback(new Error('rejection payload'));

      const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { isFatal: boolean };
      expect(body.isFatal).toBe(false);
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
