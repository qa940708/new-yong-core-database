/* Preview-only ougi catalogue. Department, stage and skill level are independent. */
(() => {
  'use strict';
  const base = new URL('../', document.currentScript.src);
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fmt = n => new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(n);
  let data, deptId='fighter', stageId='initial', level=9;
  const icon = n => `<span class="ougi-icon" aria-hidden="true" style="--ougi-x:${-Number(n)*35}px"></span>`;
  const framed = n => `<span class="ougi-icon-frame">${icon(n)}</span>`;
  const effect = (e,i) => `${e.unit==='reductionPercent'?'降低 ':'+'}${fmt(e.values[i])}${e.unit==='flat'?'':'%'}`;
  const columnValue = (e,i) => `${e.unit==='reductionPercent'?'':'+'}${fmt(e.values[i])}${e.unit==='flat'?'':'%'}`;
  function fromUrl() {
    const p=new URLSearchParams(location.search);
    deptId=data.departments.some(d=>d.id===p.get('department'))?p.get('department'):'fighter';
    stageId=data.stages.some(s=>s.id===p.get('stage'))?p.get('stage'):'initial';
    const candidate=Number(p.get('level')||9);level=Number.isInteger(candidate)&&candidate>=1&&candidate<=9?candidate:9;
  }
  function setUrl() {
    const url=new URL(location.href);url.search='';
    url.searchParams.set('department',deptId);url.searchParams.set('stage',stageId);
    if(data.departments.find(d=>d.id===deptId).stages[stageId].status==='available')url.searchParams.set('level',level);
    history.replaceState(null,'',url);
  }
  function pickers(dept) {
    $('departments').innerHTML=data.departments.map(d=>{
      const s=d.stages.initial.skills[0];
      return `<button type="button" class="dept-btn${d.status==='planned'?' planned':''}" data-department="${d.id}" aria-pressed="${d.id===deptId}">${s?icon(s.icon):'<span class="dept-plus" aria-hidden="true">＋</span>'}<span><strong>${esc(d.name)}</strong><small>${s?'初階已開放':'預留部門・未開放'}</small></span></button>`;
    }).join('');
    $('stages').innerHTML=data.stages.map(s=>{
      const available=dept.stages[s.id].status==='available';
      return `<button type="button" class="stage-btn" data-stage="${s.id}" data-status="${available?'available':'planned'}" aria-pressed="${stageId===s.id}"><span>${esc(s.name)}</span><small>${available?'已開放':'尚未開放'}</small></button>`;
    }).join('');
  }
  function stopVideo() {
    const player=$('ougi-video');
    if(player){player.pause();player.removeAttribute('src');player.load();}
  }
  function videoMarkup(v,dept,stage,skill) {
    if(!v||!['available','staged'].includes(v.status)||!v.url)return null;
    let url;try{url=new URL(v.url,base);}catch(_){return null;}
    if(url.protocol!=='https:'&&url.origin!==location.origin)return null;
    const label=dept.name+'・'+stage.name+'・'+skill.name;
    // ougi-media-v4 posters: only original gameplay stills.
    let poster='';try{const p=new URL(v.poster,base);if(v.poster&&(p.protocol==='https:'||p.origin===location.origin))poster=p.href;}catch(_){}
    return `<h3 class="media-heading">實機施放展示</h3><p class="media-label">${esc(label)}</p><video id="ougi-video" controls playsinline preload="metadata" width="816" height="490" poster="${esc(poster)}" aria-label="${esc(label+' 實機施放錄影')}" src="${esc(url.href)}">此瀏覽器不支援影片播放。</video><p id="ougi-video-status" role="status" aria-live="polite">正在讀取實機影片…</p><button type="button" id="ougi-video-retry" class="media-retry" hidden>重新載入影片</button><p class="media-note">${v.hasAudio===false?'此錄影無音軌。':''}錄影片段僅示範施放動作；技能持續與冷卻以等級資料為準。</p>`;
  }
  function bindVideo() {
    const player=$('ougi-video');if(!player)return;
    const slot=player.closest('.video-slot'),status=$('ougi-video-status'),retry=$('ougi-video-retry');
    slot.dataset.mediaStatus='loading';
    const ready=()=>{if(!player.isConnected)return;player.hidden=false;retry.hidden=true;slot.dataset.mediaStatus='ready';status.textContent='點擊播放，可暫停、拖曳與全螢幕查看。';};
    player.addEventListener('loadedmetadata',ready);
    player.addEventListener('error',()=>{if(!player.isConnected)return;player.hidden=true;retry.hidden=false;slot.dataset.mediaStatus='error';status.textContent='影片暫時無法讀取，請重新載入或稍後再試。技能資料仍可正常查閱。';});
    retry.onclick=()=>{retry.hidden=true;slot.dataset.mediaStatus='loading';status.textContent='正在重新讀取實機影片…';player.load();};
    if(player.readyState>=1)ready();
  }
  function render() {
    stopVideo();
    const dept=data.departments.find(d=>d.id===deptId), stage=data.stages.find(s=>s.id===stageId), entry=dept.stages[stageId];
    pickers(dept);
    $('selection-status').textContent=`${dept.name}・${stage.name}・${entry.status==='available'?'已開放':'尚未開放'}`;
    const available=entry.status==='available'&&entry.skills.length>0;
    $('initial-guide').hidden=!(available&&stageId==='initial');
    if(!available) {
      $('skill-content').innerHTML=`<article class="ougi-panel ougi-placeholder"><span class="placeholder-symbol" aria-hidden="true">奧</span><div class="kicker">${esc(dept.name)} · ${esc(stage.name)}</div><h2>${esc(stage.name)}尚未開放</h2><p>${dept.status==='planned'?'此部門尚未開放，已預留初階、中階與高階奧義的位置。':'此部門目前僅開放初階奧義，中階與高階已分別預留。'}</p><p>本階段尚無已公布的技能名稱、能力、技能書、取得方式、升級費用或實機影片。</p><p class="ougi-muted">初／中／高階是奧義階段，不是技能 Lv.1～Lv.9 的分段；中高階的解鎖條件尚未公布。</p><button type="button" class="back-initial" id="back-initial">查看已開放的初階奧義</button></article>`;
      $('back-initial').onclick=()=>{if(dept.status==='planned')deptId='fighter';stageId='initial';level=9;setUrl();render();};return;
    }
    const s=entry.skills[0];level=Math.min(level,s.maxLevel);const i=level-1;
    let video=`<span class="rec-mark" aria-hidden="true">REC</span><h3>實機施放展示</h3><p>影片準備中</p><p>${esc(dept.name)}・${esc(stage.name)}・${esc(s.name)}</p><p class="ougi-muted">此處將放入對應技能的遊戲實錄。</p>`;
    const v=s.video;
    const playable=videoMarkup(v,dept,stage,s);if(playable)video=playable;
    const rows=Array.from({length:s.maxLevel},(_,n)=>`<tr${n===i?' class="selected" aria-current="true"':''}><td>Lv.${n+1}</td>${s.effects.map(e=>`<td>${columnValue(e,n)}</td>`).join('')}<td>${s.duration[n]} 秒</td><td>${s.cooldown[n]} 秒</td></tr>`).join('');
    $('skill-content').innerHTML=`<article class="ougi-panel skill-panel"><div class="skill-overview"><div><div class="skill-heading">${framed(s.icon)}<div><div class="kicker">${esc(dept.name)} · ${esc(stage.name)}</div><h2>奧義・${esc(s.name)}</h2></div></div><p class="skill-description">${esc(s.description)}技能等級越高，效果、持續與冷卻依下表變化。</p><div class="level-control"><label for="skill-level">查看技能等級</label><select id="skill-level">${Array.from({length:s.maxLevel},(_,n)=>`<option value="${n+1}"${n+1===level?' selected':''}>Lv.${n+1}${n+1===s.maxLevel?'（滿級）':''}</option>`).join('')}</select><small>僅切換資料顯示，不會操作遊戲角色。</small></div><div class="effect-grid">${s.effects.map(e=>`<div class="effect-stat"><small>Lv.${level} ${esc(e.name)}</small><strong>${effect(e,i)}</strong></div>`).join('')}</div><div class="timing-row"><span>持續時間 <strong>${s.duration[i]} 秒</strong></span><span>冷卻時間 <strong>${s.cooldown[i]} 秒</strong></span></div></div><div class="video-slot${playable?' has-video':''}">${video}</div></div><div class="growth-header"><h3>初階奧義 Lv.1～Lv.${s.maxLevel} 完整成長表</h3><span>技能等級與奧義階段分開顯示</span></div><div class="ougi-table-wrap" tabindex="0" role="region" aria-label="${esc(s.name)}完整成長表"><table class="ougi-table"><thead><tr><th scope="col">等級</th>${s.effects.map(e=>`<th scope="col">${esc(e.name)}</th>`).join('')}<th scope="col">持續</th><th scope="col">冷卻</th></tr></thead><tbody>${rows}</tbody></table></div><p class="ougi-footnote">以上為本技能的各等級效果，不將每級數值相加。初階最高 Lv.${s.maxLevel}；中高階的等級與條件另行公布。</p></article>`;
    bindVideo();
    $('skill-level').onchange=e=>{level=Number(e.target.value);setUrl();render();$('skill-level').focus({preventScroll:true});};
  }
  function guide() {
    const a=data.acquisition.initial;
    $('acquisition').innerHTML=`<article class="ougi-panel"><div class="kicker">怪物掉落</div><h3>${esc(a.boss)}</h3><p>擊殺後有機率取得以下道具。</p><div class="loot-items"><span class="item-label">${framed(8)}<span>${esc(a.boxName)}</span></span><span class="item-label">${framed(9)}<span>${esc(a.fragmentName)}</span></span></div><p class="ougi-muted">自選箱與殘頁的個別掉落率尚未列出；不套用核心掉落率。</p></article><article class="ougi-panel"><div class="kicker">${esc(a.craftingSystem)}</div><h3>殘頁製作自選箱</h3><div class="craft-flow"><span class="item-label">${framed(9)}<span>技能書殘頁<strong>${a.fragmentQuantity} 張</strong></span></span><span class="craft-arrow" aria-hidden="true">→</span><span class="item-label">${framed(8)}<span>技能書自選箱<strong>${a.resultQuantity} 個</strong></span></span></div><div class="craft-metrics"><span>製作費用<strong>${fmt(a.gold/10000)} 萬遊戲幣</strong></span><span>製作成功率<strong>${a.successRate}%</strong></span></div><p class="ougi-muted">開啟「工匠系統」，選擇「奧義技能書自選箱」，備妥材料與遊戲幣後製作。</p></article>`;
    $('book-options').innerHTML=a.eligibleDepartments.map(id=>{
      const d=data.departments.find(d=>d.id===id),s=d.stages.initial.skills[0];
      return `<div class="book-option">${framed(s.bookIcon)}<span><strong>${esc(d.name)}</strong><small>${esc(s.bookName)}</small></span></div>`;
    }).join('');
    $('upgrade-table').innerHTML=`<table class="ougi-table"><thead><tr><th scope="col">升級</th><th scope="col">本次費用</th><th scope="col">累計升級費用</th></tr></thead><tbody>${Array.from({length:8},(_,i)=>`<tr><td>Lv.${i+1} → Lv.${i+2}</td><td>${fmt(a.upgradeCostPerLevel/1e8)} 億</td><td>${fmt((i+1)*a.upgradeCostPerLevel/1e8)} 億</td></tr>`).join('')}</tbody></table>`;
  }
  async function boot() {
    try {
      const response=await fetch(new URL('ougi/data.json',base),{cache:'no-store'});if(!response.ok)throw new Error('技能資料載入失敗');data=await response.json();
      if(data.schemaVersion!==2||!Array.isArray(data.departments)||!Array.isArray(data.stages))throw new Error('技能資料格式錯誤');
      for(const d of data.departments)for(const stage of data.stages){const t=d.stages[stage.id];if(!t||!Array.isArray(t.skills))throw new Error('階段資料不完整');for(const s of t.skills){if(!Number.isInteger(s.maxLevel)||s.effects.some(e=>e.values.length!==s.maxLevel)||s.duration.length!==s.maxLevel||s.cooldown.length!==s.maxLevel)throw new Error('等級資料不完整');}}
      fromUrl();guide();render();$('updated').textContent='奧義實機展示預覽 v4｜資料整理 '+data.updated;
      $('departments').onclick=e=>{const b=e.target.closest('[data-department]');if(!b)return;deptId=b.dataset.department;setUrl();render();document.querySelector(`[data-department="${deptId}"]`).focus({preventScroll:true});};
      $('stages').onclick=e=>{const b=e.target.closest('[data-stage]');if(!b)return;stageId=b.dataset.stage;setUrl();render();document.querySelector(`[data-stage="${stageId}"]`).focus({preventScroll:true});};
      window.addEventListener('popstate',()=>{fromUrl();render();});
    } catch(err) {
      $('updated').textContent='載入未完成';$('skill-content').innerHTML='<div class="empty" role="alert">奧義資料暫時無法載入。<p><button type="button" id="ougi-retry">重新載入</button></p></div>';$('ougi-retry').onclick=()=>location.reload();console.error(err);
    }
  }
  const header=document.querySelector('header'),measure=()=>document.documentElement.style.setProperty('--header-height',Math.ceil(header.getBoundingClientRect().height)+'px');measure();
  if('ResizeObserver' in window)new ResizeObserver(measure).observe(header);else addEventListener('resize',measure);
  window.addEventListener('pagehide',stopVideo);
  boot();
})();
