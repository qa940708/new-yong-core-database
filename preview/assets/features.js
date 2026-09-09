(() => {
  'use strict';

  const base = new URL('../', document.currentScript.src);
  const tabs = document.querySelector('#feature-tabs');
  const detail = document.querySelector('#feature-detail');
  const updated = document.querySelector('#updated');
  const showFeatures = document.querySelector('#show-features');
  let features = [];
  let activeId = '';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);

  const mediaUrl = (path) => {
    const url = new URL(path, base);
    return url.origin === location.origin && url.protocol === location.protocol ? url.href : '';
  };

  const formatDuration = (seconds) => {
    const rounded = Math.round(Number(seconds) || 0);
    return rounded >= 60
      ? `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`
      : `${rounded} 秒`;
  };

  const stopVideo = () => {
    const video = detail.querySelector('video');
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
  };

  const renderMedia = (feature, media) => {
    const video = detail.querySelector('#feature-video');
    const caption = detail.querySelector('#media-caption');
    if (!video || !caption) return;
    video.pause();
    video.poster = mediaUrl(media.poster);
    video.src = mediaUrl(media.url);
    video.load();
    caption.innerHTML = `<strong>${escapeHtml(media.label || `${feature.name}操作`)}</strong><span>${formatDuration(media.duration)}・實機錄影・無旁白</span>`;
    detail.querySelectorAll('.media-switch').forEach((button) => {
      const selected = button.dataset.media === (media === feature.extraMedia ? 'extra' : 'main');
      button.setAttribute('aria-pressed', String(selected));
    });
  };

  const renderFeature = (feature) => {
    stopVideo();
    const number = String(features.indexOf(feature) + 1).padStart(2, '0');
    const media = feature.media;
    const switches = feature.extraMedia ? `
      <div class="media-switches" aria-label="切換教學影片">
        <button class="media-switch" type="button" data-media="main" aria-pressed="true">功能總覽</button>
        <button class="media-switch" type="button" data-media="extra" aria-pressed="false">${escapeHtml(feature.extraMedia.label)}</button>
      </div>` : '';
    const guideLink = feature.link
      ? `<a class="feature-link" href="${escapeHtml(new URL(feature.link, location.href).href)}">查看完整奧義技能資料 <span aria-hidden="true">→</span></a>`
      : '';

    detail.innerHTML = `
      <article class="feature-card" role="tabpanel" aria-labelledby="tab-${escapeHtml(feature.id)}">
        <div class="feature-media">
          ${switches}
          <video id="feature-video" controls playsinline preload="metadata" poster="${escapeHtml(mediaUrl(media.poster))}" src="${escapeHtml(mediaUrl(media.url))}">
            您的瀏覽器不支援影片播放。
          </video>
          <div id="media-caption" class="media-caption"><strong>${escapeHtml(feature.name)}操作</strong><span>${formatDuration(media.duration)}・實機錄影・無旁白</span></div>
        </div>
        <div class="feature-copy">
          <div class="feature-heading"><span>${number}</span><div><p>${escapeHtml(feature.alias)}</p><h3>${escapeHtml(feature.name)}</h3></div></div>
          <p class="feature-summary">${escapeHtml(feature.summary)}</p>
          <div class="location-box"><span>功能入口</span><strong>${escapeHtml(feature.location)}</strong></div>
          <h4>操作步驟</h4>
          <ol>${feature.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
          <h4>注意事項</h4>
          <ul>${feature.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>
          ${guideLink}
        </div>
      </article>`;

    detail.querySelectorAll('.media-switch').forEach((button) => {
      button.addEventListener('click', () => renderMedia(feature, button.dataset.media === 'extra' ? feature.extraMedia : feature.media));
    });
  };

  const selectFeature = (id, focus = false) => {
    const feature = features.find((item) => item.id === id) || features[0];
    if (!feature) return;
    activeId = feature.id;
    tabs.querySelectorAll('[role="tab"]').forEach((tab) => {
      const selected = tab.dataset.id === activeId;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    renderFeature(feature);
    const url = new URL(location.href);
    url.searchParams.set('feature', activeId);
    history.replaceState(null, '', url);
    if (focus) tabs.querySelector(`[data-id="${CSS.escape(activeId)}"]`)?.focus();
  };

  const renderTabs = () => {
    tabs.innerHTML = features.map((feature, index) => `
      <button type="button" role="tab" id="tab-${escapeHtml(feature.id)}" data-id="${escapeHtml(feature.id)}" aria-selected="false" tabindex="-1">
        <span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(feature.name)}</strong><small>${escapeHtml(feature.alias)}</small>
      </button>`).join('');
    tabs.addEventListener('click', (event) => {
      const button = event.target.closest('[role="tab"]');
      if (button) selectFeature(button.dataset.id, true);
    });
    tabs.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const current = features.findIndex((feature) => feature.id === activeId);
      let next = current;
      if (event.key === 'ArrowLeft') next = (current - 1 + features.length) % features.length;
      if (event.key === 'ArrowRight') next = (current + 1) % features.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = features.length - 1;
      selectFeature(features[next].id, true);
    });
  };

  showFeatures?.addEventListener('click', () => {
    document.querySelector('#feature-browser')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => tabs.querySelector('[aria-selected="true"]')?.focus(), 500);
  });

  fetch(new URL('features/data.json?v=feature-preview-v2', base), { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      features = Array.isArray(data.features) ? data.features : [];
      if (!features.length) throw new Error('功能資料為空');
      updated.textContent = `功能導覽 PREVIEW v2｜實機素材 ${data.updated || ''}`;
      renderTabs();
      selectFeature(new URLSearchParams(location.search).get('feature') || features[0].id);
    })
    .catch(() => {
      detail.innerHTML = '<div class="empty">功能資料暫時無法載入，請稍後重新整理頁面。</div>';
      updated.textContent = '功能資料載入失敗';
    });
})();
