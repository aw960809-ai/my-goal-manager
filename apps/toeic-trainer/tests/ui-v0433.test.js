'use strict';
/* Settings/appearance hub UI regression with synthetic storage only. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),app=read('js/app.js'),skin=read('css/preferences-v0433.css'),sw=read('sw.js');
const prefs=require('../js/preferences.js');
const ids=[...html.matchAll(/\bid="([A-Za-z][\w-]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,'no duplicate DOM ids');
for(const id of ['tab-home','tab-vocab','tab-practice','tab-mistakes','tab-history','tab-settings',
  'analysisSwitcher','settingsAppearancePanel','settingsAppearanceButtons','settingsAccentButtons','settingsTextSizeButtons',
  'vocabViewTabs','vocabLibraryPanel','vocabPageTitle','vocabPageDescription','wordDictionary','vocabFilter','vocabSearch','settingsDataPanel','exportBackup','importBackupInput',
  'settingsGoalTools','bridgeDisclosure','loadGoalSnapshot','settingsInformation','qualityDisclosure','qualityStatus']){
  assert(ids.includes(id),'missing '+id);
}
const mainNav=(html.match(/<nav class="main-nav"[\s\S]*?<\/nav>/)||[])[0]||'';
assert.equal((mainNav.match(/class="nav-btn/g)||[]).length,6,'exactly six top-level destinations');
for(const dest of ['home','reading','vocab','grammar','analysis','settings'])assert(mainNav.includes('data-tab="'+dest+'"'));
assert(!mainNav.includes('data-tab="history"')&&!mainNav.includes('data-tab="mistakes"'));
const history=html.split('<section id="tab-history"')[1].split('<section id="tab-settings"')[0];
const home=html.split('<section id="tab-home"')[1].split('<section id="tab-vocab"')[0];
assert(!history.includes('id="exportBackup"')&&!history.includes('id="bridgeDisclosure"'),'records contain no data maintenance tools');
assert(!home.includes('id="qualityDisclosure"')&&!home.includes('architecture-disclosure'),'home shows practice & progress, not system tools');
assert(html.split('<section id="tab-vocab"')[1].split('<section id="tab-practice"')[0].includes('id="wordDictionary"'),'dictionary belongs to learning area');
assert(!html.split('<section id="tab-settings"')[1].includes('id="wordDictionary"'),'settings must not contain dictionary');
assert(html.includes('id="analysisSwitcher"')&&html.includes('data-analysis-tab="mistakes"')&&html.includes('data-analysis-tab="history"'));
assert(app.includes("if(id==='analysis')id='mistakes'"));
assert(app.includes("if(id==='settings')renderSettings()"));
assert(app.includes("const a=btn.dataset.tab===(['mistakes','history'].includes(id)?'analysis':id)"));
assert(app.includes("tab('history')"),'legacy post-exam link remains functional');
for(const property of ['system','light','dark','slate','indigo','graphite','teal'])assert(html.includes('"'+property+'"'));
for(const token of ['--tt-dark-accent','--tt-light-accent','data-appearance="dark"','data-appearance="system"','data-accent="slate"','data-accent="indigo"','data-accent="graphite"','data-accent="teal"','.analysis-switcher','#tab-settings'])assert(skin.includes(token),'missing style '+token);
assert.equal(prefs.KEY,'toeic-trainer:ui-preferences-v1');
const events=new Map();const store={getItem:k=>events.get(k)||null,setItem:(k,v)=>events.set(k,v)};
assert.deepEqual(prefs.load(store),{appearance:'system',accent:'slate',textSize:'normal'});
const value=prefs.save(store,{appearance:'dark',accent:'indigo',textSize:'large'});
assert.equal(value.appearance,'dark');assert.equal(value.accent,'indigo');
const dom={dataset:{}};prefs.apply(dom,prefs.load(store));
assert.deepEqual(dom.dataset,{appearance:'dark',accent:'indigo',textSize:'large'});
assert.equal(prefs.load({getItem:()=>'{corrupt'}).accent,'slate','bad preference JSON safe fallback');
assert.equal(prefs.normalize({appearance:'<script>',accent:'x',textSize:'n'}).accent,'slate','reject invalid style choices');
assert.throws(()=>prefs.save({getItem(){return null},setItem(){throw new Error('quota')}},value),/quota/);
assert.equal(sw.includes('toeic-trainer-v0.5.0'),true);
assert.equal(sw.includes("'./css/preferences-v0433.css'"),true);
assert.equal(sw.includes("'./js/preferences.js'"),true);
assert(read('js/core.js').includes("const KEY='toeic-trainer-v01:learning-state'"));
assert(read('js/core.js').includes('const SCHEMA=1'));
for(const f of ['js/app.js','js/preferences.js','css/preferences-v0433.css','index.html']){
 const src=read(f);
 for(const forbidden of ['localStorage.clear(','indexedDB.deleteDatabase(','lawLangGoalSystemV92','/api/goal-events'])assert(!src.includes(forbidden),'unsafe '+f+' '+forbidden);
}
// New surface may not silently edit banks, exam or goal bridge.
const frozen={
'data/content.js':'c57f758c1e978e817397fbb76f54bbb2f8dd55f8d3600974ed0140af5d78cd4d',
'data/advanced.js':'dd421a186fca24ec6eff3553e25401fa16f31aa0ca51b73da5dc8fb1e5781a6f',
'data/v04_bank.js':'56a77021c51b31450e0722c0599a5406e54c0d887feecda3b73ba329020440f5',
'data/v041_progression.js':'2d0958ac4cd3b618ce460b58e6627dc6ec9280433dd671eae6cf39482e211ba5',
'data/v042_official.js':'f47e870da1fb1b43c5e76664a9bfadf805cd53c28bf6a981c723ff0a83822ea4',
'js/exam.js':'2d1ac55e1a1d41680a103babd99333e0d3144760b29bf56fe3c4530003f5ebc6',
'js/bridge.js':'9ccfd3781ebcb585e23168bbbbe13d7cd72fd6489f8c35ce3c0dd7b7e5dcfc6d'
};
for(const [file,hash] of Object.entries(frozen))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,file);
console.log('PASS: V0.5.0 settings hub, theme persistence, analysis routing, safe boundaries and immutable study banks.');
