/**
 * Synchronization engine: fetches the device's config + assigned playlist from
 * the server, downloads only new/changed media (compared by checksum against
 * the local IndexedDB cache), evicts media no longer referenced by any cached
 * playlist, and reports the outcome back to the server for the sync log.
 * Falls back to the last successfully cached playlist when offline.
 * Global `DSSync` object.
 */
(function (global) {
  async function fetchAndCacheConfig(device) {
    const res = await DSApi.getConfig(device.token, device.deviceId);
    await DSDB.setMeta('config', res.data);
    return res.data;
  }

  /**
   * Refreshes the forex/news-ticker/ad-card content shown around the
   * slideshow. Deliberately isolated from fetchAndCacheConfig()/getPlaylist()
   * above: a content-fetch failure (or the endpoint being briefly slow) must
   * never interrupt or fall back the actual slideshow sync, so every error
   * here is swallowed after logging and the last-known-good content (cached
   * in IndexedDB, applied by main.js on boot) simply stays on screen.
   */
  async function fetchAndCacheContent(device) {
    try {
      const res = await DSApi.getContent(device.token, device.deviceId);
      await DSDB.setMeta('signageContent', res.data);
      if (global.DSConfig) DSConfig.applyLiveContent(res.data);
      return res.data;
    } catch (err) {
      console.warn('[sync] failed to refresh signage content (forex/news/ads) — keeping last known values', err);
      return null;
    }
  }

  async function downloadMissingItems(items, onProgress) {
    let filesDownloaded = 0;
    let bytesDownloaded = 0;

    for (const item of items) {
      if (!item.checksum || !item.url) continue;
      const existing = await DSDB.getMedia(item.checksum);
      if (existing) continue;

      let downloadedSize = null;
      try {
        const blob = await DSApi.downloadMedia(item.url);
        downloadedSize = blob.size;
        await DSDB.setMedia(item.checksum, { blob, mimeType: blob.type, fileType: item.fileType, fileName: item.fileName });
        filesDownloaded += 1;
        bytesDownloaded += blob.size;
        if (onProgress) onProgress(item);
      } catch (err) {
        if (err && err.name === 'QuotaExceededError') {
          const sizeNote = downloadedSize ? ` (file is ~${Math.round(downloadedSize / 1e6)}MB)` : '';
          console.error(`[sync] could not cache "${item.title}"${sizeNote} — browser storage quota exceeded. This file will stream live from the server every time it plays instead of from local cache, which can cause it to stutter/buffer.`, err);
        } else {
          console.error('[sync] failed to download', item.url, err);
        }
      }
    }
    return { filesDownloaded, bytesDownloaded };
  }

  async function evictUnusedMedia(currentPlaylist) {
    const keep = new Set((currentPlaylist && currentPlaylist.items || []).map((i) => i.checksum).filter(Boolean));
    const keys = await DSDB.allMediaKeys();
    for (const key of keys) {
      if (!keep.has(key)) await DSDB.deleteMedia(key);
    }
  }

  /**
   * Runs a full sync cycle. Returns { playlist, fromCache, changed }.
   * `onProgress(item)` is called after each newly downloaded file.
   */
  async function runSync(device, onProgress) {
    await fetchAndCacheContent(device); // best-effort; never throws or affects playlist sync below

    let playlistResponse;
    try {
      await fetchAndCacheConfig(device);
      playlistResponse = await DSApi.getPlaylist(device.token, device.deviceId);
    } catch (err) {
      // A real 401 from the server means this device's credentials were
      // rejected (e.g. an admin deleted or disabled it in the portal) — that
      // is different from being offline, and should NOT keep silently
      // replaying old cached content forever. Network failures / CORS
      // misconfiguration never reach this branch with a status at all (the
      // browser blocks the response before JS can see one), so this only
      // fires for a genuine, reachable rejection from the API.
      if (err.status === 401) {
        return { playlist: null, fromCache: false, changed: false, error: err, unauthorized: true };
      }
      // Offline or server unreachable: fall back to the last cached playlist.
      const cached = await DSDB.getMeta('playlist');
      return { playlist: cached || null, fromCache: true, changed: false, error: err };
    }

    const newPlaylist = playlistResponse.data;
    const previous = await DSDB.getMeta('playlist');
    const changed = !previous || !newPlaylist || previous.id !== newPlaylist.id || previous.version !== newPlaylist.version;

    if (!newPlaylist) {
      await DSDB.setMeta('playlist', null);
      return { playlist: null, fromCache: false, changed };
    }

    let stats = { filesDownloaded: 0, bytesDownloaded: 0 };
    try {
      stats = await downloadMissingItems(newPlaylist.items, onProgress);
      await evictUnusedMedia(newPlaylist);
      await DSDB.setMeta('playlist', newPlaylist);

      await DSApi.reportSync(device.token, device.deviceId, {
        playlistId: newPlaylist.id,
        playlistVersion: newPlaylist.version,
        filesDownloaded: stats.filesDownloaded,
        bytesDownloaded: stats.bytesDownloaded,
        status: 'success'
      });
    } catch (err) {
      console.error('[sync] sync cycle failed', err);
      try {
        await DSApi.reportSync(device.token, device.deviceId, {
          playlistId: newPlaylist.id,
          playlistVersion: newPlaylist.version,
          filesDownloaded: stats.filesDownloaded,
          bytesDownloaded: stats.bytesDownloaded,
          status: 'partial',
          message: err.message
        });
      } catch (e2) { /* best-effort reporting only */ }
    }

    return { playlist: newPlaylist, fromCache: false, changed };
  }

  /** Resolves a playlist item's playable local object URL, downloading it on-the-fly if missing. */
  async function resolveItemUrl(item) {
    const cached = item.checksum ? await DSDB.getMedia(item.checksum) : null;
    if (cached) return URL.createObjectURL(cached.blob);
    // Not cached yet — either this is the very first run before sync finished,
    // or caching this file has been persistently failing (e.g. it's larger
    // than this browser's storage quota allows). Either way this item is
    // about to be streamed live over the network instead of played from the
    // local cache, so a mid-network hiccup can show up as buffering/stutter
    // partway through playback. Logged clearly so this is easy to spot in
    // devtools when diagnosing a "video stutters/pauses" report.
    console.warn('[sync] no local cache for', item.title, '— playing over the network instead; if this repeats every time, the file may be too large for this browser\'s storage quota');
    return DSApi.apiBase() + item.url;
  }

  global.DSSync = { runSync, resolveItemUrl };
})(window);
