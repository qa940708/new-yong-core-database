/* Shared player-data loader. Game settings remain authoritative; this is a read-only guide. */
(() => {
  'use strict';
  const base = new URL('../', document.currentScript.src);
  const COLORS = Object.freeze({'猛攻':'#e84b45','守護':'#d6a33b','精準':'#3d8ee8','疾影':'#9b5de5','鬥魂':'#38b66b'});
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const number = value => new Intl.NumberFormat('zh-TW', {maximumFractionDigits:4}).format(value);
  const percent = value => typeof value === 'number' && Number.isFinite(value) ? number(value) + '%' : '未標示';
  const link = path => new URL(path, base).href;
  const uniq = a => [...new Set(a.filter(Boolean))].sort((x,y)=>String(x).localeCompare(String(y),'zh-Hant'));
  const icon = core => {
    const n = Number(core.id) - 1;
    if (!Number.isInteger(n) || n < 0 || n > 136) return '<span class="icon-frame icon-missing" aria-label="核心圖片待補">—</span>';
    const url = link('assets/core-icons-atlas.png?v=3');
    return `<span class="icon-frame"><span class="core-icon" role="img" aria-label="${esc(core.core)}" style="display:block;width:35px;height:35px;border:none;background-image:url('${esc(url)}');background-repeat:no-repeat;background-size:560px 315px;background-position:${-(n%16)*35}px ${-Math.floor(n/16)*35}px"></span></span>`;
  };
  const reward = r => r.unit === 'pending' ? `<span class="reward-chip pending">${esc(r.name)}<small>數值待確認</small></span>` : `<span class="reward-chip">${esc(r.name)} <strong>+${number(r.value)}${r.unit === 'percent' ? '%' : ''}</strong></span>`;
  const options = (el, values) => values.forEach(value => { const o=document.createElement('option');o.value=value;o.textContent=value;el.appendChild(o); });
  async function get(path) {
    const response=await fetch(link(path),{cache:'no-store'});
    if(!response.ok) throw new Error(`資料載入失敗 (${response.status}): ${path}`);
    return response.json();
  }
  let pending;
  function load() {
    if(pending) return pending;
    pending=(async()=>{
      const [manifest, collectionFile]=await Promise.all([get('cores/manifest.json'),get('collections.json')]);
      if(!Array.isArray(manifest.files)||!manifest.files.length)throw new Error('核心資料目錄不完整');
      const chunks=await Promise.all(manifest.files.map(name=>get('cores/'+name)));
      if(chunks.some(c=>c.version!==manifest.version)||collectionFile.version!==manifest.version)throw new Error('資料版本正在更新，請稍後重新載入');
      const cores=chunks.flatMap(p=>p.cores).sort((a,b)=>a.id-b.id);
      const collections=collectionFile.collections;
      if(cores.length!==manifest.count||collections.length!==collectionFile.count)throw new Error('資料數量核對失敗');
      const byCore=new Map(),usage=new Map();
      cores.forEach(c=>{
        if(!Number.isInteger(c.id)||byCore.has(c.id)||!Array.isArray(c.abilities)||!Number.isFinite(c.dropRate))throw new Error('核心資料格式錯誤');
        byCore.set(c.id,c);usage.set(c.id,[]);
      });
      const ids=new Set();
      collections.forEach(g=>{
        if(ids.has(g.id)||!Array.isArray(g.requirements)||!Array.isArray(g.rewards))throw new Error('收藏資料格式錯誤');
        ids.add(g.id);
        const seen=new Set();
        g.requirements.forEach(r=>{
          if(!byCore.has(r.coreId)||seen.has(r.coreId)||!Number.isInteger(r.quantity)||r.quantity<1||!Number.isFinite(r.successRate)||r.successRate<0||r.successRate>100)throw new Error('收藏需求對應錯誤');
          seen.add(r.coreId);usage.get(r.coreId).push(g);
        });
      });
      return {cores,collections,byCore,usage,version:manifest.version,updated:manifest.updated};
    })();
    return pending;
  }
  function layout() {
    const header=document.querySelector('header');
    const panel=document.querySelector('.filter-panel');
    const measure=()=>{
      document.documentElement.style.setProperty('--header-height',`${Math.ceil(header?.getBoundingClientRect().height||0)}px`);
      document.documentElement.style.setProperty('--filter-height',`${Math.ceil(panel?.getBoundingClientRect().height||0)}px`);
    };
    measure();
    if('ResizeObserver' in window){const ro=new ResizeObserver(measure);if(header)ro.observe(header);if(panel)ro.observe(panel);}
    else window.addEventListener('resize',measure);
  }
  function error(el, err) {
    el.replaceChildren();
    const box=document.createElement('div');box.className='empty';box.setAttribute('role','alert');
    const p=document.createElement('p');p.textContent='資料暫時無法載入，請重新載入頁面。';
    const b=document.createElement('button');b.type='button';b.className='compact-button';b.textContent='重新載入';b.onclick=()=>location.reload();
    box.append(p,b);el.append(box);console.error(err);
    const status=document.getElementById('updated');if(status)status.textContent='載入未完成';
  }
  window.YongGuide={COLORS,esc,number,percent,link,uniq,icon,reward,options,load,layout,error};
})();
