/* V98.13.3 settings hub regression: synthetic data only; no real storage. */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const source=read('js/settings.js');
const css=read('css/design-system.css');
const tokens=read('css/tokens.css');
const catalog=read('js/catalog-lifecycle.js');
const status=read('js/autofetch-status.js');
const version=read('config/version.js');
const sw=read('sw.js');

assert.match(version,/GOAL_MANAGER_VERSION='98\.13\.3'/);
assert.match(version,/GOAL_MANAGER_SCHEMA_VERSION=6/);
assert.ok(sw.includes("importScripts('./config/version.js')"));
assert.ok(read('js/app.js').includes("const KEY='lawLangGoalSystemV92'"));
assert.ok(read('js/app.js').includes('BACKUP_KEYS='));

const storage=new Map();
const changes=[];
const classes=new Set();
const scheme={matches:true,addEventListener(name,cb){if(name==='change')this.onChange=cb}};
const documentElement={dataset:{},classList:{add:s=>classes.add(s),remove:s=>classes.delete(s),contains:s=>classes.has(s)}};
const settingsBody={innerHTML:'',dataset:{},querySelectorAll(){return []},querySelector(){return null},addEventListener(){}};
const modal={scrollTop:0,classList:{contains(){return false}}};
const context={
  console,
  document:{
    documentElement,
    body:{style:{}},
    addEventListener(){},
    getElementById(id){return id==='settingsBody'?settingsBody:id==='settingsModal'?modal:null}
  },
  window:{matchMedia(){return scheme},AppConfig:{version:'V98.13.3'}},
  localStorage:{
    getItem(k){return storage.has(k)?storage.get(k):null},
    setItem(k,v){changes.push(k);storage.set(k,String(v))}
  },
  toast(){},
  requestAnimationFrame(fn){fn()},
  GOAL_MANAGER_SCHEMA_VERSION:6
};
vm.createContext(context);
vm.runInContext(source,context,{filename:'js/settings.js'});
assert.strictEqual(changes.length,0,'loading settings must not rewrite storage');
assert.strictEqual(classes.has('app-dark'),true,'system dark must sync existing theme styles');
assert.strictEqual(documentElement.dataset.accent,'slate','default accent remains existing palette');

vm.runInContext('renderSettings()',context);
for(const title of ['外觀與顯示','提醒與通知','應用程式','資料與備份','系統健康']){
  assert.ok(settingsBody.innerHTML.includes(title),`${title} section not rendered`);
}
assert.strictEqual((settingsBody.innerHTML.match(/class="settings-hub-panel"/g)||[]).length,5);
assert.ok(settingsBody.innerHTML.includes('id="settingsHealthMount"'));
assert.ok(settingsBody.innerHTML.includes('exportDBWithFeedback()'));
assert.ok(settingsBody.innerHTML.includes('restoreLatestBackup()'));
assert.ok(settingsBody.innerHTML.includes('runDiagnostics()'));
assert.ok(settingsBody.innerHTML.includes('settings-hub-advanced'), 'destructive controls must be nested');
assert.ok(!settingsBody.innerHTML.includes('App 關閉後的定時背景推播。系統會'), 'no false background push claim');

vm.runInContext("setAppSetting('accent','sage')",context);
assert.strictEqual(documentElement.dataset.accent,'sage');
assert.deepStrictEqual(changes,['lawLangGoalSystem_settings_v1']);
assert.strictEqual(JSON.parse(storage.get('lawLangGoalSystem_settings_v1')).accent,'sage');
vm.runInContext("setAppSetting('accent','javascript:invalid')",context);
assert.strictEqual(documentElement.dataset.accent,'sage','invalid palette rejected');
assert.strictEqual(changes.length,1);
vm.runInContext("setAppSetting('appearance','light')",context);
assert.strictEqual(classes.has('app-dark'),false);
vm.runInContext("setAppSetting('appearance','system')",context);
assert.strictEqual(classes.has('app-dark'),true);
const writes=changes.length;
scheme.matches=false;scheme.onChange();
assert.strictEqual(classes.has('app-dark'),false,'OS scheme change should apply without reloading');
assert.strictEqual(changes.length,writes,'OS scheme must not write to localStorage');
assert.ok(changes.every(k=>k==='lawLangGoalSystem_settings_v1'),'must never write the goal DB or backups');
vm.runInContext('resetAppSettings()',context);
assert.strictEqual(documentElement.dataset.accent,'slate');

assert.ok(tokens.includes('html[data-accent="sage"]'));
assert.ok(tokens.includes('html.app-dark[data-accent="plum"]'));
assert.ok(tokens.includes('html[data-text-size="large"]'));
assert.ok(css.includes('.settings-hub-nav')&&css.includes('.settings-hub-panel'));
assert.ok(css.includes('.settings-switch input:focus-visible'));
// Regression: the existing activity review and mobile tests require the
// canonical Phase-3 block to remain the final CSS block, not a new layer.
for(const [name,source] of [['design-system.css',css],['tokens.css',tokens]]){
  const end='/* GM-VISUAL-PHASE3-20261008-END */';
  const feature='/* GM-SETTINGS-HUB-20261008:';
  assert.strictEqual(source.split(feature).length-1,1,`${name}: exactly one settings block`);
  assert(source.trimEnd().endsWith(end),`${name}: no styles after canonical terminator`);
  assert(source.indexOf(feature)<source.lastIndexOf(end),`${name}: settings CSS must be integrated within Phase-3`);
}
assert.ok(catalog.includes('document.getElementById("settingsHealthMount")'));
assert.ok(status.includes('document.getElementById("settingsHealthMount")'));
assert.ok(status.includes('if(mount){mount.insertAdjacentHTML("beforeend",html);return;}'));
assert.ok(catalog.includes('if(mount)mount.insertAdjacentHTML("beforeend",catalogLifecyclePanelHTML());'));
console.log('OK: Settings Hub five sections, safe settings state, system dark, accent, storage boundary, source-monitor mount, PWA schema');
