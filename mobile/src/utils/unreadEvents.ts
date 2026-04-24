type Listener = () => void;

const listeners: Set<Listener> = new Set();

const unreadEvents = {
  onRefresh: (fn: Listener): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  emit: (): void => {
    listeners.forEach((fn) => fn());
  },
};

export default unreadEvents;
