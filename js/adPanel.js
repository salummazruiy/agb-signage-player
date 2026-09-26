/**
 * Renders the right-hand advertisement cards from DSConfig.getAdCards().
 * Each card is independently configurable (title/subtitle/services/
 * background/cta) — see config.js. Re-rendering the whole panel is cheap
 * (a handful of small DOM nodes), so this simply re-renders once on load;
 * swap DSConfig.getAdCards() for a live API call if these should change
 * without a page reload.
 */
(function () {
  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function renderCard(card) {
    const bgStyle = card.background ? ` style="background-image:url('${escapeHtml(card.background)}')"` : '';

    if (card.variant === 'digital') {
      const services = (card.services || []).map((s) => `
        <li><span class="ad-service-icon">${escapeHtml(s.icon)}</span>${escapeHtml(s.label)}</li>
      `).join('');
      return `
        <div class="ad-card ad-card-digital"${bgStyle}>
          <h3 class="ad-title">${escapeHtml(card.title)}</h3>
          <p class="ad-subtitle">${escapeHtml(card.subtitle || '')}</p>
          <ul class="ad-services">${services}</ul>
        </div>`;
    }

    return `
      <div class="ad-card ad-card-future"${bgStyle}>
        <h3 class="ad-title">${escapeHtml(card.title)}</h3>
        <p class="ad-subtitle">${card.subtitle || ''}</p>
        ${card.cta ? `<div class="ad-cta">${escapeHtml(card.cta)}</div>` : ''}
      </div>`;
  }

  async function render() {
    const panel = document.getElementById('adPanel');
    if (!panel || !window.DSConfig) return;

    let cards;
    try {
      cards = await DSConfig.getAdCards();
    } catch (err) {
      console.error('[adPanel] failed to load ad cards', err);
      return;
    }

    panel.innerHTML = cards.map(renderCard).join('');
  }

  render();

  // Exposed so main.js can force an immediate re-render right after a sync
  // cycle brings in fresh admin-managed cards.
  window.DSAdPanel = { refresh: render };
})();
