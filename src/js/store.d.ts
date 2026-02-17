/** Type declaration for Framework7 store (store.js) */
declare const store: {
  state: Record<string, unknown>;
  getters?: Record<string, (...args: unknown[]) => unknown>;
  dispatch?: (name: string, data?: unknown) => Promise<unknown>;
};
export default store;
