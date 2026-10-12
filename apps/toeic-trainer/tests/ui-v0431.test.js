'use strict';
/* Presentation contract; never reads or mutates user data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const dir=path.resolve(__dirname,'..');
const expectedFrozen=Object.freeze({
  'data/content.js': 'c57f758c1e978e817397fbb76f54bbb2f8dd55f8d3600974ed0140af5d78cd4d',
  'data/advanced.js': 'dd421a186fca24ec6eff3553e25401fa16f31aa0ca51b73da5dc8fb1e5781a6f',
  'data/v04_bank.js': '56a77021c51b31450e0722c0599a5406e54c0d887feecda3b73ba329020440f5',
  'data/v041_progression.js': '2d0958ac4cd3b618ce460b58e6627dc6ec9280433dd671eae6cf39482e211ba5',
  'data/v042_official.js': 'f47e870da1fb1b43c5e76664a9bfadf805cd53c28bf6a981c723ff0a83822ea4',
  'js/bridge.js': '9ccfd3781ebcb585e23168bbbbe13d7cd72fd6489f8c35ce3c0dd7b7e5dcfc6d',
  'js/exam.js': '2d1ac55e1a1d41680a103babd99333e0d3144760b29bf56fe3c4530003f5ebc6',
  'js/quality-v043.js': 'fa5c82cd5161c6ac0730bab0429eb0d24bb733b268ed8c85bd3e3062f96562f2',
});
const read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const source=read('js/app.js'),html=read('index.html'),css=read('css/layout-v043.css');
assert(html.includes('id="homeStartGrammar"'));
assert(html.includes('class="intro-banner home-compact-hero"'));
assert(html.includes('class="word-dictionary" id="wordDictionary"'));
assert(html.includes('id="vocabSearch"')&&html.includes('id="vocabFilter"'));
assert(html.includes('id="practiceSetup"')&&html.includes('id="startOfficialMock"'));
assert(html.includes('class="reading-level-guide"'));
assert(html.includes('id="bridgeDisclosure"'));
for(const needle of ['VOCAB_PAGE_SIZE=8','vocabListPage','function renderReadingDocument(lesson)',
 'class="reading-document"','class="reading-paragraph"','id="readingQuizCount"',
 'Do not redraw a 400-word article','Exam.completed(readingRun.draft)',
 "byId('homeStartGrammar').onclick=()=>goQuick('grammar')"]){assert(source.includes(needle),'missing: '+needle)}
assert(source.includes('if(window.confirm(\'確認交卷？交卷後才會公布標準答案、逐句翻譯與文法解析。\'))finishReadingLesson();'));
for(const selector of ['.home-compact-hero','.reading-document','.word-pages','.draft-resume-banner','.collapsible-session-setup','.reading-level-guide']){assert(css.includes(selector),'missing style '+selector)}
for(const [rel,hash] of Object.entries(expectedFrozen)){
  const a=fs.readFileSync(path.join(dir,rel));
  assert.equal(crypto.createHash('sha256').update(a).digest('hex'),hash,rel+' should remain byte-identical');
}
assert(read('js/core.js').includes("const KEY='toeic-trainer-v01:learning-state'"));
assert(read('js/core.js').includes('const SCHEMA=1'));
assert(read('js/core.js').includes("const VERSION='0.5.0'"));
assert(read('sw.js').includes("const VERSION='toeic-trainer-v0.5.0'"));
assert(html.includes('v0.5.0-auto-link-20261012'));
assert(!/localStorage\.clear\(|indexedDB\.deleteDatabase\(/.test(source));
assert(!source.includes('lawLangGoalSystemV92'));
console.log('PASS: V0.4.3.1 focused home, continuous reading, compact paginated dictionary, unchanged graded test/historical schema and old banks.');
