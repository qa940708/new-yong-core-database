const COLORS={"猛攻":"#e84b45","守護":"#d6a33b","精準":"#3d8ee8","疾影":"#9b5de5","鬥魂":"#38b66b"};
let DATA=[];
const $=id=>document.getElementById(id);
const uniq=arr=>[...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"zh-Hant"));
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function fmtDrop(x){return Number(x).toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1')+'%';}
function addOptions(id,vals){const el=$(id);vals.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);});}
function populateFilters(){
  addOptions('rank',uniq(DATA.map(x=>x.rank))); addOptions('type',uniq(DATA.map(x=>x.type)));
  addOptions('ability',uniq(DATA.flatMap(x=>x.abilities.map(a=>a.name)))); addOptions('region',uniq(DATA.map(x=>x.region)));
  $('totalStat').textContent=DATA.length; $('normalStat').textContent=DATA.filter(x=>x.rank==='一般').length;
  $('eliteStat').textContent=DATA.filter(x=>x.rank==='菁英').length; $('bossStat').textContent=DATA.filter(x=>x.rank==='王怪').length;
}
function iconStyle(id){
  const n=Math.max(1,Number(id)||1)-1, col=n%16, row=Math.floor(n/16);
  return `display:block;width:35px;height:35px;border:none;background-image:url('/preview/assets/core-icons-atlas.png?v=3');background-repeat:no-repeat;background-size:560px 315px;background-position:${-col*35}px ${-row*35}px`;
}
function render(){
  const q=$('q').value.trim().toLowerCase(),rank=$('rank').value,type=$('type').value,ability=$('ability').value,region=$('region').value;
  const data=DATA.filter(x=>{
    const blob=[x.monster,x.core,x.type,x.rank,x.region,x.maps,x.collection,...x.abilities.map(a=>a.name+' '+a.value)].join(' ').toLowerCase();
    return (!q||blob.includes(q))&&(!rank||x.rank===rank)&&(!type||x.type===type)&&(!ability||x.abilities.some(a=>a.name===ability))&&(!region||x.region===region);
  });
  $('count').textContent=data.length;
  const grid=$('grid'); grid.innerHTML=''; grid.className='core-list';
  if(!data.length){grid.innerHTML='<div class="empty">找不到符合條件的核心資料。</div>';return;}
  const head=document.createElement('div'); head.className='list-head';
  head.innerHTML='<div>核心</div><div>怪物</div><div>核心名稱／類別</div><div>能力</div><div>掉落率</div><div>出沒地圖</div><div>階級</div>';
  grid.appendChild(head);
  data.forEach(x=>{
    const row=document.createElement('article'); row.className='core-item'; row.style.setProperty('--accent',COLORS[x.type]||'#65788a');
    const abilities=x.abilities.map(a=>`<span class="ability">${esc(a.name)} <strong>+${esc(a.value)}</strong></span>`).join('');
    row.innerHTML=`
      <div class="icon-cell"><span class="core-icon" style="${iconStyle(x.id)}" title="${esc(x.core)}"></span></div>
      <div class="monster-cell"><strong>${esc(x.monster)}</strong><small>${esc(x.region)}</small></div>
      <div class="core-cell"><span class="badge">${esc(x.type)}</span><span class="core-name">${esc(x.core)}</span></div>
      <div class="abilities">${abilities}</div>
      <div class="drop">${fmtDrop(x.dropRate)}</div>
      <div class="map-cell"><span>${esc(x.maps||'未標示')}</span>${x.collection?`<small>${esc(x.collection)}</small>`:''}</div>
      <div class="rank">${esc(x.rank)}</div>`;
    grid.appendChild(row);
  });
}
function resetFilters(){['q','rank','type','ability','region'].forEach(id=>$(id).value='');render();}
async function boot(){
  try{
    const files=Array.from({length:10},(_,i)=>`cores/${String(i+1).padStart(2,'0')}.json`);
    const payloads=await Promise.all(files.map(async file=>{const r=await fetch(file,{cache:'no-store'});if(!r.ok)throw new Error(file);return r.json();}));
    DATA=payloads.flatMap(p=>p.cores||[]).sort((a,b)=>a.id-b.id);
    const meta=payloads[0]||{}; $('updated').textContent=`資料版本 ${meta.version||'-'}｜更新 ${meta.updated||'-'}`;
    populateFilters(); render();
  }catch(e){ $('grid').innerHTML='<div class="empty">核心資料載入失敗，請稍後重新整理頁面。</div>'; }
}
['q','rank','type','ability','region'].forEach(id=>$(id).addEventListener(id==='q'?'input':'change',render));
$('reset').addEventListener('click',resetFilters); boot();