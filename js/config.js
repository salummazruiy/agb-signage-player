/**
 * Central place for everything shown around the slideshow: forex rates, the
 * news ticker messages, and the advertisement cards. Nothing here talks to
 * the slideshow/pairing/sync engine — this only feeds forexPanel.js,
 * adPanel.js and newsTicker.js.
 *
 * This now reads from the live "Signage Content" data an admin manages in
 * the admin portal (Admin -> Signage Content), fetched from the server by
 * sync.js and applied here via applyLiveContent() every sync cycle. The
 * DEFAULT_* constants below are only a fallback — used for the very first
 * paint before the first sync completes, and if the device has never
 * successfully synced at all (e.g. offline right out of the box). Every
 * getter below still returns a Promise, so nothing in forexPanel.js/
 * adPanel.js/newsTicker.js had to change when this switched from static
 * sample data to a live API feed.
 *
 * Global `DSConfig` object.
 */
(function (global) {
  // Fallback main board — used only until the first successful sync.
  const DEFAULT_FOREX_RATES = [
    { currency: 'USD', flag: '🇺🇸', buy: 2610, sell: 2680 },
    { currency: 'GBP', flag: '🇬🇧', buy: 3420, sell: 3720 },
    { currency: 'EUR', flag: '🇪🇺', buy: 2915, sell: 3215 },
    { currency: 'KES', flag: '🇰🇪', buy: 17.00, sell: 23.85 }
  ];

  // Fallback "Denominations Below 50" board.
  const DEFAULT_FOREX_SMALL_DENOMINATIONS = [
    { currency: 'USD 20,10,5 & 1', flag: '🇺🇸', buy: 2545, sell: 2680 },
    { currency: 'GBP 10 & 5', flag: '🇬🇧', buy: 3320, sell: 3720 },
    { currency: 'EUR 10 & 5', flag: '🇪🇺', buy: 2815, sell: 3215 }
  ];

  const DEFAULT_FOREX_INSTRUCTIONS = {
    text: 'Above rates are applicable for transactions below US$ 5,000. For amounts greater than that, please contact Treasury Desk at:',
    phone: '+255 677 101 770'
  };

  const DEFAULT_TICKER_MESSAGES = [
    'Welcome to Africa & Gulf Bank (Tanzania) Limited',
    'Innovative Banking Solutions for Individuals and Businesses',
    'Visit www.bankagb.co.tz'
  ];

  // variant: 'digital' (service list) or 'future' (image/CTA style).
  const DEFAULT_AD_CARDS = [
    {
      id: 'digital-banking',
      variant: 'digital',
      title: 'Digital Banking',
      subtitle: 'Simpler. Faster. Safer.',
      services: [
        { icon: '⇄', label: 'Transfer Money' },
        { icon: '🧾', label: 'Pay Bills' },
        { icon: '📱', label: 'Buy Airtime' }
      ],
      background: null,
      cta: null
    },
    {
      id: 'brighter-future',
      variant: 'future',
      title: 'A Brighter Future Starts Today',
      subtitle: 'Save&nbsp;|&nbsp;Invest&nbsp;|&nbsp;Achieve',
      background: null,
      cta: null
    }
  ];

  // Populated by sync.js after each successful GET /api/player/:id/content.
  let live = null;

  /** Called by sync.js (and main.js on boot, with the last cached value) whenever fresh admin-managed content arrives. */
  function applyLiveContent(data) {
    live = data || null;
  }

  function getForexRates() {
    return Promise.resolve((live && live.forex && live.forex.main) || DEFAULT_FOREX_RATES);
  }

  function getForexSmallDenominations() {
    return Promise.resolve((live && live.forex && live.forex.small) || DEFAULT_FOREX_SMALL_DENOMINATIONS);
  }

  function getForexInstructions() {
    return Promise.resolve((live && live.forex && live.forex.instructions) || DEFAULT_FOREX_INSTRUCTIONS);
  }

  function getTickerMessages() {
    return Promise.resolve((live && live.ticker) || DEFAULT_TICKER_MESSAGES);
  }

  function getAdCards() {
    return Promise.resolve((live && live.adCards) || DEFAULT_AD_CARDS);
  }

  global.DSConfig = {
    getForexRates,
    getForexSmallDenominations,
    getForexInstructions,
    getTickerMessages,
    getAdCards,
    applyLiveContent,
    FOREX_REFRESH_INTERVAL_MS: 5 * 60 * 1000 // how often the forex panel re-renders its own flash animation
  };
})(window);
