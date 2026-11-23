/**
 * Test helper: a minimal in-memory sessionStorage, so code that uses
 * lib/storage.ts can run in Node. Use with
 *   vi.stubGlobal('window', { sessionStorage: fakeSessionStorage() })
 */
export function fakeSessionStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
  };
}
