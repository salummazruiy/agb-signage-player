/**
 * Live header clock/date, updated every second. Self-contained — no
 * dependency on config.js or the slideshow engine.
 */
(function () {
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function tick() {
    const now = new Date();
    const timeEl = document.getElementById('clockTime');
    const dateEl = document.getElementById('clockDate');
    if (timeEl) timeEl.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    if (dateEl) dateEl.textContent = now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
  }

  tick();
  setInterval(tick, 1000);
})();
