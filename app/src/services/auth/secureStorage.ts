// Supabase storage adapter on expo-secure-store. A Supabase session is JSON of 2 to 4 KB and SecureStore
// is only reliable up to about 2 KB a value (iOS Keychain and Android Keystore wrappers both complain),
// so values are split into chunks. Layout: `<key>` holds "chunks:<n>" and `<key>.<i>` holds each piece.

import * as SecureStore from 'expo-secure-store';

export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface KeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export const CHUNK_SIZE = 1500;
const MARK = 'chunks:';

/** SecureStore keys may only contain letters, digits, ".", "-" and "_". */
const safe = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');

export function createChunkedStorage(store: KeyValueStore = SecureStore, chunkSize = CHUNK_SIZE): AuthStorage {
  const piece = (key: string, i: number) => `${safe(key)}.${i}`;

  async function remove(key: string): Promise<void> {
    const head = (await store.getItemAsync(safe(key))) ?? null;
    if (head?.startsWith(MARK)) {
      const n = Number(head.slice(MARK.length));
      for (let i = 0; i < n; i += 1) await store.deleteItemAsync(piece(key, i));
    }
    await store.deleteItemAsync(safe(key));
  }

  return {
    async getItem(key) {
      const head = (await store.getItemAsync(safe(key))) ?? null;
      if (head === null || !head.startsWith(MARK)) return head;
      const n = Number(head.slice(MARK.length));
      let out = '';
      for (let i = 0; i < n; i += 1) {
        const part = (await store.getItemAsync(piece(key, i))) ?? null;
        if (part === null) return null; // a torn write reads as signed out, never as a corrupt session
        out += part;
      }
      return out;
    },
    async setItem(key, value) {
      await remove(key);
      if (value.length <= chunkSize) return store.setItemAsync(safe(key), value);
      const n = Math.ceil(value.length / chunkSize);
      for (let i = 0; i < n; i += 1) await store.setItemAsync(piece(key, i), value.slice(i * chunkSize, (i + 1) * chunkSize));
      await store.setItemAsync(safe(key), `${MARK}${n}`);
    },
    removeItem: remove,
  };
}
