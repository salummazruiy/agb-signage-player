/**
 * Thin fetch wrapper for talking to the Digital Signage backend.
 * Global `DSApi` object.
 */
(function (global) {
  function apiBase() {
    const meta = document.querySelector('meta[name="ds-api-base"]');
    const configured = meta && meta.getAttribute('content');
    return configured && configured.trim() ? configured.trim().replace(/\/$/, '') : '';
  }

  async function request(path, { method = 'GET', body, token, isForm = false } = {}) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body && !isForm) headers['Content-Type'] = 'application/json';

    const res = await fetch(apiBase() + path, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined
    });

    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }

    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed: ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function register(pairingCode, playerVersion, screenResolution) {
    return request('/api/player/register', {
      method: 'POST',
      body: { pairingCode, playerVersion, screenResolution }
    });
  }

  function heartbeat(token, playerVersion, screenResolution) {
    return request('/api/player/heartbeat', {
      method: 'POST',
      token,
      body: { playerVersion, screenResolution }
    });
  }

  function getConfig(token, deviceId) {
    return request(`/api/player/${deviceId}/config`, { token });
  }

  function getPlaylist(token, deviceId) {
    return request(`/api/player/${deviceId}/playlist`, { token });
  }

  function getContent(token, deviceId) {
    return request(`/api/player/${deviceId}/content`, { token });
  }

  function reportSync(token, deviceId, payload) {
    return request(`/api/player/${deviceId}/sync`, { method: 'POST', token, body: payload });
  }

  async function downloadMedia(url) {
    const res = await fetch(apiBase() + url);
    if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
    return res.blob();
  }

  global.DSApi = { apiBase, register, heartbeat, getConfig, getPlaylist, getContent, reportSync, downloadMedia };
})(window);
