'use strict';
/* Quick navigation regression. All user data is synthetic; no storage is read. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),app=read('js/app.js'),css=read('css/layout-v043.css');
for(const id of ['readingBrowser','readingLevelTabs','readingSearch','readingBrowserCount','readingArticleList','readingLoadMore',
  'grammarBrowser','grammarSearch','grammarCategoryTabs','grammarTopicList','grammarLoadMore',
  'vocabQuickFilters','vocabCategoryDetails','vocabCategoryTabs',
  'readingLevelSelect','readingLessonSelect','grammarTopicSelect','vocabFilter',
  'vocabCount','practicePart','practiceTier','practiceCount']){
 assert(html.includes('id="'+id+'"'),`Missing element ${id}`);
}
assert.equal((html.match(/id="readingLessonSelect"/g)||[]).length,1,'one canonical reading select');
assert.equal((html.match(/id="grammarTopicSelect"/g)||[]).length,1,'one canonical grammar select');
for(const label of ['foundation','intermediate','advanced','legacy','all'])assert(html.includes('data-reading-level="'+label+'"'));
for(const cat of ['recommended','verbs','words','clauses','advanced','all'])assert(html.includes('data-grammar-category="'+cat+'"'));
for(const filter of ['all','due','saved','office','business','finance','hiring','travel','budget'])assert(html.includes('data-vocab-filter="'+filter+'"'));
for(const token of ['function renderReadingBrowser()','function renderGrammarBrowser()','function syncVocabFilterButtons()',
  'function enhanceChoiceSelect(id,labels)','function syncChoiceButtons()',
  'const GRAMMAR_GROUPS=Object.freeze','readingListPage','grammarListPage',
  "byId('readingLessonSelect').value=value;","byId('startTopicPractice').click();",
  'startReadingLesson();',"new Event('change',{bubbles:true})"]){assert(app.includes(token),'missing UX hook '+token)}
for(const selector of ['.tt-legacy-pick{display:none!important}','.tt-compact-list','.tt-reading-tabs','.tt-grammar-tabs','.tt-vocab-tabs','.tt-choice-tabs']){
 assert(css.includes(selector),'missing CSS selector '+selector);
}
// All 20 canonical grammar topics occur in exactly one category; recommendations are a *view*, not new lessons.
const def=app.match(/const GRAMMAR_GROUPS=Object\.freeze\(\{([\s\S]*?)\}\);/);
assert(def,'missing grammar category definition');
const topics=[...def[1].matchAll(/'([a-z-]+)'/g)].map(x=>x[1]);
assert.equal(topics.length,20,'all 20 subjects categorized');
assert.equal(new Set(topics).size,20,'categories cannot duplicate topics');
// No new bank data. New UI changes must not corrupt old exercise IDs, local storage, or the mock exam.
const frozen={
 'data/content.js':'c57f758c1e978e817397fbb76f54bbb2f8dd55f8d3600974ed0140af5d78cd4d',
 'data/advanced.js':'dd421a186fca24ec6eff3553e25401fa16f31aa0ca51b73da5dc8fb1e5781a6f',
 'data/v04_bank.js':'56a77021c51b31450e0722c0599a5406e54c0d887feecda3b73ba329020440f5',
 'data/v041_progression.js':'2d0958ac4cd3b618ce460b58e6627dc6ec9280433dd671eae6cf39482e211ba5',
 'data/v042_official.js':'f47e870da1fb1b43c5e76664a9bfadf805cd53c28bf6a981c723ff0a83822ea4',
 'js/exam.js':'2d1ac55e1a1d41680a103babd99333e0d3144760b29bf56fe3c4530003f5ebc6'
};
for(const [file,sum] of Object.entries(frozen)){
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),sum,'unexpected change '+file);
}
assert(read('js/core.js').includes("const VERSION='0.5.0'"));
assert(read('js/core.js').includes("const KEY='toeic-trainer-v01:learning-state'"));
assert(read('js/core.js').includes('const SCHEMA=1'));
assert(read('sw.js').includes("const VERSION='toeic-trainer-v0.5.0'"));
assert(html.includes('v0.5.0-auto-link-20261012'));
for(const s of ['localStorage.clear(', 'indexedDB.deleteDatabase(', 'lawLangGoalSystemV92'])assert(!app.includes(s));
console.log('PASS: 0.5.0 reading, grammar & vocab direct controls; unique 20 topics, original bank, exam engine and personal history preserved.');
