#!/usr/bin/env node
/* Non-destructive, reproducible 640-item quality audit for TOEIC Trainer V0.5.
 * Machine checks do not certify grammar, semantic uniqueness or all rationales.
 * Answer-position skew is reported but original option order and IDs remain unchanged.
 */
'use strict';
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const f of ['content','advanced','v04_bank','v041_progression','v042_official'])require(path.join(root,'data',f+'.js'));
const sources=[
 ['legacy',globalThis.ToeicTrainerContent.questions.filter(q=>q.part>=5)],
 ['advanced',globalThis.ToeicTrainerAdvanced.questions],
 ['v04',globalThis.ToeicTrainerV04.questions],
 ['v041',globalThis.ToeicTrainerV041.questions],
 ['v042',globalThis.ToeicTrainerV042.questions]
];
const qs=sources.flatMap(([source,rows])=>rows.map(q=>({source,...q})));
const Quality=require(path.join(root,'js/quality-v043.js'));
const cards=[...globalThis.ToeicTrainerContent.cards,...globalThis.ToeicTrainerAdvanced.cards,...globalThis.ToeicTrainerV04.cards];
const reading=[...globalThis.ToeicTrainerAdvanced.readingLessons,...globalThis.ToeicTrainerV04.readingLessons,...globalThis.ToeicTrainerV041.readingLessons];
const grammar=[...globalThis.ToeicTrainerAdvanced.grammarLessons,...globalThis.ToeicTrainerV04.grammarLessons];
const baseline=Quality.inspect({questions:qs,cards,readingLessons:reading,grammarLessons:grammar});
const riskById=new Map();
function flag(id,code,detail,severity='review'){
 const list=riskById.get(id)||[];
 if(!list.some(x=>x.code===code))list.push({code,detail,severity});
 riskById.set(id,list);
}
baseline.errors.forEach(x=>flag(x.id,x.code,x.detail,'blocked'));
baseline.reviewFlags.forEach(x=>flag(x.id,x.code,x.detail));
baseline.nearDuplicateCandidates.forEach(x=>{
 flag(x.a,'near-duplicate-candidate',`近似 ${x.b}, similarity ${x.similarity}`);
 flag(x.b,'near-duplicate-candidate',`近似 ${x.a}, similarity ${x.similarity}`);
});
const idSet=new Set(qs.map(x=>x.id));
const groups=new Map();
for(const q of qs){
 const id=q.id,opts=q.options||[];
 if(q.part===5){
  const blanks=(q.question.match(/_{2,}|□{2,}|\[blank\]/gi)||[]).length;
  if(blanks!==1)flag(id,'p5-blank-count',`Part 5 blank count: ${blanks}`,'blocked');
 }
 if(q.part===7&&q.evidence){
  const paragraph=String(q.passage||'').replace(/\s+/g,' ').toLowerCase();
  const evidence=String(q.evidence).replace(/\s+/g,' ').trim().toLowerCase();
  if(evidence.length>7&&!paragraph.includes(evidence))flag(id,'evidence-not-verbatim','來源證據未逐字出現在題組內（可能是有效釋義，需核對）');
 }
 if(q.part===6&&q.docGroup){
   if(!groups.has(q.docGroup))groups.set(q.docGroup,[]);
   groups.get(q.docGroup).push(q);
 }
 const correct=opts[Number(q.answer)];
 if(q.answer>=0&&typeof correct==='string'&&correct.trim().length<1)flag(id,'blank-correct','正確答案文字為空','blocked');
 if(q.part===7&&typeof q.evidence==='string'&&q.evidence.trim().length>0&&String(q.passage||'').length<70)flag(id,'short-passage','閱讀段落太短，需核對');
}
for(const [gid,rows] of groups){if(rows.length!==4)for(const q of rows)flag(q.id,'p6-group-size','標註官方風格的 Part 6 題組不滿 4 題，需確認');}
const distributions=sources.map(([source,rows])=>{
 const byPart={};
 for(const part of [5,6,7]){
  const relevant=rows.filter(x=>x.part===part),arr=[0,0,0,0];
  relevant.forEach(q=>{if(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4)arr[q.answer]++});
  byPart[String(part)]={items:relevant.length,answers:{A:arr[0],B:arr[1],C:arr[2],D:arr[3]}};
  const dominant=Math.max(...arr),frequency=relevant.length?dominant/relevant.length:0;
  if(relevant.length>=15&&frequency>=.75){
   for(const q of relevant)flag(q.id,'answer-position-bias',`來源 ${source} 的 Part ${part} 答案分布失衡，最高比例 ${Math.round(frequency*100)}%`);
  }
 }
 return {source,byPart};
});
const rows=qs.map(q=>{
 const flags=riskById.get(q.id)||[];
 return {id:q.id,source:q.source,part:q.part,answerIndex:q.answer,answerLetter:'ABCD'[q.answer]||'?',
   status:flags.some(x=>x.severity==='blocked')?'blocked':flags.length?'review':'machine-pass',
   flags:flags.map(f=>f.code),question:q.question,
   // Provenance evidence for review; output never modifies bank source.
   correctOption:q.options?.[q.answer]||'',reasonEn:q.reasonEn||'',reasonZh:q.reason||''};
});
const summary={version:'0.5.0-quality-precheck',reviewMethod:'machine-structural-and-answer-distribution-only',
 generatedAt:new Date().toISOString(),total:rows.length,cards:cards.length,reading:reading.length,grammar:grammar.length,
 partCounts:{5:rows.filter(x=>x.part===5).length,6:rows.filter(x=>x.part===6).length,7:rows.filter(x=>x.part===7).length},
 structurallyBlocked:rows.filter(x=>x.status==='blocked').length,
 reviewPriority:rows.filter(x=>x.status==='review').length,
 machinePassOnly:rows.filter(x=>x.status==='machine-pass').length,
 semanticallyVerified:0,distributions,
 highConfidenceAnomalies:[{code:'v042-part7-all-a',claim:'New V0.4.2 25 cross-document Part 7 questions have A as the sole correct position',items:25}],
 warning:'No items certified semantically. Existing stems, options, answer keys, explanations and IDs have not been rewritten. ReviewPriority does not mean proven wrong.'};
const report={summary,rows};
const file=path.join(root,'QUALITY_AUDIT_V05.json');
fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
const csv=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
fs.writeFileSync(path.join(root,'QUALITY_AUDIT_V05.csv'),
  ['id','source','part','answer','status','flags','question'].join(',')+'\n'+rows.map(r=>[r.id,r.source,r.part,r.answerLetter,r.status,r.flags.join(';'),r.question].map(csv).join(',')).join('\n')+'\n');
if(rows.length!==640||summary.partCounts[5]!==368||summary.partCounts[6]!==44||summary.partCounts[7]!==228||summary.cards!==800){throw new Error('Audit source count mismatch')}
if(summary.structurallyBlocked>0){console.error('BLOCKED structural items',summary.structurallyBlocked);process.exitCode=1}
console.log(JSON.stringify({total:summary.total,blocked:summary.structurallyBlocked,review:summary.reviewPriority,machinePass:summary.machinePassOnly,semanticCertified:summary.semanticallyVerified,
 v042Part7:distributions.find(d=>d.source==='v042').byPart[7]},null,2));
