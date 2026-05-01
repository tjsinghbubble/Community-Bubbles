const noop = () => {};
const noopScope = {
  setTag: noop,
  setExtra: noop,
  setLevel: noop,
  setFingerprint: noop,
  setUser: noop,
};
const noopSpan = {
  setAttribute: noop,
  setStatus: noop,
  end: noop,
  finish: noop,
  isRecording: () => false,
};

export const reactNavigationIntegration = () => ({});
export const init = noop;
export const addBreadcrumb = noop;
export const withScope = (fn: (scope: typeof noopScope) => void) => { try { fn(noopScope); } catch {} };
export const captureException = noop;
export const captureMessage = noop;
export const setUser = noop;
export const configureScope = (fn: (scope: typeof noopScope) => void) => { try { fn(noopScope); } catch {} };
export const getActiveSpan = () => null;
export const startInactiveSpan = (_opts?: unknown) => noopSpan;
export const setMeasurement = noop;
export const getCurrentScope = () => noopScope;
