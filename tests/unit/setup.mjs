// A fresh copy of store.js on an in-memory localStorage, so each test starts from a clean device.
let n = 0;
export async function freshStore(seed = {}) {
  const data = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  globalThis.localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
  const store = await import(`../../assets/js/store.js?fresh=${++n}`);
  return { store, data, saved: (k) => (store.flush(), JSON.parse(data.get(k) ?? 'null')) };
}
