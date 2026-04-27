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
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
  },
}));

jest.mock('../../package.json', () => ({ version: '1.0.0' }), { virtual: true });

import {
  buildReport,
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
