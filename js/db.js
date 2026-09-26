/**
 * IndexedDB wrapper for the signage player's local cache.
 * Stores:
 *  - "meta"  : key/value store for device credentials, last-known config/playlist
 *  - "media" : checksum -> { blob, mimeType, fileName } cached media files
 * Exposed as the global `DSDB` object (no ES module system — plain <script> include
 * for maximum compatibility with older embedded TV browsers).
 */
(function (global) {
  const DB_NAME = 'ds_signage_player';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return open().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  function getMeta(key) {
    return tx('meta', 'readonly').then((store) => new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  function setMeta(key, value) {
    return tx('meta', 'readwrite').then((store) => new Promise((resolve, reject) => {
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    }));
  }

  function getMedia(checksum) {
    return tx('media', 'readonly').then((store) => new Promise((resolve, reject) => {
      const req = store.get(checksum);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  function setMedia(checksum, value) {
    return tx('media', 'readwrite').then((store) => new Promise((resolve, reject) => {
      const req = store.put(value, checksum);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    }));
  }

  function deleteMedia(checksum) {
    return tx('media', 'readwrite').then((store) => new Promise((resolve, reject) => {
      const req = store.delete(checksum);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    }));
  }

  function allMediaKeys() {
    return tx('media', 'readonly').then((store) => new Promise((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  global.DSDB = { getMeta, setMeta, getMedia, setMedia, deleteMedia, allMediaKeys };
})(window);
