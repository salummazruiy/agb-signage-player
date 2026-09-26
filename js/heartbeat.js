/**
 * Sends a periodic heartbeat so the admin portal can show this device as online.
 * Global `DSHeartbeat` object.
 */
(function (global) {
  let intervalHandle = null;

  function start(device, intervalSeconds) {
    stop();
    const send = () => {
      DSApi.heartbeat(device.token, DSPairing.PLAYER_VERSION, DSPairing.screenResolution())
        .catch((err) => console.warn('[heartbeat] failed (device likely offline):', err.message));
    };
    send();
    intervalHandle = setInterval(send, Math.max(intervalSeconds, 15) * 1000);
  }

  function stop() {
    if (intervalHandle) clearInterval(intervalHandle);
    intervalHandle = null;
  }

  global.DSHeartbeat = { start, stop };
})(window);
