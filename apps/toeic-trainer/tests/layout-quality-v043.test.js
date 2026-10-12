'use strict';
/* V0.4.3 mobile UX + independent QA. Synthetic inputs only; never reads real user data. */
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ctx={};
for(const p of ['data/content.js','data/advanced.js','data/v04_bank.js','data/v041_progression.js','data/v042_official.js']){
  vm.runInNewContext(read(p),ctx,{filename:p});
}
const q=[...ctx.ToeicTrainerContent.questions.filter(x=>x.part>=5),...ctx.ToeicTrainerAdvanced.questions,...ctx.ToeicTrainerV04.questions,...ctx.ToeicTrainerV041.questions,...ctx.ToeicTrainerV042.questions];
const cards=[...ctx.ToeicTrainerContent.cards,...ctx.ToeicTrainerAdvanced.cards,...ctx.ToeicTrainerV04.cards];
const readings=[...ctx.ToeicTrainerAdvanced.readingLessons,...ctx.ToeicTrainerV04.readingLessons,...ctx.ToeicTrainerV041.readingLessons];
const grammar=[...ctx.ToeicTrainerAdvanced.grammarLessons,...ctx.ToeicTrainerV04.grammarLessons];
const audit=require('../js/quality-v043.js');
const report=audit.inspect({questions:q,cards,readingLessons:readings,grammarLessons:grammar});
const stored=JSON.parse(read('BANK_AUDIT_V043.json'));
assert(report.ok,'640 questions must have no verified structural failures');
assert.deepEqual(report.counts,stored.counts,'source-audit report must be exactly reproducible');
assert.equal(report.counts.questions,640);assert.equal(report.counts.cards,800);
assert.equal(report.counts.reading,43);assert.equal(report.counts.grammar,20);
assert.deepEqual([report.counts.part5,report.counts.part6,report.counts.part7],[368,44,228]);
assert.equal(report.counts.notSemanticallyCertified,640,'do not claim semantic certification');
assert(report.counts.flaggedForReview>0,'risk flags should not be swallowed');
assert(!report.reviewFlags.some(x=>x.code==='duplicate-id'));
// "it's" and "its" are valid distinct grammatical distractors; don't strip meaningful apostrophes.
const pronoun=q.find(x=>x.id==='v4-p5-178');assert(pronoun);
assert.equal(new Set(pronoun.options.map(x=>x.toLowerCase())).size,4);
assert(!report.blockedIds.includes(pronoun.id));
const broken=q.map(x=>({...x}));broken[0]={...broken[0],options:['same','same','different','fourth']};
const rejected=audit.inspect({questions:broken,cards,readingLessons:readings,grammarLessons:grammar});
assert(!rejected.ok&&rejected.blockedIds.includes(broken[0].id));
const duplicate=q.map(x=>({...x}));duplicate[20]={...duplicate[20],question:duplicate[19].question,passage:duplicate[19].passage};
assert(!audit.inspect({questions:duplicate,cards,readingLessons:readings,grammarLessons:grammar}).ok);
const html=read('index.html'),css=read('css/layout-v043.css'),app=read('js/app.js');
assert(html.includes('id="bridgeDisclosure"')&&html.includes('id="bridgePanel"'));
assert(html.includes('id="qualityStatus"'));
assert(html.includes('css/layout-v043.css?v=v0.5.0-auto-link-20261012'));
assert(html.indexOf('js/quality-v043.js')<html.indexOf('js/app.js'));
assert(html.indexOf('id="practiceSetup"')<html.indexOf('id="officialMockPanel"'),'daily practice before full mock');
assert(css.includes('.tt-quiz-active #readingCoach')&&css.includes('.tt-reading-active #readingCoach'));
assert(css.includes('.quiz-bottom')&&css.includes('position:sticky'));
assert(css.includes('grid-template-columns:repeat(6,minmax(0,1fr))'));
for(const chunk of ['function syncFocusShell()','function revealActiveExam(selector)','class="exam-index"','data-exam-index',
  'data-review-filter="wrong"','syncFocusShell();','readingResultVisible','byId(\'bridgeDisclosure\').open=true']){
  assert(app.includes(chunk),'Missing UX action: '+chunk);
}
for(const forbidden of ['localStorage.clear(','indexedDB.deleteDatabase(','lawLangGoalSystemV92','importGoalData(']){
  assert(!app.includes(forbidden),'Unexpected cross-app mutation: '+forbidden);
}
assert(read('js/core.js').includes("const VERSION='0.5.0'"));
assert(read('js/core.js').includes("const KEY='toeic-trainer-v01:learning-state'"));
assert(read('js/core.js').includes('const SCHEMA=1'));
assert(read('sw.js').includes('toeic-trainer-v0.5.0'));
for(const f of ['./css/layout-v043.css','./js/quality-v043.js'])assert(read('sw.js').includes(`'${f}'`));
console.log(`PASS: V0.4.3 UI and 640-item machine audit; ${report.counts.flaggedForReview} review-priority items; all original IDs/storage/submit-only safety preserved.`);
