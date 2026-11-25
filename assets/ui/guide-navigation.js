(()=>{'use strict';
const header=document.getElementById('yo-site-header');if(!header)return;
const groups=[...header.querySelectorAll('.yo-nav-group')];
groups.forEach(group=>group.addEventListener('toggle',()=>{if(group.open)groups.forEach(other=>{if(other!==group)other.open=false;});}));
const toggle=header.querySelector('.yo-menu-toggle');
toggle.addEventListener('click',()=>{const open=header.classList.toggle('yo-menu-open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'關閉導覽選單':'開啟導覽選單');});
document.addEventListener('click',event=>{if(!header.contains(event.target))groups.forEach(g=>g.open=false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const opened=groups.find(g=>g.open);if(opened){opened.open=false;opened.querySelector('summary').focus();}else if(header.classList.contains('yo-menu-open')){header.classList.remove('yo-menu-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','開啟導覽選單');toggle.focus();}}});
})();
