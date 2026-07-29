type Listener = (...arguments_: unknown[]) => unknown;

function event() {
  const listeners = new Set<Listener>();
  return {
    addListener(listener: Listener) {
      listeners.add(listener);
    },
    removeListener(listener: Listener) {
      listeners.delete(listener);
    },
    hasListener(listener: Listener) {
      return listeners.has(listener);
    },
    emit(...arguments_: unknown[]) {
      return [...listeners].map((listener) => listener(...arguments_));
    },
  };
}

const values: Record<string, unknown> = {};
const storageChanged = event();

const browser = {
  storage: {
    local: {
      async get(keys?: string | string[] | Record<string, unknown> | null) {
        if (keys === undefined || keys === null) {
          return structuredClone(values);
        }
        if (typeof keys === 'string') {
          return keys in values ? { [keys]: structuredClone(values[keys]) } : {};
        }
        if (Array.isArray(keys)) {
          return Object.fromEntries(
            keys.filter((key) => key in values).map((key) => [key, structuredClone(values[key])]),
          );
        }
        return Object.fromEntries(
          Object.entries(keys).map(([key, fallback]) => [
            key,
            key in values ? structuredClone(values[key]) : fallback,
          ]),
        );
      },
      async set(items: Record<string, unknown>) {
        const changes = Object.fromEntries(
          Object.entries(items).map(([key, value]) => [
            key,
            { oldValue: values[key], newValue: structuredClone(value) },
          ]),
        );
        Object.assign(values, structuredClone(items));
        storageChanged.emit(changes, 'local');
      },
      async remove(keys: string | string[]) {
        for (const key of typeof keys === 'string' ? [keys] : keys) {
          delete values[key];
        }
      },
    },
    onChanged: storageChanged,
  },
  runtime: {
    getManifest: () => ({ version: '0.1.0' }),
    getURL: (path: string) => `moz-extension://test/${path}`,
    async sendMessage(message: { type?: string; binding?: unknown }) {
      if (message.type === 'binding.get') return { ok: true, binding: null };
      if (message.type === 'binding.save') return { ok: true, binding: message.binding };
      return { ok: true };
    },
    onInstalled: event(),
    onMessage: event(),
  },
  permissions: {
    getAll: async () => ({ permissions: ['storage'], origins: [] }),
    contains: async () => true,
    request: async () => true,
    remove: async () => true,
  },
  notifications: {
    create: async () => 'notification-id',
  },
  tabs: {
    create: async ({ url }: { url: string }) => ({ id: 1, url }),
    update: async (tabId: number, { url }: { url: string }) => ({ id: tabId, url }),
  },
};

export default browser;
