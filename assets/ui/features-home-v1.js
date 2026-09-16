(()=>{'use strict';
const data=JSON.parse(document.getElementById('home-data').textContent);
const dialog=document.getElementById('feature-dialog');
const search=document.getElementById('home-search');
const searchInput=document.getElementById('home-search-input');
const searchResults=document.getElementById('home-search-results');
function openFeature(id){
 const feature=data.features.find(f=>f.id===id);if(!feature)return;
 if(search.open)search.close();
 document.getElementById('feature-title').textContent=feature.name;
 document.getElementById('feature-description').textContent=feature.description;
 const details=document.getElementById('feature-details');details.replaceChildren();
 for(const line of feature.details){const p=document.createElement('p');p.textContent=line;details.append(p);}
 const links=document.getElementById('feature-links');links.replaceChildren();
 for(const link of feature.links){const a=document.createElement('a');a.textContent=link.label+' →';a.href=link.href;links.append(a);}
 if(!dialog.open)dialog.showModal();
}
document.querySelectorAll('[data-feature]').forEach(button=>button.addEventListener('click',()=>openFeature(button.dataset.feature)));
document.getElementById('close-feature').addEventListener('click',()=>dialog.close());
document.getElementById('home-search-close').addEventListener('click',()=>search.close());
for(const modal of [dialog,search])modal.addEventListener('click',event=>{if(event.target!==modal)return;const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();});
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 let visible=0;document.querySelectorAll('[data-category]').forEach(card=>{card.hidden=button.dataset.filter!=='all'&&card.dataset.category!==button.dataset.filter;if(!card.hidden)visible++;});
 document.getElementById('feature-count').textContent='顯示 '+visible+' 項功能';
}));
const entries=[
 ...data.features.map(f=>({title:f.name,terms:f.summary+' '+f.description,feature:f.id,type:'功能說明'})),
 {title:'開放職業',terms:'劍道 格鬥 弓箭 氣功 終極 超能 忍者',href:'#classes',type:'本頁章節'},
 {title:'裝備進度',terms:'武器 特武 強化精靈弓 防具 A級精鋼 修羅燄',href:'#equipment',type:'本頁章節'},
 {title:'開服版本',terms:'175 等級 147 技能 本洞 地圖 經驗 掉寶 倍率 純手動',href:'#version',type:'本頁章節'},
 {title:'遊戲理念',terms:'NO AUTO PLAY FREE TRADE FAIR PLAY STYLE POWER',href:'#philosophy',type:'本頁章節'},
 {title:'核心圖鑑',terms:'裝備 核心 怪物 掉落',href:'https://newyongdata.online/',type:'原資料庫'},
 {title:'收藏圖鑑',terms:'收藏 組合 核心 需求',href:'https://newyongdata.online/collections/',type:'原資料庫'},
 {title:'遊玩指南',terms:'實機 操作 影片 教學',href:'https://newyongdata.online/guide/overview.html',type:'原資料庫'},
 {title:'奧義技能',terms:'職業 技能 學習 需求',href:'https://newyongdata.online/ougi/',type:'原資料庫'},
 {title:'幻藏祭 第一彈｜獄龍降臨',terms:'銀皇 赤煞 燼金 金龍 冥焰 武器 套組 外觀 活動',href:'https://newyongdata.online/festival/',type:'本期活動'}
];
function renderSearch(){
 const terms=searchInput.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const matches=entries.filter(item=>terms.every(term=>(item.title+' '+item.terms).toLocaleLowerCase().includes(term)));
 searchResults.replaceChildren();
 document.getElementById('search-count').textContent=terms.length?'找到 '+matches.length+' 項結果':'功能與入口 · '+matches.length+' 項';
 for(const item of matches){
  const element=document.createElement(item.feature?'button':'a');element.className='search-result';
  const name=document.createElement('span');name.textContent=item.title;
  const type=document.createElement('small');type.textContent=item.type;
  element.append(name,type);
  if(item.feature){element.type='button';element.addEventListener('click',()=>openFeature(item.feature));}
  else{element.href=item.href;element.addEventListener('click',()=>search.close());}
  searchResults.append(element);
 }
 if(!matches.length){const empty=document.createElement('p');empty.className='search-empty';empty.textContent='找不到符合的功能或入口，請試試其他關鍵字。';searchResults.append(empty);}
}
function openSearch(){if(dialog.open)dialog.close();searchInput.value='';renderSearch();if(!search.open)search.showModal();searchInput.focus();}
document.getElementById('home-search-open').addEventListener('click',openSearch);
searchInput.addEventListener('input',renderSearch);
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(search.open)search.close();else openSearch();}});
const motion=document.getElementById('motion-toggle'),preference=matchMedia('(prefers-reduced-motion: reduce)');
function setCalm(calm){document.body.classList.toggle('calm',calm);motion.setAttribute('aria-pressed',String(calm));motion.setAttribute('aria-label',calm?'開啟背景動態':'關閉背景動態');motion.title=calm?'開啟背景動態':'關閉背景動態';}
setCalm(preference.matches);motion.addEventListener('click',()=>setCalm(!document.body.classList.contains('calm')));preference.addEventListener('change',()=>setCalm(preference.matches));
document.documentElement.dataset.homepageReady='true';
})();
