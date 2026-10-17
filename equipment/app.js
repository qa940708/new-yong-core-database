'use strict';
const D=window.EQUIPMENT_DATA;
const byId=new Map(D.items.map(i=>[i.id,i]));
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n).toLocaleString('zh-TW',{maximumFractionDigits:4});
const normal=s=>String(s).normalize('NFKC').trim().toLocaleLowerCase();
const group=i=>i.suit===5?'weapon':[1,2,3,4].includes(i.suit)?'armor':'other';
const categoryName=i=>({1:'上衣',2:'褲子',3:'手套',4:'鞋子',5:'武器'}[i.suit]||'其他裝備');
const displayName=i=>i.name||'未命名裝備';
let selected=null,mode='Remodel',filtered=[],limit=80;
const value=(v,o)=>num(v)+(o.isPercent?'%':'');
const extent=(low,high,o)=>low===high?value(low,o):`${value(low,o)} ～ ${value(high,o)}`;
function findItems(query,category='all',linked=false){
 const q=normal(query);
 if(!q)return [];
 return D.items.filter(i=>(category==='all'||group(i)===category)&&(!linked||!!D.profiles[i.profile])&&normal(i.name).includes(q))
 .sort((a,b)=>(normal(b.name)===q)-(normal(a.name)===q)||Number(!!D.profiles[b.profile])-Number(!!D.profiles[a.profile]));
}
function search(selectFirst=false){
 limit=80;filtered=findItems($('query').value,$('category').value,$('linkedOnly').checked);
 if(selectFirst||!filtered.some(i=>i.id===selected))selected=filtered[0]?.id||null;
 renderResults();renderDetail();
}
function renderResults(){
 if(!normal($('query').value)){
  $('resultCount').textContent='';$('results').innerHTML='';$('moreButton').hidden=true;return;
 }
 $('resultCount').textContent=`${num(filtered.length)} 筆`;
 $('results').innerHTML=filtered.length?filtered.slice(0,limit).map(i=>`<button class="result ${i.id===selected?'active':''}" data-item="${esc(i.id)}" aria-pressed="${i.id===selected}"><strong>${esc(displayName(i))}</strong><span class="meta"><span>${esc(categoryName(i))}</span><span class="status ${i.profile?'':'dim'}">${i.profile?'已連結設定':'未連結設定'}</span></span></button>`).join(''):'<div class="empty"><strong>沒有找到符合的裝備</strong><p>試試部分名稱、不同關鍵字，或取消類型篩選。</p></div>';
 $('moreButton').hidden=filtered.length<=limit;
}
function renderDetail(){
 const i=byId.get(selected);
 if(!i){history.replaceState(null,'',location.pathname+location.search);$('detail').innerHTML='<div class="empty"><strong>先搜尋一件裝備</strong><p>選擇左側結果，即可查看對應設定。</p></div>';return;}
 const p=D.profiles[i.profile];
 history.replaceState(null,'',`#item=${encodeURIComponent(i.id)}&mode=${mode}`);
 const head=`<div class="detail-head"><div><span class="overline">${esc(categoryName(i))} / EQUIPMENT</span><h2 class="detail-title">${esc(displayName(i))}</h2><div class="tags"><span>${p?'已對應隨機屬性設定':'未連結隨機屬性設定'}</span></div></div></div>`;
 if(!p){$('detail').innerHTML=head+'<div class="explanation">這件裝備未連結本次資料內的隨機屬性設定，因此無法列出這一類改造數值。這不代表道具不能強化，也不代表不能使用其他改造系統。</div>';return;}
 const options=p.sections[mode];
 const rows=options.map(o=>`<tr><td>${esc(o.label)}</td><td>${num(o.rate)}%</td><td>${extent(o.low,o.high,o)}</td><td>${o.buckets.length?`<details><summary>${o.buckets.length} 個區間</summary><div class="bucket-list">${o.buckets.map(b=>`<div class="bucket"><span>${extent(b.low,b.high,o)}</span><b>${num(b.rate)}%</b></div>`).join('')}</div><p class="bucket-note">此為該屬性的區間設定，不是整次改造取得該區間的最終機率。</p>${o.warnings.map(w=>`<p class="warning">${esc(w)}；待抽選規則確認。</p>`).join('')}</details>`:'未提供細分區間'}</td></tr>`).join('');
 $('detail').innerHTML=head+`<div class="tabs" role="tablist" aria-label="設定來源"><button class="tab ${mode==='Remodel'?'selected':''}" role="tab" aria-selected="${mode==='Remodel'}" data-mode="Remodel">改造設定</button><button class="tab ${mode==='Drop'?'selected':''}" role="tab" aria-selected="${mode==='Drop'}" data-mode="Drop">掉落設定</button></div><div class="metrics"><div class="metric"><span>產生設定值</span><strong>${num(p.probability)}%</strong><small> Probability</small></div><div class="metric"><span>破壞設定值</span><strong>${num(p.destroy)}%</strong><small> Destroy Rate</small></div><div class="metric"><span>屬性條數設定</span><strong>${p.minGain===p.maxGain?num(p.minGain):num(p.minGain)+'–'+num(p.maxGain)}</strong><small> 條</small></div><div class="metric"><span>花費設定值</span><strong>${num(p.money)}</strong><small> Money Spend</small></div></div><div class="table-intro"><h2>${mode==='Remodel'?'改造':'掉落'}屬性一覽</h2><p>Rate 為原設定值；請展開區間查看細節。</p></div><div class="table-wrap"><table><thead><tr><th scope="col">屬性</th><th scope="col">設定 Rate</th><th scope="col">數值範圍</th><th scope="col">區間設定</th></tr></thead><tbody>${rows||'<tr><td colspan="4">此模式沒有屬性設定。</td></tr>'}</tbody></table></div>`;
}
$('results').addEventListener('click',e=>{const b=e.target.closest('[data-item]');if(!b)return;selected=b.dataset.item;renderResults();renderDetail();});
$('detail').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b){mode=b.dataset.mode;renderDetail();}});
let debounce;$('query').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>search(),100);});
$('query').addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(debounce);search(true);}});
$('searchButton').addEventListener('click',()=>{clearTimeout(debounce);search(true);});
$('category').addEventListener('change',()=>search());$('linkedOnly').addEventListener('change',()=>search());
$('moreButton').addEventListener('click',()=>{limit+=80;renderResults();});
$('linkedCount').textContent=num(D.meta.stats.matched);
const incomingQuery=new URLSearchParams(location.search).get('q');
if(incomingQuery?.trim())$('query').value=incomingQuery;
const hash=new URLSearchParams(location.hash.slice(1));if(!incomingQuery?.trim()&&byId.has(hash.get('item'))){selected=hash.get('item');$('query').value=byId.get(selected).name||'';}if(['Drop','Remodel'].includes(hash.get('mode')))mode=hash.get('mode');
search();


