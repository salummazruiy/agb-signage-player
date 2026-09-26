/**
 * Renders the bottom-of-main-content scrolling news ticker from
 * DSConfig.getTickerMessages(). Loops seamlessly by duplicating the content
 * once and animating a translateX from 0 to -50% (see the `tickerScroll`
 * keyframes in branding.css) — at the halfway point the duplicate lines up
 * exactly where the original started, so there is no visible jump when it
 * restarts. Animation duration is computed from the actual rendered width
 * so scroll speed stays constant no matter how many messages are configured.
 */
(function () {
  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  const PIXELS_PER_SECOND = 90;

  async function render() {
    const track = document.getElementById('tickerTrack');
    if (!track || !window.DSConfig) return;

    let messages;
    try {
      messages = await DSConfig.getTickerMessages();
    } catch (err) {
      console.error('[newsTicker] failed to load ticker messages', err);
      return;
    }

    const text = escapeHtml(messages.join('   •   '));
    track.innerHTML =
      `<span class="ticker-item">${text}</span>` +
      `<span class="ticker-item" aria-hidden="true">${text}</span>`;

    requestAnimationFrame(() => {
      const singleWidth = track.children[0] ? track.children[0].getBoundingClientRect().width : 0;
      const duration = Math.max(singleWidth / PIXELS_PER_SECOND, 8);
      track.style.animationDuration = duration + 's';
    });
  }

  render();

  // Exposed so main.js can force an immediate re-render right after a sync
  // cycle brings in fresh admin-managed ticker messages.
  window.DSNewsTicker = { refresh: render };
})();
