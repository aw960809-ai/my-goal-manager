'use strict';
/* UI regression: vocabulary reference belongs to Vocabulary, not Settings. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('index.html'),app=read('js/app.js'),css=read('css/preferences-v0433.css');
const oldDictLocation=html.split('<section id="tab-settings"')[1];
const vocabLocation=html.split('<section id="tab-vocab"')[1].split('<section id="tab-practice"')[0];
assert(vocabLocation.includes('id="vocabViewTabs"')&&vocabLocation.includes('id="vocabLibraryPanel"'));
assert(vocabLocation.includes('id="wordDictionary"'));
assert(!oldDictLocation.includes('id="wordDictionary"')&&!oldDictLocation.includes('id="settingsDictionaryPanel"'));
assert(!html.includes('單字庫搜尋與收藏整理已移至「設定」'));
for(const id of ['vocabIntro','vocabSession','vocabCount','vocabFilter','vocabSearch','vocabLookupList',
'wordDictionaryCount','vocabCategoryTabs','vocabQuickFilters','settingsAppearancePanel','settingsDataPanel','settingsGoalTools']){
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'one '+id);
}
const ids=[...html.matchAll(/\bid="([A-Za-z][\w-]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'no duplicate ids');
for(const key of ['function syncVocabView()','function changeVocabView(view)','vocabView=\'test\'',
  'byId(\'vocabLibraryPanel\').hidden=!library','byId(\'vocabViewTabs\').hidden=running',
  'const pool=cards;const due=pool.filter','renderWordLookup();',
  'if(view===\'library\'&&quiz?.context===\'vocab\')'])assert(app.includes(key),'missing '+key);
const startVocab=app.slice(app.indexOf('function startVocab(){'),app.indexOf('function updateReadingLevelHint(){'));
assert(!startVocab.includes('const pool=vocabMatching()'),'dictionary filters must not affect exam pool');
assert(css.includes('#tab-vocab .vocab-view-switch')&&css.includes('#tab-vocab #vocabLibraryPanel[hidden]'));
assert(read('js/core.js').includes("const VERSION='0.5.0'"));
assert(read('js/core.js').includes("const KEY='toeic-trainer-v01:learning-state'"));
assert(read('js/core.js').includes('const SCHEMA=1'));
assert(read('sw.js').includes("const VERSION='toeic-trainer-v0.5.0'"));
assert(html.includes('v0.5.0-auto-link-20261012'));
for(const [f,sha] of Object.entries({
 'data/content.js':'c57f758c1e978e817397fbb76f54bbb2f8dd55f8d3600974ed0140af5d78cd4d',
 'data/advanced.js':'dd421a186fca24ec6eff3553e25401fa16f31aa0ca51b73da5dc8fb1e5781a6f',
 'data/v04_bank.js':'56a77021c51b31450e0722c0599a5406e54c0d887feecda3b73ba329020440f5',
 'data/v041_progression.js':'2d0958ac4cd3b618ce460b58e6627dc6ec9280433dd671eae6cf39482e211ba5',
 'data/v042_official.js':'f47e870da1fb1b43c5e76664a9bfadf805cd53c28bf6a981c723ff0a83822ea4',
 'js/exam.js':'2d1ac55e1a1d41680a103babd99333e0d3144760b29bf56fe3c4530003f5ebc6',
 'js/bridge.js':'9ccfd3781ebcb585e23168bbbbe13d7cd72fd6489f8c35ce3c0dd7b7e5dcfc6d',
})){
 const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
 assert.equal(actual,sha,'immutable '+f);
}
for(const f of ['js/app.js','index.html','css/preferences-v0433.css']){
 const source=read(f);
 for(const forbidden of ['localStorage.clear(', 'indexedDB.deleteDatabase(', 'lawLangGoalSystemV92', '/api/goal-events'])
  assert(!source.includes(forbidden),'unsafe '+f+' '+forbidden);
}
console.log('PASS: V0.5.0 dictionary back on vocabulary tab, exam-only display lock, filter isolation, immutable banks and history format.');
