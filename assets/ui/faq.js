(()=>{'use strict';
const cards=[...document.querySelectorAll('.faq-card')];
const input=document.getElementById('faq-search');
const filterButtons=[...document.querySelectorAll('[data-filter]')];
const count=document.getElementById('result-count');
const expand=document.getElementById('expand-all');
const dialog=document.getElementById('image-dialog');
let category='all';
function updateExpand(){const visible=cards.filter(c=>!c.hidden);expand.disabled=!visible.length;expand.textContent=visible.length&&visible.every(c=>c.open)?'全部收合 −':'全部展開 ＋';}
function filter(){const q=input.value.trim().toLocaleLowerCase();let visible=0;for(const card of cards){card.hidden=!(category==='all'||card.dataset.category===category)||!q.split(/\s+/).every(word=>card.textContent.toLocaleLowerCase().includes(word));if(!card.hidden)visible++;}filterButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===category)));count.textContent=`顯示 ${visible} / ${cards.length} 項問題`;document.getElementById('empty').hidden=visible!==0;updateExpand();}
function reset(){input.value='';category='all';filter();}
input.addEventListener('input',filter);
filterButtons.forEach(b=>b.addEventListener('click',()=>{category=b.dataset.filter;filter();}));
document.getElementById('reset').addEventListener('click',()=>{reset();input.focus();});
document.getElementById('empty-reset').addEventListener('click',()=>{reset();input.focus();});
expand.addEventListener('click',()=>{const visible=cards.filter(c=>!c.hidden);const open=!visible.every(c=>c.open);visible.forEach(c=>{c.open=open;});updateExpand();});
cards.forEach(c=>c.addEventListener('toggle',updateExpand));
function revealHash(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const card=cards.find(c=>c.id===id);if(!card)return;reset();card.open=true;card.scrollIntoView({block:'start'});}
window.addEventListener('hashchange',revealHash);if(location.hash)revealHash();
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{if(a.hash===location.hash)revealHash();}));
document.querySelectorAll('[data-lightbox]').forEach(a=>a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;e.preventDefault();const source=a.querySelector('img');document.getElementById('image-title').textContent=source.alt;const image=document.getElementById('lightbox-image');image.src=source.src;image.alt=source.alt;document.getElementById('original-image').href=a.href;dialog.showModal();}));
document.getElementById('close-image').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
updateExpand();
})();
