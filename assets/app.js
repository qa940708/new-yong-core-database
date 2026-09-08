/* Core list: the collection relation is derived from the shared requirements, not free text. */
(() => {
  'use strict';
  const G=window.YongGuide,$=id=>document.getElementById(id);
  let store;
  const params=new URLSearchParams(location.search);
  let focusId=params.get('core');
  function rankClass(rank){return rank==='王怪'?'rank-boss':rank==='菁英'?'rank-elite':'rank-normal';}
  function render(){
    if(!store)return;
    const q=$('q').value.trim().toLowerCase(),rank=$('rank').value,type=$('type').value,ability=$('ability').value,region=$('region').value;
    const data=store.cores.filter(x=>{
      const groups=store.usage.get(x.id)||[];
      const blob=[x.monster,x.core,x.type,x.rank,x.region,x.maps,...groups.map(g=>g.name),...x.abilities.map(a=>a.name+' '+a.value)].join(' ').toLowerCase();
      return (!focusId||String(x.id)===focusId)&&(!q||blob.includes(q))&&(!rank||x.rank===rank)&&(!type||x.type===type)&&(!ability||x.abilities.some(a=>a.name===ability))&&(!region||x.region===region);
    });
    $('count').textContent=data.length;
    document.querySelectorAll('.type-btn').forEach(btn=>{const active=btn.dataset.type===type;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));});
    const focus=$('focusNotice');focus.hidden=!focusId;
    if(focusId){const core=store.byCore.get(Number(focusId));$('focusText').textContent=core?'目前查看：'+core.core:'找不到指定核心';}
    const grid=$('grid');grid.replaceChildren();grid.className='core-list';
    if(!data.length){grid.innerHTML='<div class="empty">找不到符合條件的核心。請調整條件或按「清除篩選」。</div>';return;}
    const head=document.createElement('div');head.className='list-head';head.setAttribute('aria-hidden','true');
    head.innerHTML='<div>核心</div><div>怪物</div><div>核心名稱／類別</div><div>核心能力</div><div>掉落率</div><div>出沒地圖／收藏</div><div>階級</div>';grid.append(head);
    const frag=document.createDocumentFragment();
    data.forEach(x=>{
      const row=document.createElement('article');row.className='core-item';row.id='core-'+x.id;row.dataset.coreId=x.id;row.style.setProperty('--accent',G.COLORS[x.type]||'#65788a');
      const abilities=x.abilities.map(a=>`<span class="ability">${G.esc(a.name)} <strong>+${G.number(a.value)}</strong></span>`).join('');
      const usage=store.usage.get(x.id)||[];
      const relation=usage.length?usage.map(g=>`<a class="collection-link" href="${G.esc(G.link('collections/?collection='+g.id+'&core='+x.id+'#collection-'+g.id))}">${G.esc(g.name)} <span aria-hidden="true">↗</span></a>`).join(' '):'<span class="muted">目前未列入收藏</span>';
      row.innerHTML=`<div class="icon-cell">${G.icon(x)}</div><div class="monster-cell"><strong>${G.esc(x.monster)}</strong><small>${G.esc(x.region)}</small></div><div class="core-cell"><span class="badge">${G.esc(x.type)}</span><span class="core-name">${G.esc(x.core)}</span></div><div class="abilities" aria-label="核心自身能力">${abilities}</div><div class="drop"><small>核心掉落率</small><strong>${G.percent(x.dropRate)}</strong></div><div class="map-cell"><span>${G.esc(x.maps||'未標示')}</span><div class="collection-relation">${relation}</div></div><div class="rank ${rankClass(x.rank)}">${G.esc(x.rank)}</div>`;
      frag.append(row);
    });grid.append(frag);
  }
  function reset(){focusId=null;['q','rank','type','ability','region'].forEach(id=>$(id).value='');history.replaceState(null,'',G.link(''));render();}
  async function boot(){
    try{
      store=await G.load();
      ['rank','type','region'].forEach(id=>G.options($(id),G.uniq(store.cores.map(c=>c[id]))));
      G.options($('ability'),G.uniq(store.cores.flatMap(c=>c.abilities.map(a=>a.name))));
      $('totalStat').textContent=store.cores.length;
      for(const [id,rank] of [['normalStat','一般'],['eliteStat','菁英'],['bossStat','王怪']])$(id).textContent=store.cores.filter(c=>c.rank===rank).length;
      $('updated').textContent='核心平衡 v3｜收藏需求 v1｜資料整理 '+store.updated;
      ['q','rank','type','ability','region'].forEach(id=>{if(params.has(id))$(id).value=params.get(id);});
      render();
    }catch(e){G.error($('grid'),e);}
  }
  ['q','rank','type','ability','region'].forEach(id=>$(id).addEventListener(id==='q'?'input':'change',render));
  document.querySelectorAll('.type-btn').forEach(btn=>btn.addEventListener('click',()=>{$('type').value=btn.dataset.type;render();}));
  $('reset').addEventListener('click',reset);$('showAll').addEventListener('click',reset);G.layout();boot();
})();
