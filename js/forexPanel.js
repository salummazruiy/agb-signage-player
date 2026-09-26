/**
 * Renders the left-hand forex panel from DSConfig: the main rate board, the
 * "Denominations Below 50" board, and the instructions/contact note — the
 * same three sections as the bank's own printed rate sheet. Re-renders on
 * an interval so a future live API swap-in shows up without a page reload;
 * a brief highlight animation marks each refresh (the "number refresh
 * animation" called for in the design).
 */
(function () {
  // Maps a currency's ISO 4217 code (parsed off the front of the row's
  // currency label, e.g. "USD 20,10,5 & 1" -> "USD") to the flag image
  // bundled at assets/flags/<code>.svg (real rectangular flags — MIT-licensed
  // from the flag-icons project — instead of emoji, since flag emoji render
  // as plain two-letter text on stock Windows/Android TV browsers with no
  // color-emoji font installed, which is why the panel could show "US"/"GB"
  // instead of an actual flag). Add an entry here (and drop the matching
  // assets/flags/<code>.svg next to the existing ones) to get a real flag
  // for a currency an admin adds later; anything not listed here falls back
  // to whatever the admin typed into the row's "flag" field (still emoji by
  // default), so adding a new currency never breaks — it just shows a plain
  // flag until a real icon is added for it.
  const CURRENCY_FLAGS = {
    USD: 'us', GBP: 'gb', EUR: 'eu', KES: 'ke', TZS: 'tz', UGX: 'ug', RWF: 'rw',
    ZAR: 'za', AED: 'ae', SAR: 'sa', CNY: 'cn', INR: 'in', JPY: 'jp', CHF: 'ch',
    CAD: 'ca', AUD: 'au', ZMW: 'zm', MZN: 'mz', BIF: 'bi', CDF: 'cd'
  };

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function formatAmount(n) {
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function flagHtml(r) {
    // "USD 20,10,5 & 1" -> "USD"; a bare "USD" -> "USD".
    const code = String(r.currency || '').trim().split(/\s/)[0].toUpperCase();
    const iso = CURRENCY_FLAGS[code];
    if (iso) {
      return `<img class="forex-flag-img" src="assets/flags/${iso}.svg" alt="${escapeHtml(code)}" />`;
    }
    return `<span class="forex-flag">${escapeHtml(r.flag || '')}</span>`;
  }

  function rowsHtml(rates) {
    return rates.map((r) => `
      <tr class="forex-row">
        <td class="forex-currency">${flagHtml(r)}${escapeHtml(r.currency)}</td>
        <td class="forex-buy">${formatAmount(r.buy)}</td>
        <td class="forex-sell">${formatAmount(r.sell)}</td>
      </tr>
    `).join('');
  }

  function flashRefresh(el) {
    if (!el) return;
    el.classList.remove('forex-flash');
    void el.offsetWidth; // force reflow so the animation can replay
    el.classList.add('forex-flash');
  }

  async function render() {
    if (!window.DSConfig) return;
    const mainBody = document.getElementById('forexTableBody');
    const smallBody = document.getElementById('forexSmallTableBody');
    const instructionsEl = document.getElementById('forexInstructions');

    try {
      const [mainRates, smallRates, instructions] = await Promise.all([
        DSConfig.getForexRates(),
        DSConfig.getForexSmallDenominations(),
        DSConfig.getForexInstructions()
      ]);

      if (mainBody) {
        mainBody.innerHTML = rowsHtml(mainRates);
        flashRefresh(mainBody);
      }
      if (smallBody) {
        smallBody.innerHTML = rowsHtml(smallRates);
        flashRefresh(smallBody);
      }
      if (instructionsEl && instructions) {
        instructionsEl.innerHTML = `
          <p class="forex-instructions-note">${instructions.text} <strong>${instructions.phone}</strong></p>
        `;
      }
    } catch (err) {
      console.error('[forexPanel] failed to load forex data', err);
      return;
    }

    const updatedEl = document.getElementById('forexUpdatedAt');
    if (updatedEl) {
      const now = new Date();
      updatedEl.textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    }
  }

  render();
  setInterval(render, (window.DSConfig && DSConfig.FOREX_REFRESH_INTERVAL_MS) || 5 * 60 * 1000);

  // Exposed so main.js can force an immediate re-render right after a sync
  // cycle brings in fresh admin-managed rates, instead of waiting for the
  // interval above (which exists for the flash animation, not for freshness).
  window.DSForexPanel = { refresh: render };
})();
