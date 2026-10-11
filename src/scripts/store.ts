// localStorage can be missing or throw (private mode, blocked site data); every access is guarded.
export const store = {
  // The caller names the type it stored under this key.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- a typed read, like querySelector<T>
  get<T>(key: string): T | null {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  del(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
