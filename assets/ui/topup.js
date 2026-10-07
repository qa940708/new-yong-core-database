/* Cumulative top-up: public reward information, no account or payment operations. */
(()=>{'use strict';
const data=JSON.parse(document.getElementById('topup-data').textContent);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const fmt=n=>new Intl.NumberFormat('zh-TW').format(n);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rewards=new Map(data.rewards.map(r=>[r.id,r]));
const dialog=$('#reward-dialog'),video=$('#reward-video');let trigger=null;
const rewardPreview=r=>`<button type="button" class="reward-preview" data-reward="${r.id}" aria-label="觀看${esc(r.name)}實裝影片"><span class="reward-image"><img src="${r.poster}" alt="${esc(r.name)}實裝畫面" width="640" height="480"></span><span class="reward-caption"><img src="${r.icon}" alt="" width="35" height="35"><span><small>${esc(r.category)} · 觀看實裝</small><strong>${esc(r.name)}</strong></span></span></button>`;
function selectTier(id,options={}){const tier=data.tiers.find(t=>t.id===id)||data.tiers.find(t=>t.id==='20k');
$$('[data-tier-pick]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tierPick===tier.id)));
$('#tier-detail').innerHTML=`<div class="tier-detail-head"><span class="tier-box"><img src="${tier.icon}" alt="${tier.label}累積儲值禮盒" width="35" height="35"></span><div><small>CUMULATIVE TOP-UP / ${tier.label}</small><h3 id="tier-title"><span class="tier-amount">NT$ ${fmt(tier.amount)}</span> <span class="tier-title-label">累積獎勵</span></h3><p>達成門檻後，此階獎勵可領取一次。</p></div></div><div class="tier-body"><h4 class="tier-label">實用道具 <span>綁定</span></h4><ul class="supply-list">${data.supplies.filter(s=>tier.quantities[s.id]>0).map(s=>`<li><img src="${s.icon}" alt="" width="35" height="35"><span class="item-name">${esc(s.name)}</span><strong>× ${tier.quantities[s.id]}<small>${s.unit}</small></strong></li>`).join('')}</ul><h4 class="tier-label">${tier.rewards.length?'專屬外觀與徽章 <span>永久・綁定・無能力加成</span>':'本階回饋'}</h4>${tier.rewards.length?`<div class="tier-rewards">${tier.rewards.map(id=>rewardPreview(rewards.get(id))).join('')}</div>`:'<p class="tier-no-special">本階提供實用道具禮盒；徽章獎勵自 20K 起，服飾外觀自 30K 起。</p>'}<p class="tier-note">上方為此階「新增」獎勵，前面已達成的門檻仍可各領取一次。<a href="#reward-table">查看完整 14 階配置 →</a></p></div>`;
$('#tier-announcement').textContent=`已選擇 ${fmt(tier.amount)} 元門檻，${tier.rewards.length} 款專屬獎勵。`;
if(options.history!==false){const u=new URL(location.href);u.searchParams.set('tier',tier.id);u.hash='tiers';history.pushState(null,'',u);}
if(options.scroll){$('#tier-detail').scrollIntoView({behavior:'auto',block:'start'});$('#tier-title').setAttribute('tabindex','-1');$('#tier-title').focus({preventScroll:true});}}
function openReward(id,button){const r=rewards.get(id);if(!r)return;trigger=button;video.pause();$('#reward-title').textContent=r.name;$('#reward-meta').textContent=`${r.category} / 累積 NT$ ${fmt(r.amount)}`;$('#reward-desc').textContent=r.description;$('#reward-video-error').hidden=true;$('#original-video-link').href=r.video;video.poster=r.poster;video.src=r.video;video.load();dialog.showModal();}
document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.dataset.tierPick)selectTier(b.dataset.tierPick,{scroll:true});if(b.dataset.tierJump)selectTier(b.dataset.tierJump,{scroll:true});if(b.dataset.reward)openReward(b.dataset.reward,b);if(b.dataset.rewardFilter){$$('[data-reward-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));let count=0;$$('.reward-card').forEach(card=>{card.hidden=b.dataset.rewardFilter!=='全部'&&card.dataset.category!==b.dataset.rewardFilter;if(!card.hidden)count++;});$('#reward-count').textContent=`顯示 ${count} 款 / 共 13 款`;}});
$('#reward-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
dialog.addEventListener('close',()=>{video.pause();video.removeAttribute('src');video.load();trigger?.focus({preventScroll:true});});
video.addEventListener('error',()=>{if(video.hasAttribute('src'))$('#reward-video-error').hidden=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});
window.addEventListener('popstate',()=>{if(dialog.open)dialog.close();selectTier(new URLSearchParams(location.search).get('tier'),{history:false});});
selectTier(new URLSearchParams(location.search).get('tier'),{history:false});
})();
