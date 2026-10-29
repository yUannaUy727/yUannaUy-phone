// Restore widget styles from saved templates whenever home becomes usable.
(()=>{
'use strict';
function renderCSS(template){return String(template?.css||'').replace(/{{id}}/g,()=>String(template.id));}
function sync(){
 if(typeof db==='undefined'||!Array.isArray(db.widgetTemplates)||!document.head)return;
 const ids=new Set();
 for(const template of db.widgetTemplates){
  if(!template||!template.id)continue;
  const id='custom-widget-style-'+template.id;ids.add(id);let style=document.getElementById(id);
  if(!style){style=document.createElement('style');style.id=id;}
  const css=renderCSS(template);if(style.textContent!==css)style.textContent=css;
  // Place the current template after old gallery styles, without accumulating tags.
  document.head.appendChild(style);
  const preview=document.getElementById('preview-style-'+template.id);
  if(preview&&preview.textContent!==css)preview.textContent=css;
 }
 for(const style of document.head.querySelectorAll('style'))if(style.id?.startsWith('custom-widget-style-')&&!ids.has(style.id))style.remove();
}
function onResume(){if(!document.hidden&&document.getElementById('home-screen')?.classList.contains('active'))sync();}
window.UwUWidgetStyles={sync,renderCSS};
window.addEventListener('uwu-db-ready',sync);
window.addEventListener('pageshow',onResume);
document.addEventListener('visibilitychange',onResume);
})();
