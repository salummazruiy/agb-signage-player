/**
 * Best-effort: push the page into true browser Fullscreen mode as early and
 * as persistently as possible.
 *
 * Why this exists: on some Samsung Tizen (and similar embedded/Smart TV)
 * browsers, a page running in the browser's normal "windowed" app view can
 * get rendered at a smaller internal canvas size and then displayed
 * pixel-for-pixel instead of stretched to fill the panel whenever the TV's
 * own Picture "Aspect Ratio" setting is "Original" — showing the whole page
 * shrunk into a corner with black filling the rest of the screen. Explicitly
 * requesting the Fullscreen API often makes the browser switch to a true
 * full-panel-resolution rendering surface, which sidesteps that entirely.
 *
 * This is intentionally isolated from every other player script: if the
 * Fullscreen API is unsupported, blocked, or throws (e.g. because the
 * browser requires a user gesture it never receives), everything else in
 * the app continues exactly as before. It never touches pairing/sync/
 * playback state.
 */
(function () {
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
  }

  function requestFullscreen() {
    if (isFullscreen()) return;
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!request) return;
    try {
      const result = request.call(el);
      if (result && typeof result.catch === 'function') {
        result.catch((err) => console.warn('[fullscreen] request was rejected', err));
      }
    } catch (err) {
      console.warn('[fullscreen] request threw', err);
    }
  }

  // Try immediately, and again once the page has fully loaded (some
  // browsers only allow the call once resources have settled).
  requestFullscreen();
  window.addEventListener('load', requestFullscreen);

  // Some embedded browsers reject a fullscreen request unless it happens
  // inside a user-gesture event (click/touch/key). This TV is normally never
  // touched, but if anyone ever does tap the screen (e.g. while
  // troubleshooting), use that moment to go fullscreen — and stop listening
  // once it succeeds.
  ['click', 'touchstart', 'keydown'].forEach((evt) => {
    document.addEventListener(evt, function onGesture() {
      requestFullscreen();
      if (isFullscreen()) {
        ['click', 'touchstart', 'keydown'].forEach((e2) => document.removeEventListener(e2, onGesture));
      }
    });
  });

  // Belt-and-braces: keep retrying on a slow interval for the first couple
  // of minutes after boot, in case the very first attempts are rejected due
  // to timing but a later one is allowed. Stops on its own once fullscreen
  // is achieved or after 12 tries (~2 minutes).
  let attempts = 0;
  const retryTimer = setInterval(() => {
    attempts += 1;
    if (isFullscreen() || attempts >= 12) {
      clearInterval(retryTimer);
      return;
    }
    requestFullscreen();
  }, 10000);
})();
