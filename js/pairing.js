/**
 * Handles the pairing screen: collects a pairing code generated in the admin
 * portal, registers this device, and persists its credentials locally so it
 * never needs to be paired again (unless an admin deletes the device).
 * Global `DSPairing` object.
 */
(function (global) {
  function screenResolution() {
    return `${window.screen.width}x${window.screen.height}`;
  }

  const PLAYER_VERSION = '1.0.0';

  function show() {
    document.getElementById('pairingScreen').hidden = false;
    document.getElementById('stage').hidden = true;
    document.getElementById('idleScreen').hidden = true;
  }

  function hide() {
    document.getElementById('pairingScreen').hidden = true;
  }

  function showError(msg) {
    const el = document.getElementById('pairingError');
    el.textContent = msg;
    el.hidden = false;
  }

  function init(onPaired) {
    show();
    const form = document.getElementById('pairingForm');
    const input = document.getElementById('pairingCodeInput');

    input.addEventListener('input', () => {
      let v = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      input.value = v;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      document.getElementById('pairingError').hidden = true;
      try {
        const result = await DSApi.register(input.value.trim(), PLAYER_VERSION, screenResolution());
        await DSDB.setMeta('device', {
          deviceId: result.deviceId,
          deviceUid: result.deviceUid,
          name: result.name,
          token: result.token
        });
        hide();
        onPaired();
      } catch (err) {
        showError(err.message || 'Pairing failed. Please check the code and try again.');
      }
    });
  }

  global.DSPairing = { init, hide, screenResolution, PLAYER_VERSION };
})(window);
