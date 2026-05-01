import type { IStorage } from "./storage";

export interface BufferedError {
  message: string;
  timestamp: string;
  platform: string;
  level: 'error';
}

const MAX_ENTRIES = 100;
const _buffer: BufferedError[] = [];

let _storage: IStorage | null = null;

export function initErrorBuffer(storageInstance: IStorage): void {
  _storage = storageInstance;
}

const _originalConsoleError = console.error.bind(console);

console.error = (...args: unknown[]) => {
  _originalConsoleError(...args);
  try {
    const message = args
      .map((a) => {
        if (a instanceof Error) return `${a.message}${a.stack ? `\n${a.stack}` : ''}`;
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch { return String(a); }
        }
        return String(a);
      })
      .join(' ');

    const entry: BufferedError = {
      message: message.slice(0, 2048),
      timestamp: new Date().toISOString(),
      platform: 'server',
      level: 'error',
    };

    _buffer.push(entry);
    if (_buffer.length > MAX_ENTRIES) {
      _buffer.shift();
    }

    if (_storage) {
      _storage.insertErrorLogEntry({
        message: entry.message,
        platform: entry.platform,
        level: entry.level,
      }).catch(() => {
        // Never throw from inside console.error patch
      });
    }
  } catch {
    // Never throw from inside console.error patch
  }
};

export function getBufferedErrors(): BufferedError[] {
  return [..._buffer].reverse();
}

export function clearBufferedErrors(): void {
  _buffer.length = 0;
}
