(() => {
  'use strict';
  const video = document.querySelector('#guide-video');
  const error = document.querySelector('#guide-video-error');
  const chapters = Array.from(document.querySelectorAll('.chapter-button'));
  if (!video) return;
  const reflectChapter = () => {
    chapters.forEach(button => {
      const active = video.currentTime >= Number(button.dataset.seek) && video.currentTime < Number(button.dataset.end);
      if (active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  };
  document.querySelectorAll('[data-seek]').forEach(button => {
    button.addEventListener('click', () => {
      const seek = () => {
        video.currentTime = Number(button.dataset.seek);
        reflectChapter();
        video.play().catch(() => {});
      };
      if (video.readyState >= 1) seek();
      else {
        video.addEventListener('loadedmetadata', seek, { once: true });
        video.load();
      }
    });
  });
  video.addEventListener('timeupdate', reflectChapter);
  video.addEventListener('loadedmetadata', () => { error.hidden = true; reflectChapter(); });
  video.addEventListener('error', () => { error.hidden = false; });
  video.querySelector('source')?.addEventListener('error', () => { error.hidden = false; });
})();
