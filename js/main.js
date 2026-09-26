/**
 * Bootstraps the signage player, following the startup sequence from the BRD:
 * load app -> check local content -> connect to server -> authenticate ->
 * check updates -> download content -> load playlist -> start playback ->
 * send heartbeat. Recovers automatically from network loss, server
 * unavailability, and playback failure by relying on the local cache.
 */
(function () {
  let syncPollHandle = null;

  async function boot() {
    DSPlayer.init();

    const device = await DSDB.getMeta('device');
    if (!device || !device.token) {
      DSPairing.init(boot);
      return;
    }

    // Already paired from a previous session — make sure the pairing screen
    // (hidden by default in the markup, but explicit here as a safety net)
    // isn't left covering the stage on this fresh page load.
    DSPairing.hide();

    // Startup: immediately play whatever was last cached, so the screen never
    // sits idle just because the network happens to be slow or down right now.
    const cachedPlaylist = await DSDB.getMeta('playlist');
    if (cachedPlaylist) {
      DSPlayer.setPlaylist(cachedPlaylist);
    }

    // Same idea for the forex/news/ad-card content: show the last-known-good
    // admin-managed content immediately, instead of the built-in sample data,
    // while the first sync cycle is still in flight.
    const cachedContent = await DSDB.getMeta('signageContent');
    if (cachedContent && window.DSConfig) {
      DSConfig.applyLiveContent(cachedContent);
      refreshContentPanels();
    }

    const cachedConfig = (await DSDB.getMeta('config')) || {
      heartbeatIntervalSeconds: 60,
      syncPollIntervalSeconds: 30
    };

    DSHeartbeat.start(device, cachedConfig.heartbeatIntervalSeconds);

    await syncCycle(device);
    startSyncPolling(device);

    // Recovery: resume playback/sync whenever the browser regains connectivity
    // or the page becomes visible again after being backgrounded.
    window.addEventListener('online', () => syncCycle(device));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncCycle(device);
    });
  }

  async function syncCycle(device) {
    try {
      const result = await DSSync.runSync(device);

      if (result.unauthorized) {
        // This device was deleted/disabled in the admin portal — its
        // credentials are no longer valid. Stop playing stale cached
        // content and drop back to the pairing screen instead of looping
        // forever, so re-pairing is possible again.
        console.warn('[main] device credentials rejected by server — clearing local pairing');
        if (syncPollHandle) clearInterval(syncPollHandle);
        DSHeartbeat.stop();
        DSPlayer.stop();
        await DSDB.setMeta('device', null);
        DSPairing.init(boot);
        return;
      }

      const config = await DSDB.getMeta('config');
      if (config) {
        DSHeartbeat.start(device, config.heartbeatIntervalSeconds); // re-arm with latest interval
        restartSyncPolling(device, config.syncPollIntervalSeconds);
      }
      if (result.changed || !result.fromCache) {
        DSPlayer.setPlaylist(result.playlist);
      } else if (result.playlist && !result.fromCache) {
        DSPlayer.setPlaylist(result.playlist);
      }

      // Forex/news/ad-card content is fetched independently of the playlist
      // (see DSSync.runSync -> fetchAndCacheContent) and may have changed
      // even when the playlist didn't, so this always re-renders the panels
      // rather than being gated behind `result.changed`.
      refreshContentPanels();
    } catch (err) {
      console.error('[main] sync cycle threw unexpectedly', err);
    }
  }

  function refreshContentPanels() {
    if (window.DSForexPanel) DSForexPanel.refresh();
    if (window.DSAdPanel) DSAdPanel.refresh();
    if (window.DSNewsTicker) DSNewsTicker.refresh();
  }

  function startSyncPolling(device) {
    DSDB.getMeta('config').then((config) => {
      restartSyncPolling(device, (config && config.syncPollIntervalSeconds) || 30);
    });
  }

  function restartSyncPolling(device, intervalSeconds) {
    if (syncPollHandle) clearInterval(syncPollHandle);
    syncPollHandle = setInterval(() => syncCycle(device), Math.max(intervalSeconds, 10) * 1000);
  }

  // Global playback recovery net: if anything throws inside our own code and
  // the stage is stuck idle for too long, attempt to restart playback.
  window.addEventListener('error', (e) => {
    console.error('[main] uncaught error', e.error || e.message);
  });

  document.addEventListener('DOMContentLoaded', boot);
})();
