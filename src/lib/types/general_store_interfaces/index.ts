export interface PersistedStorageWithRehydration {
  _hydrated: boolean;
  hydrate: () => void;
}
