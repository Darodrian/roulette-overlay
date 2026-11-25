export function installStoreEnv() {
  globalThis.window = {
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    addEventListener: () => {},
    setInterval: () => 0,
  };
  globalThis.BroadcastChannel = class {
    postMessage() {}
    addEventListener() {}
  };
}
