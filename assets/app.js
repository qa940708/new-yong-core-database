const COLORS={"猛攻":"#e84b45","守護":"#d6a33b","精準":"#3d8ee8","疾影":"#9b5de5","鬥魂":"#38b66b"};
let DATA=[];
const $=id=>document.getElementById(id);
const uniq=arr=>[...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"zh-Hant"));
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function fmtDrop(x){return Number(x).toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1')+'%';}
function addOptions(id,vals){const el=$(id);vals.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);});}
function populateFilters(){
  addOptions('rank',uniq(DATA.map(x=>x.rank)));addOptions('type',uniq(DATA.map(x=>x.type)));
  addOptions('ability',uniq(DATA.flatMap(x=>x.abilities.map(a=>a.name))));addOptions('region',uniq(DATA.map(x=>x.region)));
  $('totalStat').textContent=DATA.length;$('normalStat').textContent=DATA.filter(x=>x.rank==='一般').length;
  $('eliteStat').textContent=DATA.filter(x=>x.rank==='菁英').length;$('bossStat').textContent=DATA.filter(x=>x.rank==='王怪').length;
}
function render(){
  const q=$('q').value.trim().toLowerCase(),rank=$('rank').value,type=$('type').value,ability=$('ability').value,region=$('region').value;
  const data=DATA.filter(x=>{
    const blob=[x.monster,x.core,x.type,x.rank,x.region,x.maps,x.collection,...x.abilities.map(a=>a.name+' '+a.value)].join(' ').toLowerCase();
    return (!q||blob.includes(q))&&(!rank||x.rank===rank)&&(!type||x.type===type)&&(!ability||x.abilities.some(a=>a.name===ability))&&(!region||x.region===region);
  });
  $('count').textContent=data.length;
  const grid=$('grid');grid.innerHTML='';
  if(!data.length){grid.innerHTML='<div class="empty">找不到符合條件的核心資料。</div>';return;}
  data.forEach(x=>{
    const card=document.createElement('article');card.className='card';card.style.setProperty('--accent',COLORS[x.type]||'#65788a');
    const abilities=x.abilities.map(a=>`<div class="ability">${esc(a.name)} <strong>+${esc(a.value)}</strong></div>`).join('');
    card.innerHTML=`<div class="topline"><div class="monster">${esc(x.monster)}</div><div class="rank">${esc(x.rank)}</div></div>
    <div class="core-row"><span class="badge">${esc(x.type)}</span><span class="core-name">${esc(x.core)}</span></div>
    <div class="abilities">${abilities}</div>
    <div class="detail">區域｜<span>${esc(x.region)}</span></div>
    <div class="footer-row"><div><div class="drop-label">核心掉落率</div><div class="drop">${fmtDrop(x.dropRate)}</div></div><button class="open-btn">查看出沒地圖</button></div>
    <div class="more"><div class="detail">出沒地圖｜<span>${esc(x.maps||'未標示')}</span></div>${x.collection?`<div class="detail">收藏組｜<span>${esc(x.collection)}</span></div>`:''}</div>`;
    card.querySelector('.open-btn').onclick=()=>{card.classList.toggle('expanded');card.querySelector('.open-btn').textContent=card.classList.contains('expanded')?'收合':'查看出沒地圖';};
    grid.appendChild(card);
  });
}
function resetFilters(){['q','rank','type','ability','region'].forEach(id=>$(id).value='');render();}
async function boot(){
  try{
    const res=await fetch('cores.json',{cache:'no-store'});const payload=await res.json();DATA=payload.cores||[];
    $('updated').textContent=`資料版本 ${payload.version||'-'}｜更新 ${payload.updated||'-'}`;
    populateFilters();render();
  }catch(e){
    $('grid').innerHTML='<div class="empty">核心資料載入失敗，請稍後重新整理頁面。</div>';
  }
}
['q','rank','type','ability','region'].forEach(id=>$(id).addEventListener(id==='q'?'input':'change',render));
$('reset').addEventListener('click',resetFilters);
boot();