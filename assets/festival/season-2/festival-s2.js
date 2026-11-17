(() => {
  'use strict';
  const items = JSON.parse(document.getElementById('s2-data').textContent);
  const dialog = document.getElementById('s2-media-dialog');
  const video = document.getElementById('s2-detail-video');
  const trailer = document.getElementById('s2-trailer');
  const title = document.getElementById('s2-dialog-title');
  const error = document.getElementById('s2-dialog-error');
  const fallback = document.getElementById('s2-dialog-fallback');
  let active = null;
  let opener = null;
  function begin() {
    if (!active || !dialog.open) return;
    video.play().catch(() => {});
  }
  document.querySelectorAll('[data-watch]').forEach(link => {
    link.addEventListener('click', event => {
      if (!dialog.showModal) return;
      const item = items.find(entry => entry.id === link.dataset.watch);
      if (!item) return;
      event.preventDefault();
      active = item;
      opener = link;
      trailer.pause();
      title.textContent = item.name;
      video.setAttribute('aria-label', item.name + '實裝片段');
      video.poster = '/assets/festival/season-2/' + item.id + '.jpg';
      fallback.href = link.href;
      error.hidden = true;
      dialog.showModal();
      document.getElementById('s2-close-dialog').focus();
      video.src = '/assets/festival/season-2/' + item.clip;
      video.addEventListener('loadeddata', begin, {once:true});
      video.load();
    });
  });
  video.addEventListener('error', () => {error.hidden = false;});
  document.getElementById('s2-close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    video.pause();
    active = null;
    opener?.focus({preventScroll:true});
  });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
})();
