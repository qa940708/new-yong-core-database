/* Public catalogue data only. No connection to game accounts or draw transactions. */
(()=>{'use strict';
const dataURL=new URL('../festival/data.json',document.currentScript.src);
const fallback=JSON.parse(document.getElementById('festival-data').textContent);
const trailer=document.getElementById('festival-trailer');
const trailerStart=document.getElementById('trailer-start');
if(trailer&&trailerStart){
 trailerStart.hidden=false;
 trailer.controls=false;
 trailerStart.addEventListener('click',()=>{
  document.getElementById('trailer-error').hidden=true;
  trailer.controls=true;
  if(trailer.ended)trailer.currentTime=0;
  trailer.play().catch(()=>{trailerStart.hidden=false;document.getElementById('trailer-error').hidden=false;});
 });
 trailer.addEventListener('play',()=>{trailerStart.hidden=true;trailer.controls=true;});
 trailer.addEventListener('ended',()=>{trailerStart.hidden=false;trailerStart.querySelector('.trailer-play-title').textContent='再次播放宣傳片';});
 trailer.addEventListener('error',()=>{document.getElementById('trailer-error').hidden=false;trailerStart.hidden=false;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)trailer.pause();});
 window.addEventListener('pagehide',()=>trailer.pause());
 new IntersectionObserver(entries=>{const e=entries[0];if(!e.isIntersecting||e.intersectionRatio<.1)trailer.pause();},{rootMargin:'-160px 0px 0px',threshold:[0,.1]}).observe(trailer);
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeMedia=p=>typeof p==='string'&&/^\/assets\/festival\/[a-z0-9_.-]+$/i.test(p);
function valid(data){
 if(!data||!Array.isArray(data.items))return false;
 const ids=new Set(),variants=new Set();
 for(const i of data.items){
  if(!/^[a-z0-9_]+$/.test(i.id)||ids.has(i.id)||!['costume','weapon','effect','fashion','supply'].includes(i.category)||!Array.isArray(i.variants)||!i.variants.length)return false;
  ids.add(i.id);
  for(const v of i.variants){if(!/^[a-z0-9_]+$/.test(v.id)||variants.has(v.id)||!v.media||!safeMedia(v.media.png)||!safeMedia(v.media.poster))return false;variants.add(v.id);if(Object.values(v.media).some(p=>!safeMedia(p)))return false;}
 }
 return true;
}
async function load(){const c=new AbortController(),timer=setTimeout(()=>c.abort(),3500);try{const r=await fetch(dataURL,{signal:c.signal,cache:'no-cache'});if(!r.ok)throw Error('catalogue unavailable');const d=await r.json();return valid(d)?d:fallback;}catch{return fallback;}finally{clearTimeout(timer);}}
const gender=v=>v.presentation==='male'?'男款':v.presentation==='female'?'女款':'遊戲實裝';
function media(v){
 const m=v.media;
 if(!m.mp4)return `<img class="static-preview" loading="lazy" src="${esc(m.poster)}" alt="${esc(v.label)}實裝外觀">`;
 return `<video class="item-video" controls muted loop playsinline preload="none" width="640" height="640" poster="${esc(m.poster)}" aria-label="${esc(v.label)}實裝動態"><source src="${esc(m.mp4)}" type="video/mp4">${m.webm?`<source src="${esc(m.webm)}" type="video/webm">`:''}<img src="${esc(m.poster)}" alt="${esc(v.label)}"></video>`;
}
function cardHTML(i){const v=i.variants[0],kind={costume:'套組外觀',weapon:'武器外觀',effect:'環繞特效',fashion:'風格服飾'}[i.category];return `<article class="festival-card ${esc(i.tone)}" data-item="${esc(i.id)}" data-variant-id="${esc(v.id)}"><div class="card-top"><span>${kind}</span>${i.variants.length>1?`<div class="variant-switch" role="group" aria-label="${esc(i.name)}款式">${i.variants.map((a,n)=>`<button type="button" data-variant="${esc(a.id)}" aria-pressed="${n===0}">${gender(a)}</button>`).join('')}</div>`:''}</div><div class="card-media">${media(v)}<span class="live-tag" aria-hidden="true"><i></i>${v.media.mp4?'實裝展示':'實裝外觀'}</span>${v.media.mp4?`<button class="loop-toggle" type="button" aria-label="播放${esc(v.label)}動態">播放動態</button>`:''}</div><div class="card-copy"><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><div class="card-bottom"><span class="variant-label">${gender(v)}</span><button class="inspect-button" type="button" data-inspect="${esc(i.id)}">放大觀看 <span aria-hidden="true">↗</span></button></div></div></article>`;}

load().then(data=>{
 if(!valid(data))throw Error('invalid fallback catalogue');
 const itemMap=new Map(data.items.map(i=>[i.id,i]));
 const layouts=[['costume','.costumes'],['weapon','.weapons'],['fashion','.fashion-grid']];
 for(const [category,selector] of layouts)document.querySelector(selector).innerHTML=data.items.filter(i=>i.category===category).map(cardHTML).join('');
 const effect=data.items.find(i=>i.category==='effect');
 if(effect)document.querySelector('.effect-section .festival-card').outerHTML=cardHTML(effect);
 document.querySelector('.supply-grid').innerHTML=data.items.filter(i=>i.category==='supply').map(i=>`<article class="supply-card" data-supply="${esc(i.id)}"><img src="${esc(i.variants[0].media.png)}" width="70" height="70" alt="${esc(i.name)}展示圖"><div><small>SUPPLY BOX</small><h3>${esc(i.name)}</h3></div></article>`).join('');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let motionEnabled=!reduce.matches;
 const all=document.getElementById('all-motion'),dialog=document.getElementById('media-dialog');
 const detailVideo=document.getElementById('detail-video'),detailStill=document.getElementById('detail-still'),detailTitle=document.getElementById('media-title');
 const cards=[...document.querySelectorAll('.festival-card')],states=new Map();
 let selected=null;
 function chosen(card){return itemMap.get(card.dataset.item).variants.find(v=>v.id===card.dataset.variantId);}
 function buttonState(card){const v=card.querySelector('video'),b=card.querySelector('.loop-toggle');if(!v||!b)return;b.textContent=v.paused?'播放動態':'暫停動態';b.setAttribute('aria-label',(v.paused?'播放':'暫停')+chosen(card).label+'動態');}
 function sync(card){const v=card.querySelector('video'),s=states.get(card);if(!v)return;const play=!document.hidden&&!dialog.open&&s.visible&&!s.manualPause&&(motionEnabled||s.override);if(play)v.play().catch(()=>buttonState(card));else v.pause();buttonState(card);}
 function syncAll(){for(const c of cards)sync(c);all.textContent=motionEnabled?'暫停所有動態':'播放所有動態';all.setAttribute('aria-pressed',String(!motionEnabled));}
 function attachVideo(card){const v=card.querySelector('video');if(!v)return;v.muted=true;v.controls=false;v.addEventListener('play',()=>buttonState(card));v.addEventListener('pause',()=>buttonState(card));v.addEventListener('error',()=>{buttonState(card);if(!card.querySelector('.card-error')){const p=document.createElement('p');p.className='card-error';p.textContent='可按「放大觀看」查看靜態圖片。';card.querySelector('.card-copy').prepend(p);}});}
 function selectVariant(card,id){const item=itemMap.get(card.dataset.item),v=item.variants.find(x=>x.id===id);if(!v||id===card.dataset.variantId)return;const old=card.querySelector('video');if(old)old.pause();card.dataset.variantId=id;card.querySelectorAll('[data-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.variant===id)));card.querySelector('.variant-label').textContent=gender(v);const container=card.querySelector('.card-media');const current=container.querySelector('video,.static-preview');current.outerHTML=media(v);card.querySelector('.card-error')?.remove();attachVideo(card);sync(card);}
 for(const card of cards){
  states.set(card,{visible:false,manualPause:false,override:false});attachVideo(card);
  card.querySelectorAll('[data-variant]').forEach(b=>b.addEventListener('click',()=>selectVariant(card,b.dataset.variant)));
  const loop=card.querySelector('.loop-toggle');if(loop)loop.addEventListener('click',()=>{const v=card.querySelector('video'),s=states.get(card);if(v.paused){s.manualPause=false;s.override=true;s.visible=true;v.play().catch(()=>buttonState(card));}else{s.manualPause=true;s.override=false;v.pause();}buttonState(card);});
  card.querySelector('[data-inspect]').addEventListener('click',()=>openDetail(chosen(card)));
 }
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){states.get(entry.target).visible=entry.isIntersecting&&entry.intersectionRatio>=.08;sync(entry.target);}},{threshold:[0,.08,.3]});
 cards.forEach(c=>observer.observe(c));
 all.hidden=false;all.addEventListener('click',()=>{motionEnabled=!motionEnabled;if(!motionEnabled)trailer?.pause();for(const s of states.values()){s.override=false;s.manualPause=false;}syncAll();});
 reduce.addEventListener('change',()=>{motionEnabled=!reduce.matches;for(const s of states.values()){s.override=false;s.manualPause=false;}syncAll();if(dialog.open&&!motionEnabled)setMode('still');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)detailVideo.pause();syncAll();});
 window.addEventListener('pagehide',()=>{cards.forEach(c=>c.querySelector('video')?.pause());detailVideo.pause();});
 function setMode(mode){
  if(!selected)return;const motion=mode==='motion'&&Boolean(selected.media.mp4);
  detailVideo.hidden=!motion;detailStill.hidden=motion;
  dialog.querySelectorAll('[data-mode]').forEach(b=>{b.setAttribute('aria-pressed',String((motion?'motion':'still')===b.dataset.mode));b.hidden=b.dataset.mode==='motion'&&!selected.media.mp4;});
  if(motion&&dialog.open)detailVideo.play().catch(()=>{});else detailVideo.pause();
 }
 function openDetail(v){
  selected=v;detailTitle.textContent=v.label;detailStill.src=v.media.png;detailStill.alt=v.label+'實裝外觀';detailVideo.poster=v.media.poster;detailVideo.setAttribute('aria-label',v.label+'放大動態');detailVideo.muted=true;
  if(v.media.mp4)detailVideo.src=v.media.mp4;else detailVideo.removeAttribute('src');
  dialog.querySelector('.media-error').hidden=true;
  trailer?.pause();dialog.showModal();setMode(motionEnabled&&v.media.mp4?'motion':'still');syncAll();
 }
 document.getElementById('close-media').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{detailVideo.pause();detailVideo.removeAttribute('src');detailVideo.load();selected=null;syncAll();});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
 dialog.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
 detailVideo.addEventListener('error',()=>{if(dialog.open&&selected?.media.mp4)dialog.querySelector('.media-error').hidden=false;});
 syncAll();document.documentElement.dataset.festivalReady='true';
}).catch(error=>{console.error('Festival preview:',error);document.documentElement.dataset.festivalReady='fallback';});
})();
