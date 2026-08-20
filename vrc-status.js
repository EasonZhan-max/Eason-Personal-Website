(() => {
  const card = document.getElementById('vrcStatusCard');
  if (!card) return;

  const endpoint = document.querySelector('meta[name="vrc-status-endpoint"]')?.content.trim() || '';
  const refs = {
    cover: document.getElementById('vrcCover'),
    avatar: document.getElementById('vrcAvatar'),
    displayName: document.getElementById('vrcDisplayName'),
    pronouns: document.getElementById('vrcPronouns'),
    statusText: document.getElementById('vrcStatusText'),
    bio: document.getElementById('vrcBio'),
    badges: document.getElementById('vrcBadges'),
    groups: document.getElementById('vrcGroups'),
    liveMeta: document.getElementById('vrcLiveMeta'),
    world: document.getElementById('vrcWorld'),
    duration: document.getElementById('vrcDuration'),
    updated: document.getElementById('vrcUpdated')
  };

  const statusLabels = {
    active: '在线',
    'join me': '可加入',
    'ask me': '请求加入',
    busy: '忙碌',
    offline: '离线'
  };

  let durationBaseSeconds = 0;
  let durationBaseAt = 0;
  let lastUpdatedAt = 0;
  let hasLiveData = false;

  const safeText = (value, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;

  const safeImageUrl = (value) => {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
        ? url.href
        : '';
    } catch (error) {
      return '';
    }
  };

  const setImage = (element, value) => {
    const url = safeImageUrl(value);
    if (element && url && element.src !== url) element.src = url;
  };

  const formatDuration = (seconds) => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours} 小时 ${minutes} 分钟`;
    return `${minutes} 分钟`;
  };

  const formatUpdated = (timestamp) => {
    if (!timestamp) return '刚刚更新';
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 10) return '刚刚更新';
    if (seconds < 60) return `${seconds} 秒前更新`;
    const minutes = Math.floor(seconds / 60);
    return minutes < 60 ? `${minutes} 分钟前更新` : '状态更新较早';
  };

  const renderBadges = (items) => {
    if (!refs.badges) return;
    refs.badges.replaceChildren();
    const badges = Array.isArray(items) ? items.slice(0, 8) : [];
    badges.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const imageUrl = safeImageUrl(item.image);
      if (!imageUrl) return;
      const badge = document.createElement('span');
      badge.className = 'vrc-badge-item';
      badge.title = safeText(item.name, 'VRChat 徽章');
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = badge.title;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => badge.remove(), { once: true });
      badge.appendChild(image);
      refs.badges.appendChild(badge);
    });
    refs.badges.hidden = refs.badges.childElementCount === 0;
  };

  const renderGroups = (items) => {
    if (!refs.groups) return;
    refs.groups.replaceChildren();
    const groups = Array.isArray(items) ? items.slice(0, 3) : [];
    groups.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const groupName = safeText(item.name);
      if (!groupName) return;
      const row = document.createElement('div');
      row.className = 'vrc-group-row';
      const imageUrl = safeImageUrl(item.icon);
      if (imageUrl) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => image.remove(), { once: true });
        row.appendChild(image);
      }
      const label = document.createElement('span');
      label.textContent = groupName;
      row.appendChild(label);
      refs.groups.appendChild(row);
    });
    refs.groups.hidden = refs.groups.childElementCount === 0;
  };

  const render = (data) => {
    if (!data || data.available === false || !data.profile) return;
    const profile = data.profile;
    const online = Boolean(data.online ?? profile.online);
    const availability = safeText(profile.status || profile.availability, online ? 'active' : 'offline').toLowerCase();
    const customStatus = online ? safeText(profile.status_description) : '';

    hasLiveData = true;
    card.dataset.online = String(online);
    card.dataset.status = availability.replace(/\s+/g, '-');
    refs.displayName.textContent = safeText(profile.display_name, 'EasonZhan');

    const pronouns = safeText(profile.pronouns);
    refs.pronouns.textContent = pronouns;
    refs.pronouns.hidden = !pronouns;
    refs.statusText.textContent = customStatus || statusLabels[availability] || (online ? '在线' : '离线');
    refs.bio.textContent = safeText(profile.bio, refs.bio.textContent);
    setImage(refs.avatar, profile.avatar_url);
    setImage(refs.cover, profile.cover_url || profile.avatar_url);
    renderBadges(profile.badges);
    renderGroups(profile.groups);

    const world = online ? safeText(profile.world_label) : '';
    const baseSeconds = Number(profile.session_seconds);
    durationBaseSeconds = Number.isFinite(baseSeconds) && baseSeconds >= 0 ? baseSeconds : 0;
    durationBaseAt = Date.now();
    refs.world.textContent = world || '未知世界';
    refs.duration.textContent = formatDuration(durationBaseSeconds);
    refs.liveMeta.hidden = !online || !world;

    const updated = Date.parse(data.updated_at || profile.updated_at || '');
    lastUpdatedAt = Number.isFinite(updated) ? updated : Date.now();
    refs.updated.textContent = formatUpdated(lastUpdatedAt);
  };

  const refresh = async () => {
    if (!endpoint) return;
    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      render(payload && payload.data ? payload.data : payload);
    } catch (error) {
      if (!hasLiveData) refs.updated.textContent = '状态服务暂时不可用';
      console.warn('VRChat status refresh failed:', error);
    }
  };

  window.setInterval(() => {
    if (!refs.liveMeta.hidden && card.dataset.online === 'true') {
      const elapsed = durationBaseSeconds + Math.floor((Date.now() - durationBaseAt) / 1000);
      refs.duration.textContent = formatDuration(elapsed);
    }
    if (lastUpdatedAt) refs.updated.textContent = formatUpdated(lastUpdatedAt);
  }, 1000);

  if (endpoint) {
    refresh();
    window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refresh();
    });
  }
})();
