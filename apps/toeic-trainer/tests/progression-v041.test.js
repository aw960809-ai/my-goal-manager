'use strict';
/* V0.4.1 original graded content/contract checks; no real user data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ctx={};
for(const f of ['data/content.js','data/advanced.js','data/v04_bank.js','data/v041_progression.js']){
  vm.runInNewContext(read(f),ctx,{filename:f});
}
const previous=ctx.ToeicTrainerV04,added=ctx.ToeicTrainerV041;
const Core=require('../js/core.js'),Bank=require('../js/bank-audit.js'),Length=require('../js/length-policy.js');
const oldCards=[...ctx.ToeicTrainerContent.cards,...ctx.ToeicTrainerAdvanced.cards];
const oldQuestions=[...ctx.ToeicTrainerContent.questions.filter(q=>[5,6,7].includes(q.part)),...ctx.ToeicTrainerAdvanced.questions,...previous.questions];
const oldReadings=[...ctx.ToeicTrainerAdvanced.readingLessons,...previous.readingLessons];
const oldGrammar=[...ctx.ToeicTrainerAdvanced.grammarLessons,...previous.grammarLessons];
const fullQuestions=[...oldQuestions,...added.questions];
const fullReadings=[...oldReadings,...added.readingLessons];
const p=Length.audit({readingLessons:added.readingLessons,questions:added.questions,existingReadingIds:oldReadings.map(l=>l.id),existingQuestionIds:oldQuestions.map(q=>q.id)});
assert.equal(p.ok,true,p.errors.join('\n'));
const qa=Bank.audit({cards:[...oldCards,...previous.cards],questions:fullQuestions,readingLessons:fullReadings,grammarLessons:oldGrammar,
  expected:{cards:800,questions:587,reading:43,grammar:20,part5:356,part6:28,part7:203}});
assert.equal(qa.ok,true,qa.errors.join('\n'));
assert.equal(fullQuestions.length,587);
assert.equal(fullReadings.length,43);
assert.equal(added.readingLessons.length,9);
assert.equal(added.questions.length,63);
assert.equal(Core.VERSION,'0.5.0');
assert.equal(Core.KEY,'toeic-trainer-v01:learning-state');
assert.equal(Core.SCHEMA,1);
for(const tier of ['foundation','intermediate','advanced']){
  const L=Length.filterLessons(fullReadings,tier);
  assert.equal(L.length,3,tier+' reading lessons');
  assert.equal(added.questions.filter(q=>q.tier===tier&&q.part===5).length,6,tier+' grammar questions');
  const s=Core.chooseQuestions(fullQuestions,{mode:'reading',tier,part:7,count:80,random:()=>.5});
  assert.equal(s.length,15);
  assert(s.every(q=>q.tier===tier && q.part===7));
  const g=Core.chooseQuestions(fullQuestions,{mode:'grammar',tier,part:5,count:80,random:()=>.5});
  assert.equal(g.length,6);
  assert(g.every(q=>q.tier===tier&&q.part===5));
  const next=Length.pickNextArticle(L,{[`${L[0].id}-q1`]:{correct:2,wrong:0}},fullQuestions);
  assert.equal(next.id,L[1].id,'non-repetitive passage allocation');
  for(const lesson of L){
    const linked=fullQuestions.filter(q=>q.readingId===lesson.id);
    const selected=Core.chooseQuestions(fullQuestions,{mode:'reading',tier,part:7,readingId:lesson.id,count:10});
    assert.equal(selected.length,5);
    assert.equal(linked.length,5);
    for(const q of linked){
      assert.equal(q.passage,Length.readingText(lesson));
      assert.equal(q.evidence,lesson.sentences[q.evidenceIndex].en);
    }
  }
}
assert.equal(Length.filterLessons(fullReadings,'legacy').length,34);
assert.equal(Length.filterLessons(fullReadings,'all').length,43);
assert.equal(Length.nextLevel('foundation'),'intermediate');
assert.equal(Length.nextLevel('intermediate'),'advanced');
assert.equal(Length.nextLevel('advanced'),null);
assert.equal(Core.chooseQuestions(fullQuestions,{mode:'listening',tier:'advanced'}).length,0);
const frozen = {
  appId:Core.APP_ID,schema:1,version:'0.4.0',createdAt:'2026-10-11T14:00:00.000Z',
  review:{v072:{repetitions:2,intervalDays:7}},questionStats:{'v4-p5-001':{correct:1,wrong:2}},
  sessions:[{appId:Core.APP_ID,id:'tt-v04-old-15468',date:'2026-10-11',mode:'reading',unit:'article',seconds:180,questionsAnswered:5,correct:4,questionIds:['v4-r-facility-q1']}],
  savedWordIds:['v001','v800'],readingProgress:{'v4-r-facility':{attempts:4,best:80,lastAt:'2026-10-11T12:00:00.000Z'}}
};
const migrated=Core.normalized(frozen);
assert.deepEqual(migrated.review,frozen.review);
assert.deepEqual(migrated.questionStats,frozen.questionStats);
assert.deepEqual(migrated.sessions,frozen.sessions);
assert.deepEqual(migrated.savedWordIds,frozen.savedWordIds);
assert.deepEqual(migrated.readingProgress,frozen.readingProgress);
const reread=Core.normalized({...frozen,readingProgress:{...frozen.readingProgress,'v41-r-procurement':{attempts:1,best:80,lastAt:'2026-10-12T01:00:00.000Z'}}});
assert.equal(reread.readingProgress['v41-r-procurement'].best,80);
assert.equal(Core.chooseQuestions(fullQuestions,{mode:'reading',tier:'legacy',count:100}).filter(q=>q.id.startsWith('v41')).length,0);
const html=read('index.html');
for(const tag of ['id="readingLevelSelect"','id="practiceTier"','v0.5.0-auto-link-20261012','data/v041_progression.js','js/length-policy.js'])assert(html.includes(tag));
assert(html.indexOf('data/v04_bank.js')<html.indexOf('data/v041_progression.js'));
assert(html.indexOf('js/length-policy.js')<html.indexOf('js/app.js'));
const app=read('js/app.js');
for(const str of ['...V041.questions','...V041.readingLessons','LengthPolicy.audit','updateReadingLevelOptions','practiceTier','pickNextArticle'])assert(app.includes(str),str);
const sw=read('sw.js');
assert(sw.includes("const VERSION='toeic-trainer-v0.5.0'"));
assert(sw.includes("'./data/v041_progression.js'"));
assert(sw.includes("'./js/length-policy.js'"));
for(const f of ['js/app.js','js/core.js','js/bank-audit.js','js/length-policy.js','data/v041_progression.js']){
  for(const disallow of ['localStorage.clear(','indexedDB.deleteDatabase(',"'lawLangGoalSystemV92'"]){
    assert(!read(f).includes(disallow),f+': disallowed cross-app mutation');
  }
}
// Deliberate sabotage: length, repeated evidence, wrong answer, or old ID cannot pass.
const broken=added.readingLessons.map(x=>({...x}));
broken[0]={...broken[0],wordCount:900};
assert(!Length.audit({readingLessons:broken,questions:added.questions}).ok);
const repeated=added.questions.map(q=>({...q}));
repeated[1]={...repeated[1],evidenceIndex:repeated[0].evidenceIndex,evidence:repeated[0].evidence};
assert(!Length.audit({readingLessons:added.readingLessons,questions:repeated}).ok);
const duplicate=added.questions.map(q=>({...q}));
duplicate[0]={...duplicate[0],id:oldQuestions[0].id};
assert(!Length.audit({readingLessons:added.readingLessons,questions:duplicate,existingQuestionIds:oldQuestions.map(x=>x.id)}).ok);
console.log('PASS: V0.4.1 gradual written content 63 fresh items, 9 distinct passages, 3 bands, safe upgrade and old IDs intact.');
