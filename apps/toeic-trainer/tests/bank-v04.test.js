'use strict';
/* Offline release QA for written-only expansion. No persisted user data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const ctx={};
for(const file of ['data/content.js','data/advanced.js','data/v04_bank.js']){
  vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
}
const Core=require('../js/core.js');
const Audit=require('../js/bank-audit.js');
const legacy=ctx.ToeicTrainerContent,advanced=ctx.ToeicTrainerAdvanced,addition=ctx.ToeicTrainerV04;
const cards=[...legacy.cards,...advanced.cards,...addition.cards];
const questions=[...legacy.questions.filter(q=>q.part>=5),...advanced.questions,...addition.questions];
const readingLessons=[...advanced.readingLessons,...addition.readingLessons];
const grammarLessons=[...advanced.grammarLessons,...addition.grammarLessons];
const result=Audit.audit({cards,questions,readingLessons,grammarLessons});
assert.deepEqual(Array.from(result.errors),[],result.errors.join('\n'));
assert.equal(result.ok,true);
assert.equal(cards.length,800);
assert.equal(questions.length,524);
assert.equal(readingLessons.length,34);
assert.equal(grammarLessons.length,20);
assert.equal(questions.filter(q=>q.part===5).length,338);
assert.equal(questions.filter(q=>q.part===6).length,28);
assert.equal(questions.filter(q=>q.part===7).length,158);
assert.equal(addition.cards.length,728);
assert.equal(addition.questions.length,465);
assert.equal(addition.readingLessons.length,28);
assert.equal(addition.grammarLessons.length,11);
assert.equal(Core.SCHEMA,1);
assert.equal(Core.KEY,'toeic-trainer-v01:learning-state');
assert.equal(Core.VERSION,'0.5.0');
assert.deepEqual(Array.from(Core.validateBank(cards,questions)),[]);
const originalCardIds=new Set([...legacy.cards,...advanced.cards].map(c=>c.id));
const originalQuestionIds=new Set([...legacy.questions.filter(q=>q.part>=5),...advanced.questions].map(q=>q.id));
for(const c of [...legacy.cards,...advanced.cards])assert(cards.find(x=>x.id===c.id));
for(const q of [...legacy.questions.filter(q=>q.part>=5),...advanced.questions])assert(questions.find(x=>x.id===q.id));
for(const c of addition.cards)assert(!originalCardIds.has(c.id));
for(const q of addition.questions)assert(!originalQuestionIds.has(q.id));
for(const lesson of addition.readingLessons){
  const linked=addition.questions.filter(q=>q.readingId===lesson.id);
  assert.equal(linked.length,5,lesson.id+' should have five non-reused assessment items');
  assert.equal(new Set(linked.map(q=>q.question.toLowerCase())).size,5);
  for(const q of linked){
    const answer=q.options[q.answer].toLowerCase().replace(/[.]/g,'').trim();
    assert(q.passage.toLowerCase().replace(/[.]/g,'').includes(answer),q.id+': answer not anchored in its own passage');
  }
}
for(const q of addition.questions.filter(q=>q.part===6)){
  const pos=q.id.match(/-(\d+)$/)[1];
  assert(q.passage.includes('['+pos+']'),q.id+' missing gap');
}
assert(Core.chooseQuestions(questions,{mode:'reading',count:200}).every(x=>[6,7].includes(x.part)));
assert(Core.chooseQuestions(questions,{mode:'grammar',count:200}).every(x=>[5,6].includes(x.part)));
assert.equal(Core.chooseQuestions(questions,{mode:'listening',count:50}).length,0);
assert.equal(Core.chooseQuestions(questions,{mode:'reading',readingId:addition.readingLessons[27].id,count:10}).length,5);
const practice={questionStats:{'p5-01':{correct:2,wrong:1},'v4-p5-001':{correct:0,wrong:2}},savedWordIds:['v013','v072'],sessions:[{appId:Core.APP_ID,id:'tt-old-session',mode:'reading',unit:'article',questionIds:['r-email-q1'],seconds:175,questionsAnswered:1,correct:1,date:'2026-10-11'}]};
const state=Core.normalized({...practice,appId:Core.APP_ID,schema:1,version:'0.3.0'});
assert.deepEqual(state.questionStats,practice.questionStats);
assert.deepEqual(state.savedWordIds,practice.savedWordIds);
assert.equal(state.sessions[0].id,'tt-old-session');
const readingState=Core.normalized({...practice,appId:Core.APP_ID,schema:1,readingProgress:{'r-notice':{attempts:2,best:60,lastAt:'2026-10-11'},'v4-r-education':{attempts:1,best:100,lastAt:'2026-10-12'}},savedWordIds:['v013','v072','v800']});
assert.equal(readingState.readingProgress['r-notice'].attempts,2);
assert.equal(readingState.readingProgress['v4-r-education'].best,100);
assert(readingState.savedWordIds.includes('v800'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
assert(html.indexOf('data/v04_bank.js')<html.indexOf('js/app.js'));
assert(html.indexOf('js/bank-audit.js')<html.indexOf('js/app.js'));
assert(sw.includes('data/v04_bank.js')&&sw.includes('js/bank-audit.js'));
assert(js.includes('...V04.cards')&&js.includes('...V04.questions'));
assert(js.includes('BankAudit.audit('));
for(const forbidden of ['localStorage.clear(',"'lawLangGoalSystemV92'",'indexedDB.deleteDatabase(']){
  for(const file of ['js/app.js','js/bank-audit.js','data/v04_bank.js'])assert(!fs.readFileSync(path.join(root,file),'utf8').includes(forbidden));
}
// Corruption and duplicate mutation must never silently pass release audit.
const dupe=Object.assign({},questions[0],{id:'new-id-but-same-content'});
const rejected=Audit.audit({cards,questions:[...questions,dupe],readingLessons,grammarLessons});
assert(rejected.errors.some(e=>e.includes('重複收錄')));
const variant={...questions[0],id:'new-id-but-answer-duplicate',options:['A','A','C','D']};
const rejectedOptions=Audit.audit({cards,questions:[...questions,variant],readingLessons,grammarLessons});
assert(rejectedOptions.errors.some(e=>e.includes('選項不足或重複')));
console.log('PASS: V0.4 800 unique word entries, 524 distinct written items (338/28/158), 34 articles, 20 grammar topics; preserved legacy IDs and history.');
console.log('NOTICE: Structural uniqueness does not certify human-level grammar/semantic validation.');
