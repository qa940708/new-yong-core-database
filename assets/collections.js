/* Read-only collection catalogue. No game-account connection or progress writes. */
(() => {
  'use strict';
  const G=window.YongGuide,$=id=>document.getElementById(id);
  const categories=['一般討伐','菁英狩獵','首領征伐'];
  const p=new URLSearchParams(location.search);
  let category=p.get('category')||'',focusId=p.get('collection'),focusCore=p.get('core'),store;
  const expanded=new Set();
  const hashId=location.hash.match(/^#collection-(\d+)$/)?.[1];
  if(focusId||hashId)expanded.add(Number(focusId||hashId));
  function requirement(row){
    const c=store.byCore.get(row.coreId);
    const highlight=String(c.id)===focusCore?' linked-core':'';
    return `<div class="requirement-row${highlight}" data-core-id="${c.id}" style="--accent:${G.COLORS[c.type]||'#65788a'}"><a class="requirement-core" href="${G.esc(G.link('?core='+c.id))}">${G.icon(c)}<span><strong>${G.esc(c.core)}</strong><small>來源怪物：${G.esc(c.monster)} <span aria-hidden="true">↗</span></small></span></a><div class="requirement-metric"><small>需求數量</small><strong>${G.number(row.quantity)} 顆</strong></div><div class="requirement-metric"><small>核心掉落率</small><strong>${G.percent(c.dropRate)}</strong></div><div class="requirement-metric success"><small>登錄成功率</small><strong>${G.percent(row.successRate)}</strong></div><div class="requirement-map"><small>出沒地圖</small><span>${G.esc(c.maps||'未標示')}</span></div></div>`;
  }
  function setUrl(){
    const url=new URL(location.href);url.search='';
    if($('cq').value.trim())url.searchParams.set('q',$('cq').value.trim());
    if(category)url.searchParams.set('category',category);
    if($('reward').value)url.searchParams.set('reward',$('reward').value);
    if(focusId)url.searchParams.set('collection',focusId);
    if(focusCore)url.searchParams.set('core',focusCore);
    history.replaceState(null,'',url);
  }
  function render(){
    if(!store)return;
    const q=$('cq').value.trim().toLowerCase(),reward=$('reward').value;
    const data=store.collections.filter(g=>{
      const words=[g.name,g.category,...g.rewards.map(r=>r.name),...g.requirements.flatMap(r=>{const c=store.byCore.get(r.coreId);return[c.core,c.monster,c.maps,c.region];})].join(' ').toLowerCase();
      return (!focusId||String(g.id)===focusId)&&(!category||g.category===category)&&(!q||words.includes(q))&&(!reward||g.rewards.some(r=>r.name===reward));
    }).sort((a,b)=>categories.indexOf(a.category)-categories.indexOf(b.category)||a.id-b.id);
    $('collectionCount').textContent=data.length;
    $('requirementCount').textContent=data.reduce((n,g)=>n+g.requirements.length,0);
    document.querySelectorAll('[data-category]').forEach(btn=>{const active=btn.dataset.category===category;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
    $('collectionFocus').hidden=!focusId;
    if(focusId){const g=store.collections.find(g=>String(g.id)===focusId);$('collectionFocusText').textContent=g?'目前查看：'+g.name:'找不到指定收藏';}
    const list=$('collections');list.replaceChildren();
    if(!data.length){list.innerHTML='<div class="empty">找不到符合條件的收藏。請調整關鍵字、分類或獎勵篩選。</div>';return;}
    const frag=document.createDocumentFragment();
    data.forEach(g=>{
      const d=document.createElement('details');d.className='collection-card';d.id='collection-'+g.id;d.dataset.collectionId=g.id;d.open=expanded.has(g.id);
      const total=g.requirements.reduce((n,r)=>n+r.quantity,0);
      const rewardMarkup=g.rewards.map(G.reward).join('');
      const allSuccess=G.uniq(g.requirements.map(r=>r.successRate));
      const successText=allSuccess.length===1?'每項登錄成功率 '+G.percent(allSuccess[0]):'登錄成功率依各項需求顯示';
      const hasPending=g.rewards.some(r=>r.unit==='pending');
      d.innerHTML=`<summary><span class="collection-title"><small>${G.esc(g.category)}</small><strong>${G.esc(g.name)}</strong></span><span class="collection-quantity"><strong>${g.requirements.length} 種核心</strong><small>共 ${G.number(total)} 顆</small></span><span class="collection-rewards"><small class="field-label">完成收藏獎勵</small><span class="reward-list">${rewardMarkup}</span></span><span class="disclosure-label"><span class="closed-label">查看需求</span><span class="open-label">收合需求</span><span class="chevron" aria-hidden="true">⌄</span></span></summary><div class="collection-body"><div class="requirement-intro"><div><h3>所需核心</h3><p>需蒐集以下指定怪物核心，不能以其他同類別核心替代。</p></div><span class="success-note">${successText}</span></div><div class="requirement-head" aria-hidden="true"><span>核心／來源怪物</span><span>需求數量</span><span>核心掉落率</span><span>登錄成功率</span><span>出沒地圖</span></div><div class="requirements">${g.requirements.map(requirement).join('')}</div>${hasPending?'<p class="unit-note">本組部分獎勵數值的顯示單位仍在核對，暫不換算或顯示百分比；其餘獎勵照設定列出。</p>':''}<div class="collection-bottom"><span>上方獎勵為「完成收藏」所得，不是核心自身的鑲嵌能力。</span><a class="permalink" href="${G.esc(G.link('collections/?collection='+g.id+'#collection-'+g.id))}">本組連結 <span aria-hidden="true">↗</span></a></div></div>`;
      d.addEventListener('toggle',()=>{if(d.open)expanded.add(g.id);else expanded.delete(g.id);});frag.append(d);
    });list.append(frag);
  }
  function filter(){focusId=null;focusCore=null;setUrl();render();}
  function reset(){category='';focusId=null;focusCore=null;$('cq').value='';$('reward').value='';expanded.clear();history.replaceState(null,'',G.link('collections/'));render();}
  async function boot(){
    try{
      store=await G.load();
      G.options($('reward'),G.uniq(store.collections.flatMap(g=>g.rewards.map(r=>r.name))));
      $('cq').value=p.get('q')||'';$('reward').value=p.get('reward')||'';
      $('allCollections').textContent=store.collections.length;
      for(const [i,id] of ['normalCollections','eliteCollections','bossCollections'].entries())$(id).textContent=store.collections.filter(g=>g.category===categories[i]).length;
      $('allRequirements').textContent=store.collections.reduce((n,g)=>n+g.requirements.length,0);
      const every=store.collections.flatMap(g=>g.requirements);
      $('registerRule').textContent=every.every(r=>r.quantity===1&&r.successRate===100)?'目前每項指定核心 1 顆・登錄成功率 100%':'需求數量與登錄成功率依各組明細顯示';
      $('updated').textContent='收藏需求 v1｜核心平衡 v3｜資料整理 '+store.updated;
      render();
      const target=Number(focusId||hashId);if(target)requestAnimationFrame(()=>document.getElementById('collection-'+target)?.scrollIntoView({block:'start'}));
    }catch(e){G.error($('collections'),e);}
  }
  document.querySelectorAll('[data-category]').forEach(btn=>btn.addEventListener('click',()=>{category=btn.dataset.category;filter();}));
  $('cq').addEventListener('input',filter);$('reward').addEventListener('change',filter);
  $('clearCollections').addEventListener('click',reset);$('showCollections').addEventListener('click',reset);
  G.layout();boot();
})();
