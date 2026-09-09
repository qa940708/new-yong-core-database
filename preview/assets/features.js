(() => {
  'use strict';

  const base = new URL('../', document.currentScript.src);
  const tabs = document.querySelector('#feature-tabs');
  const categoryButtons = document.querySelector('#feature-categories');
  const categoryCount = document.querySelector('#category-count');
  const detail = document.querySelector('#feature-detail');
  const updated = document.querySelector('#updated');
  const showFeatures = document.querySelector('#show-features');
  let features = [];
  let activeId = '';
  let activeCategory = '';
  const categories = [
    { id: 'daily', name: '日常便利' },
    { id: 'growth', name: '角色養成' },
    { id: 'battle', name: '戰況查詢' }
  ];
  const visibleFeatures = () => features.filter((feature) => feature.category === activeCategory);

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
      <article id="panel-${escapeHtml(feature.id)}" class="feature-card" role="tabpanel" tabindex="0" aria-labelledby="tab-${escapeHtml(feature.id)}">
        <div class="feature-media">
          ${switches}
          <video id="feature-video" controls playsinline preload="none" poster="${escapeHtml(mediaUrl(media.poster))}" src="${escapeHtml(mediaUrl(media.url))}">
            您的瀏覽器不支援影片播放。
          </video>
          <div id="media-caption" class="media-caption"><strong>${escapeHtml(feature.name)}操作</strong><span>${formatDuration(media.duration)}・實機錄影・無旁白</span></div>
        </div>
        <div class="feature-copy">
          <div class="feature-heading">${feature.icon ? `<img class="feature-icon" src="${escapeHtml(mediaUrl(feature.icon))}" width="34" height="34" alt="">` : `<span class="feature-number">${number}</span>`}<h3>${escapeHtml(feature.name)}</h3></div>
          <p class="feature-summary">${escapeHtml(feature.summary)}</p>
          <div class="location-box"><span>功能入口</span><strong>${escapeHtml(feature.location)}</strong></div>
          <h4>操作步驟</h4>
          <ol class="feature-steps">${feature.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
          <details class="feature-notes guide-disclosure"><summary>注意事項<span class="disclosure-hint">${feature.tips.length} 則</span></summary>
          <ul class="feature-tips">${feature.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul></details>
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
    activeCategory = feature.category;
    renderCategories();
    renderTabs();
    tabs.querySelectorAll('[role="tab"]').forEach((tab) => {
      const selected = tab.dataset.id === activeId;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) tab.setAttribute('aria-controls', `panel-${activeId}`);
      else tab.removeAttribute('aria-controls');
    });
    renderFeature(feature);
    const url = new URL(location.href);
    url.searchParams.set('feature', activeId);
    history.replaceState(null, '', url);
    if (focus) tabs.querySelector(`[data-id="${CSS.escape(activeId)}"]`)?.focus({ preventScroll: true });
  };

  const renderTabs = () => {
    tabs.setAttribute('aria-label', `${categories.find((category) => category.id === activeCategory)?.name || ''}功能`);
    tabs.innerHTML = visibleFeatures().map((feature) => `
      <button class="feature-tab" type="button" role="tab" id="tab-${escapeHtml(feature.id)}" data-id="${escapeHtml(feature.id)}" aria-selected="false" tabindex="-1">
        ${feature.icon ? `<img class="tab-icon" src="${escapeHtml(mediaUrl(feature.icon))}" width="34" height="34" alt="">` : ''}<strong>${escapeHtml(feature.name)}</strong>
      </button>`).join('');
  };

  const renderCategories = () => {
    categoryButtons.innerHTML = categories.map((category) => `
      <button type="button" class="category-button" data-category="${category.id}" aria-pressed="${category.id === activeCategory}">${category.name}<span>${features.filter((feature) => feature.category === category.id).length}</span></button>`).join('');
    categoryCount.textContent = `${categories.find((category) => category.id === activeCategory)?.name || ''}・${visibleFeatures().length} 項功能`;
  };

  categoryButtons.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    const feature = features.find((item) => item.category === button.dataset.category);
    if (feature) {
      selectFeature(feature.id);
      categoryButtons.querySelector(`[data-category="${CSS.escape(activeCategory)}"]`)?.focus({ preventScroll: true });
    }
  });

  tabs.addEventListener('click', (event) => {
      const button = event.target.closest('[role="tab"]');
      if (button) selectFeature(button.dataset.id, true);
    });
    tabs.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const items = visibleFeatures();
      const current = items.findIndex((feature) => feature.id === activeId);
      let next = current;
      if (event.key === 'ArrowLeft') next = (current - 1 + items.length) % items.length;
      if (event.key === 'ArrowRight') next = (current + 1) % items.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = items.length - 1;
      selectFeature(items[next].id, true);
    });

  const revealGuide = () => {
    document.querySelector('.interface-map')?.removeAttribute('open');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('#feature-browser')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    tabs.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
  };

  showFeatures?.addEventListener('click', () => {
    selectFeature('item-shop');
    revealGuide();
  });

  document.querySelectorAll('[data-feature]').forEach((button) => {
    button.addEventListener('click', () => {
      selectFeature(button.dataset.feature);
      revealGuide();
    });
  });

  fetch(new URL('features/data.json?v=feature-preview-v5', base), { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      features = Array.isArray(data.features) ? data.features : [];
      if (!features.length) throw new Error('功能資料為空');
      updated.textContent = `${features.length} 項功能・PREVIEW v5`;
      selectFeature(new URLSearchParams(location.search).get('feature') || features[0].id);
    })
    .catch(() => {
      detail.innerHTML = '<div class="empty">功能資料暫時無法載入，請稍後重新整理頁面。</div>';
      updated.textContent = '功能資料載入失敗';
    });
})();
