(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { groupItems, search, normalize } = window.ItemDropSearch;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nf = new Intl.NumberFormat('zh-TW');
  const pin = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
  let groups = [], monsters = new Map(), items = new Map(), filtered = [], selected = '', limit = 60;
  let ready = false, composing = false, timer, selectedMap = '', sourceLimit = 24;
  const keysFor = item => [...item.sourceKeys, ...item.conditionalSourceKeys];
  const safeImage = value => /^\/monsters\/assets\/[a-zA-Z0-9_./-]+\.(?:webp|png|jpg)$/.test(value || '') ? value : '';
  const sourceList = item => keysFor(item).map(key => monsters.get(key)).filter(Boolean).sort((a,b) => a.level-b.level || a.name.localeCompare(b.name,'zh-Hant'));
  const mapNames = item => [...new Set(sourceList(item).flatMap(m => m.locations.map(l => l.name)))].sort((a,b) => a.localeCompare(b,'zh-Hant'));
  function setURL() {
    const url = new URL(location.href);
    for (const key of ['q','type','item','map']) url.searchParams.delete(key);
    if ($('item-query').value.trim()) url.searchParams.set('q', $('item-query').value.trim());
    if ($('item-type').value) url.searchParams.set('type', $('item-type').value);
    if (selected) url.searchParams.set('item', selected);
    if (selectedMap) url.searchParams.set('map', selectedMap);
    history.replaceState(null, '', url);
  }
  function renderResults() {
    $('item-results').innerHTML = filtered.slice(0, limit).map(item => {
      const count = keysFor(item).length;
      return `<button type="button" class="item-row" data-item="${esc(item.key)}" aria-pressed="${item.key === selected}"><span class="item-row-symbol" aria-hidden="true">◇</span><span class="item-row-copy"><strong>${esc(item.name)}</strong><small>${esc(item.type)}<span>${count ? `${count} 種怪物來源` : '來源尚未收錄'}</span></small></span><span class="row-arrow" aria-hidden="true">›</span></button>`;
    }).join('');
    $('more-items').hidden = limit >= filtered.length;
    $('more-items').textContent = `再顯示 ${Math.min(60, filtered.length-limit)} 筆道具`;
  }
  function sourceCard(monster, conditional) {
    const image = safeImage(monster.thumb || monster.image);
    const locations = monster.locations.filter(l => !selectedMap || l.name === selectedMap);
    return `<article class="drop-source"><div class="source-head"><div class="source-thumb">${image ? `<img src="${esc(image)}" alt="" width="88" height="88" loading="lazy">` : '<span aria-hidden="true">◇</span>'}</div><div class="source-title"><span>Lv. ${esc(monster.level)}</span><h3>${esc(monster.name)}</h3>${conditional ? '<small class="condition-label">特殊條件來源</small>' : ''}</div><a class="monster-detail-link" href="/monsters/?monster=${encodeURIComponent(monster.key)}" aria-label="查看${esc(monster.name)}的怪物資料">怪物資料 <span aria-hidden="true">↗</span></a></div><div class="source-locations">${locations.map(location => `<div class="location-line">${pin}<div><strong>${esc(location.name)}</strong><span>${esc(location.area)}</span></div></div>`).join('')}</div></article>`;
  }
  function renderSources() {
    const item = items.get(selected);
    if (!item) return;
    const all = sourceList(item), shown = all.filter(m => !selectedMap || m.locations.some(l => l.name === selectedMap));
    $('source-count').textContent = `${nf.format(shown.length)} 種怪物${selectedMap ? ` · ${selectedMap}` : ''}`;
    $('source-cards').innerHTML = shown.slice(0,sourceLimit).map(m => sourceCard(m, item.conditionalSourceKeys.includes(m.key))).join('');
    $('more-sources').hidden = sourceLimit >= shown.length;
    $('more-sources').textContent = `再顯示 ${Math.min(24, shown.length-sourceLimit)} 種怪物`;
  }
  function showDetail() {
    const item = items.get(selected);
    if (!item) return;
    const sources = sourceList(item), maps = mapNames(item);
    if (!maps.includes(selectedMap)) selectedMap = '';
    const variants = item.variants.length > 1 ? '<p class="variant-note">同名物品合併顯示已知來源，實際掉落版本請以遊戲內為準。</p>' : '';
    $('drop-detail').innerHTML = `<div class="drop-detail-head"><div class="overline">ITEM / DROP LOCATIONS</div><h2>${esc(item.name)}</h2><div class="item-tags"><span>${esc(item.type)}</span>${sources.length ? `<span>${sources.length} 種怪物</span><span>${maps.length} 處出沒地點</span>` : '<span>來源尚未收錄</span>'}</div>${variants}</div>${sources.length ? `<section class="sources-section" aria-label="掉落怪物與出沒地圖"><div class="sources-toolbar"><h3>${pin} 掉落怪物與地圖</h3><label><span class="sr-only">篩選出沒地圖</span><select id="source-map"><option value="">所有出沒地圖</option>${maps.map(name => `<option value="${esc(name)}" ${name===selectedMap?'selected':''}>${esc(name)}</option>`).join('')}</select></label></div><p class="source-count" id="source-count" aria-live="polite"></p><div class="source-cards" id="source-cards"></div><button type="button" class="load-more" id="more-sources" hidden></button>${item.conditionalSourceKeys.length ? '<p class="conditional-note">「特殊條件來源」可能需要額外觸發條件，請依遊戲內規則確認。</p>' : ''}</section>` : '<div class="source-missing"><span aria-hidden="true">⌕</span><h3>目前資料未找到掉落來源</h3><p>本次收錄的怪物與地圖中，尚未找到此道具的掉落紀錄。<br>它可能來自未收錄地圖、任務、商店、合成或活動獎勵。</p></div>'}<div class="drop-detail-foot">列出已知掉落來源，不代表每次擊敗怪物都會取得。</div>`;
    if (sources.length) {
      renderSources();
      $('source-map').addEventListener('change', () => { selectedMap=$('source-map').value; sourceLimit=24; renderSources(); setURL(); });
      $('more-sources').addEventListener('click', () => { sourceLimit+=24; renderSources(); });
    }
  }
  function update({ restore = false } = {}) {
    if (!ready) return;
    const query = $('item-query').value;
    const hasQuery = !!normalize(query);
    filtered = search(groups, query, $('item-type').value);
    limit = 60; sourceLimit = 24;
    if (!restore || !filtered.some(item => item.key === selected)) { selected=filtered[0]?.key || ''; selectedMap=''; }
    if (restore && selected) limit=Math.max(60,Math.ceil((filtered.findIndex(item=>item.key===selected)+1)/60)*60);
    $('clear-search').hidden = !hasQuery && !$('item-type').value;
    $('start-panel').hidden = hasQuery;
    $('no-results').hidden = !hasQuery || filtered.length > 0;
    $('drop-workspace').hidden = !hasQuery || !filtered.length;
    $('result-count').textContent = `${nf.format(filtered.length)} 筆`;
    renderResults();
    if (selected) showDetail(); else $('drop-detail').replaceChildren();
    $('item-results').scrollTop=0;
    $('announcement').textContent = hasQuery ? `找到 ${filtered.length} 筆符合名稱的道具` : '請輸入道具名稱開始查詢';
    setURL();
  }
  function restoreRoute() {
    const params=new URLSearchParams(location.search), requested=params.get('item');
    selected=items.has(requested) ? requested : groups.find(g=>g.variants.includes(requested))?.key || '';
    $('item-query').value=params.get('q') || (items.get(selected)?.name || '');
    $('item-type').value=params.get('type') || '';
    selectedMap=params.get('map') || '';
    update({restore:true});
  }
  async function load() {
    $('load-error').hidden=true; $('search-submit').disabled=true; $('search-submit').textContent='載入資料中…';
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch('assets/data.json?v=20261029-map55',{signal:controller.signal});
      if (!response.ok) throw new Error('HTTP '+response.status);
      const data=await response.json();
      if (!Array.isArray(data.items) || !Array.isArray(data.monsters)) throw new Error('資料格式不正確');
      monsters=new Map(data.monsters.map(m=>[m.key,m])); groups=groupItems(data.items); items=new Map(groups.map(g=>[g.key,g]));
      $('item-type').replaceChildren(new Option('全部物品',''),...[...new Set(groups.map(i=>i.type))].sort((a,b)=>a.localeCompare(b,'zh-Hant')).map(type=>new Option(type,type)));
      ready=true; $('search-submit').disabled=false; $('search-submit').textContent='查詢掉落 →';
      restoreRoute();
    } catch (error) {
      ready=false; $('load-error').hidden=false; $('start-panel').hidden=true; $('search-submit').textContent='資料未載入';
      console.error('Item drop lookup could not load',error);
    } finally { clearTimeout(timeout); }
  }
  $('search-form').addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);if(!composing)update();});
  $('item-query').addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});
  $('item-query').addEventListener('compositionend',()=>{composing=false;update();});
  $('item-query').addEventListener('input',()=>{clearTimeout(timer);if(!composing)timer=setTimeout(update,180);});
  $('item-type').addEventListener('change',()=>update());
  $('clear-search').addEventListener('click',()=>{$('item-query').value='';$('item-type').value='';update();$('item-query').focus();});
  $('item-results').addEventListener('click',event=>{
    const button=event.target.closest('[data-item]');if(!button)return;
    selected=button.dataset.item; selectedMap='';sourceLimit=24;renderResults();showDetail();setURL();
    $('announcement').textContent='已顯示 '+items.get(selected).name+'的掉落來源';
    if(matchMedia('(max-width:700px)').matches)$('drop-detail').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
  });
  $('more-items').addEventListener('click',()=>{const oldLimit=limit;limit+=60;renderResults();$('item-results').querySelectorAll('.item-row')[oldLimit]?.focus({preventScroll:false});});
  $('retry-load').addEventListener('click',load);
  window.addEventListener('popstate',()=>{if(ready)restoreRoute();});
  document.addEventListener('error',event=>{if(event.target.tagName==='IMG'&&event.target.closest('.source-thumb'))event.target.closest('.source-thumb').textContent='◇';},true);
  load();
})();
