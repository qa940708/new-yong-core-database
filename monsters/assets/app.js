(() => {
  'use strict';
  const { monsters, maps } = window.MONSTER_DATA;
  const $ = id => document.getElementById(id);
  const nf = new Intl.NumberFormat('zh-TW');
  const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const byKey = new Map(monsters.map(m => [m.key, m]));
  const pin = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  const missing = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M17 14h30v36H17zM24 26l8-5 8 5v12l-8 5-8-5zM24 26l8 5 8-5M32 31v12"/></svg>';
  const initial = new URLSearchParams(location.search).get('monster');
  let selected = byKey.has(initial) ? initial : monsters[0].key;
  let filtered = [], limit = 40;
  maps.forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; $('map-filter').append(option); });
  function locationCard(l) {
    const timing = l.respawns.length && !l.timingIncomplete ? l.respawns.join(' / ') + ' 秒' : '依遊戲設定';
    return `<article class="location-card"><span class="area">${esc(l.area)}</span><h4><button type="button" data-map="${esc(l.name)}" title="查看${esc(l.name)}的其他怪物">${esc(l.name)}</button></h4><p><span>重生間隔</span><b>${esc(timing)}</b></p></article>`;
  }
  function showDetail(m) {
    const model = m.image ? `<button type="button" class="model-open" id="open-image" aria-label="放大${esc(m.name)}的外觀"><img src="${m.image}" width="600" height="600" alt="${esc(m.name)}的遊戲模型靜態外觀"></button><span class="model-caption">點圖放大・靜態外觀</span>${m.partialImage ? '<p class="partial-note">部分配件未呈現</p>' : ''}` : `<div class="model-placeholder">${missing}<strong>外觀待補</strong><small>能力與出沒資料仍可查詢</small></div>`;
    const locations = m.locations.length ? `<div class="location-cards">${m.locations.slice(0,6).map(locationCard).join('')}</div>${m.locations.length > 6 ? `<details class="location-more"><summary>展開其餘 ${m.locations.length-6} 處出沒地點</summary><div class="location-cards">${m.locations.slice(6).map(locationCard).join('')}</div></details>` : ''}` : '<p class="locations-none">目前尚無可確認的出沒地點。<br>活動、召喚或副本出現方式，請以遊戲內資訊與公告為準。</p>';
    $('detail-panel').innerHTML = `<div class="detail-heading"><div><div class="overline">MONSTER PROFILE</div><h2>${esc(m.name)}</h2></div><div class="level-badge" aria-label="等級 ${m.level}"><span>LV.</span><strong>${m.level}</strong></div></div>
      <div class="monster-body"><div class="model-stage">${model}</div>
      <section class="stats-section" aria-label="怪物能力值"><div class="section-kicker"><h3>能力與經驗</h3><span>COMBAT STATS</span></div><div class="main-stats"><div class="main-stat"><span>生命值 HP</span><strong>${nf.format(m.hp)}</strong></div><div class="main-stat exp"><span>基礎經驗 EXP</span><strong>${nf.format(m.exp)}</strong></div></div><div class="stats-grid">${[['防禦力',m.defense],['命中',m.hit],['迴避',m.avoid],['魔力 MP',m.mp],['體力 SP',m.sp],['等級',m.level]].map(([name,value])=>`<div class="stat-cell"><span>${name}</span><strong>${nf.format(value)}</strong></div>`).join('')}</div><p class="stat-note">經驗值為基礎設定，未計入遊戲中的加成。</p></section></div>
      <section class="locations-section"><div class="locations-heading"><h3>${pin} 出沒地點</h3><span>${m.locations.length ? m.locations.length+' 處已知地點' : '待補資料'}</span></div>${locations}</section><div class="detail-foot"><span>${m.image ? '遊戲原始外觀・未呈現動作與特效' : '外觀資料持續整理中'}</span><span>YONG ORIGIN · MONSTER ARCHIVE</span></div>`;
    if (m.image) $('open-image').addEventListener('click', () => {
      $('image-title').textContent = m.name; $('large-image').src = m.image; $('large-image').alt = m.name + '的靜態外觀'; $('image-dialog').showModal();
    });
    const url = new URL(location.href); url.searchParams.set('monster', m.key);
    try { history.replaceState(null, '', url); } catch {}
  }
  function renderList() {
    $('monster-list').innerHTML = filtered.slice(0,limit).map(m=>`<button type="button" class="monster-row" data-key="${m.key}" aria-pressed="${m.key===selected}" aria-label="${esc(m.name)}，等級 ${m.level}"><span class="row-thumb">${m.thumb ? `<img src="${m.thumb}" width="88" height="88" alt="" loading="lazy">` : '<span class="thumb-empty" aria-hidden="true">◇</span>'}</span><span class="row-copy"><strong>${esc(m.name)}</strong><span><b>Lv. ${m.level}</b> · ${esc(m.locations[0]?.name || '出沒地點待補')}</span></span><span class="row-chevron" aria-hidden="true">›</span></button>`).join('');
    $('load-more').hidden = limit >= filtered.length;
    $('load-more').textContent = `再顯示 ${Math.min(40, filtered.length-limit)} 隻（已顯示 ${Math.min(limit,filtered.length)} 隻）`;
  }
  function update({initialLoad=false}={}) {
    const terms = $('search').value.trim().toLocaleLowerCase('zh-TW').split(/\s+/).filter(Boolean);
    const map = $('map-filter').value, level = $('level-filter').value;
    const [lo,hi] = level.split('-').map(Number);
    filtered = monsters.filter(m => terms.every(q => (m.name+' '+m.locations.map(l=>l.name).join(' ')).toLocaleLowerCase('zh-TW').includes(q)) && (!map || m.locations.some(l => l.name === map)) && (!level || (m.level >= lo && m.level <= hi)) && (!$('located-only').checked || m.locations.length));
    const sort = $('sort-filter').value;
    if (sort==='level-asc') filtered.sort((a,b)=>a.level-b.level);
    if (sort==='level-desc') filtered.sort((a,b)=>b.level-a.level);
    if (sort==='exp-desc') filtered.sort((a,b)=>b.exp-a.exp);
    if (sort==='name') filtered.sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
    limit = 40;
    if (initialLoad && filtered.some(m=>m.key===selected)) limit = Math.max(40,Math.ceil((filtered.findIndex(m=>m.key===selected)+1)/40)*40);
    else if (!filtered.slice(0,limit).some(m=>m.key===selected)) selected = filtered[0]?.key;
    $('result-count').textContent = `${nf.format(filtered.length)} / ${nf.format(monsters.length)} 隻`;
    $('filter-summary').textContent = `找到 ${nf.format(filtered.length)} 隻怪物${map ? ' · '+map : ''}`;
    document.querySelector('.catalogue-layout').hidden = !filtered.length;
    $('empty-panel').hidden = !!filtered.length;
    $('detail-panel').hidden = !filtered.length;
    renderList();
    $('monster-list').scrollTop = 0;
    if (filtered.length) showDetail(byKey.get(selected));
    else $('detail-panel').innerHTML = '';
  }
  $('load-more').addEventListener('click', () => {
    const oldLimit = limit; limit += 40; renderList();
    const firstNew = $('monster-list').querySelectorAll('.monster-row')[oldLimit];
    if (firstNew) { firstNew.focus({preventScroll:true}); $('monster-list').scrollTop = firstNew.offsetTop - $('monster-list').offsetTop; }
  });
  $('monster-list').addEventListener('click', e => {
    const button = e.target.closest('[data-key]'); if (!button) return;
    selected = button.dataset.key;
    document.querySelectorAll('.monster-row').forEach(row=>row.setAttribute('aria-pressed',String(row.dataset.key===selected)));
    const m = byKey.get(selected); showDetail(m); $('announcement').textContent = `已顯示 ${m.name}的詳細資料`;
    if (matchMedia('(max-width:600px)').matches) $('detail-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
  });
  $('detail-panel').addEventListener('click', e => {
    const button = e.target.closest('[data-map]'); if (!button) return;
    $('search').value = ''; $('level-filter').value = ''; $('map-filter').value = button.dataset.map; update(); $('map-filter').focus();
  });
  $('filters').addEventListener('submit', e=>e.preventDefault());
  $('search').addEventListener('input', ()=>update());
  ['map-filter','level-filter','sort-filter','located-only'].forEach(id=>$(id).addEventListener('change',()=>update()));
  function reset() { $('search').value=''; $('map-filter').value=''; $('level-filter').value=''; $('sort-filter').value='default'; $('located-only').checked=false; selected=monsters[0].key; update(); $('search').focus(); }
  $('reset').addEventListener('click',reset); $('empty-reset').addEventListener('click',reset);
  $('close-image').addEventListener('click',()=>$('image-dialog').close());
  $('image-dialog').addEventListener('click',e=>{ if(e.target===$('image-dialog')) {const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.target.close();} });
  document.addEventListener('error', e=>{
    if (e.target.tagName==='IMG' && e.target.closest('.model-open')) {e.target.closest('.model-stage').innerHTML=`<div class="model-placeholder">${missing}<strong>圖片暫時無法載入</strong><small>重新整理頁面再試一次</small></div>`;}
  },true);
  update({initialLoad:true});
})();
