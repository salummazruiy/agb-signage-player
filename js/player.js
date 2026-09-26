/**
 * Fullscreen playback engine. Cross-fades (or slides) between two stacked
 * layers so there is never a blank frame between items. Images play for
 * their configured duration; videos play once through and then advance.
 * Global `DSPlayer` object.
 */
(function (global) {
  const stage = () => document.getElementById('stage');
  const idleScreen = () => document.getElementById('idleScreen');
  const statusBadge = () => document.getElementById('statusBadge');

  let layers = [];
  let activeLayerIndex = 0;
  let playlist = null;
  let currentIndex = -1;
  let advanceTimer = null;
  let transitionEffect = 'fade';
  let transitionDurationMs = 800;
  let running = false;

  function init() {
    layers = [document.getElementById('layerA'), document.getElementById('layerB')];
    layers.forEach((l) => { l.className = 'layer hidden-layer'; });
  }

  function requestFullscreenBestEffort() {
    const el = document.documentElement;
    const method = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (method) {
      try { method.call(el).catch(() => {}); } catch (e) { /* ignore — many kiosk TV browsers are already fullscreen */ }
    }
  }

  function setStatus(text) {
    const el = statusBadge();
    if (el) el.textContent = text;
  }

  /** Replace the playlist being played. Takes effect the next time an item finishes. */
  function setPlaylist(newPlaylist) {
    playlist = newPlaylist;
    if (currentIndex === -1 && playlist && playlist.items && playlist.items.length) {
      start();
    } else if (!playlist || !playlist.items || !playlist.items.length) {
      showIdle();
    }
  }

  function showIdle() {
    stage().hidden = true;
    idleScreen().hidden = false;
    clearTimeout(advanceTimer);
    currentIndex = -1;
  }

  /** Fully halts playback, e.g. when this device's credentials are revoked server-side. */
  function stop() {
    clearTimeout(advanceTimer);
    running = false;
    currentIndex = -1;
    playlist = null;
    stage().hidden = true;
    idleScreen().hidden = true;
  }

  function start() {
    if (running) return;
    running = true;
    idleScreen().hidden = true;
    stage().hidden = false;
    requestFullscreenBestEffort();
    currentIndex = -1;
    playNext();
  }

  function fitClass(mode) {
    return mode === 'contain' ? 'fit-contain' : mode === 'stretch' ? 'fit-stretch' : 'fit-cover';
  }

  async function playNext() {
    if (!playlist || !playlist.items || !playlist.items.length) {
      showIdle();
      return;
    }

    transitionEffect = playlist.transition_effect || playlist.transitionEffect || 'fade';
    transitionDurationMs = playlist.transition_duration_ms || playlist.transitionDurationMs || 800;

    currentIndex += 1;
    if (currentIndex >= playlist.items.length) {
      if (playlist.loop_playlist === 0 || playlist.loopPlaylist === false) {
        showIdle();
        return;
      }
      currentIndex = 0;
    }

    const item = playlist.items[currentIndex];
    const nextLayerIndex = (activeLayerIndex + 1) % 2;
    const incoming = layers[nextLayerIndex];
    const outgoing = layers[activeLayerIndex];

    incoming.innerHTML = '';
    incoming.className = `layer ${fitClass(item.imageFitMode)} hidden-layer`;

    let url;
    try {
      url = await DSSync.resolveItemUrl(item);
    } catch (err) {
      console.error('[player] could not resolve media URL, skipping item', err);
      playNext();
      return;
    }

    setStatus(`${currentIndex + 1}/${playlist.items.length} · ${item.title}`);

    // Both branches below wait for the media to actually be ready to paint
    // before starting the fade-in. Previously the transition started the
    // instant the element was created, so on a slow network or a weak TV
    // CPU the layer could turn "visible" while still blank/buffering — the
    // image or video then visibly popped in partway through (or after) the
    // fade, which read as "it's slow/delayed". A short safety timeout still
    // lets playback move on if one file is unusually slow, so a single
    // large/slow item can never stall the whole loop.
    const READY_TIMEOUT_MS = 8000;

    if (item.fileType === 'video') {
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = false;
      video.playsInline = true;
      video.preload = 'auto'; // buffer as aggressively as the browser allows, in case this item is streaming live rather than playing from the local cache
      video.onended = () => scheduleNext(0);
      video.onerror = () => { console.error('[player] video failed to play, skipping', item); scheduleNext(0); };
      video.addEventListener('waiting', () => console.warn('[player] video buffering (ran out of data) mid-playback', item.title));
      incoming.appendChild(video);

      let revealed = false;
      const reveal = () => {
        if (revealed) return;
        revealed = true;
        clearTimeout(readyTimer);
        transitionTo(incoming, outgoing, nextLayerIndex);
        video.play().catch(() => { /* autoplay-with-sound can be blocked; fall back to muted */
          video.muted = true;
          video.play().catch((e) => console.error('[player] video play failed even muted', e));
        });
        // Safety net in case "ended" never fires (corrupt file, stalled network).
        // This must NEVER cut a normal video short, so it is decoupled from
        // the (often inaccurate/default) displayDurationSeconds value. Start
        // with a generous fixed ceiling that only catches a genuinely
        // stuck/corrupt file, then tighten it to the video's *real* length
        // (plus a buffer) once the browser reports it — whichever is more
        // accurate, never shorter than the actual content.
        const FALLBACK_SAFETY_MS = 20 * 60 * 1000; // 20 minutes — well beyond any real ad
        advanceTimer = setTimeout(() => scheduleNext(0), FALLBACK_SAFETY_MS);
        if (Number.isFinite(video.duration) && video.duration > 0) {
          clearTimeout(advanceTimer);
          advanceTimer = setTimeout(() => scheduleNext(0), (video.duration + 15) * 1000);
        } else {
          video.addEventListener('loadedmetadata', () => {
            if (Number.isFinite(video.duration) && video.duration > 0) {
              clearTimeout(advanceTimer);
              advanceTimer = setTimeout(() => scheduleNext(0), (video.duration + 15) * 1000);
            }
          });
        }
      };
      const readyTimer = setTimeout(() => {
        console.warn('[player] video took too long to buffer, showing anyway', item);
        reveal();
      }, READY_TIMEOUT_MS);
      video.addEventListener('loadeddata', reveal); // first frame is available — safe to reveal
      video.src = url;
    } else {
      const img = document.createElement('img');
      img.onerror = () => { console.error('[player] image failed to load, skipping', item); clearTimeout(readyTimer); scheduleNext(0); };
      incoming.appendChild(img);

      let revealed = false;
      const reveal = () => {
        if (revealed) return;
        revealed = true;
        clearTimeout(readyTimer);
        transitionTo(incoming, outgoing, nextLayerIndex);
        const durationMs = (item.displayDurationSeconds || 10) * 1000;
        advanceTimer = setTimeout(() => scheduleNext(0), durationMs);
      };
      const readyTimer = setTimeout(() => {
        console.warn('[player] image took too long to become ready, showing anyway', item);
        reveal();
      }, READY_TIMEOUT_MS);

      img.src = url;
      if (img.decode) {
        // decode() confirms the bitmap is actually ready to paint, not just
        // downloaded — this is what avoids the janky first-frame some
        // browsers show if you reveal right after `load`. Some embedded TV
        // browsers can reject a decodable image anyway, so fall through to
        // reveal() rather than getting stuck.
        img.decode().then(reveal).catch(reveal);
      } else {
        img.onload = reveal;
      }
    }
  }

  function scheduleNext(delayMs) {
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(playNext, delayMs);
  }

  function transitionTo(incoming, outgoing, nextLayerIndex) {
    if (transitionEffect === 'none') {
      incoming.style.transitionDuration = '0ms';
      outgoing.style.transitionDuration = '0ms';
    } else {
      incoming.style.transitionDuration = transitionDurationMs + 'ms';
      outgoing.style.transitionDuration = transitionDurationMs + 'ms';
    }

    requestAnimationFrame(() => {
      incoming.classList.remove('hidden-layer');
      incoming.classList.add('visible');
      outgoing.classList.remove('visible');
      outgoing.classList.add('hidden-layer');
    });

    setTimeout(() => {
      outgoing.innerHTML = '';
    }, transitionEffect === 'none' ? 0 : transitionDurationMs + 50);

    activeLayerIndex = nextLayerIndex;
  }

  global.DSPlayer = { init, setPlaylist, start, showIdle, stop, requestFullscreenBestEffort };
})(window);
