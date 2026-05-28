import { registerRootComponent } from 'expo';
import App from './App';

// Wrap registration so any startup crash logs the full stack before React
// Native's runtime is torn down. The [runtime not ready] error swallows the
// call stack; this surfaces it in the Metro terminal.
try {
  registerRootComponent(App);
} catch (e: any) {
  // eslint-disable-next-line no-console
  console.error('STARTUP CRASH — message:', e?.message);
  // eslint-disable-next-line no-console
  console.error('STARTUP CRASH — stack:\n', e?.stack);
}
