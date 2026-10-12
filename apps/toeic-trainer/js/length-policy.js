/* TOEIC Trainer 0.4.1: pure difficulty/length policy. No persistent data access. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ToeicTrainerLengthPolicy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const LEVELS=Object.freeze({
    foundation:Object.freeze({label:'基礎 · 短篇與短句',min:58,max:110,minutes:'3–5 分'}),
    intermediate:Object.freeze({label:'中階 · 複句與篇章',min:170,max:250,minutes:'6–9 分'}),
    advanced:Object.freeze({label:'高階 · 長篇跨段統整',min:320,max:475,minutes:'10–15 分'})
  });
  const P5_BANDS=Object.freeze({foundation:[10,22],intermediate:[20,37],advanced:[32,70]});
  const words=s=>String(s||'').trim().split(/\s+/).filter(Boolean).length;
  const readingText=lesson=>(lesson?.sentences||[]).map(s=>s.en).join(' ');
  function filterLessons(lessons,level){
    return (Array.isArray(lessons)?lessons:[]).filter(l=>
      level==='all'||(level==='legacy'?!LEVELS[l.tier]:l.tier===level));
  }
  function nextLevel(level){return level==='foundation'?'intermediate':level==='intermediate'?'advanced':null}
  function pickNextArticle(lessons,stats,questions){
    const items=Array.isArray(lessons)?lessons:[];
    if(!items.length)return null;
    const exposure=lesson=>(questions||[]).filter(q=>q.readingId===lesson.id)
      .reduce((a,q)=>a+Number(stats?.[q.id]?.correct||0)+Number(stats?.[q.id]?.wrong||0),0);
    return items.map((l,i)=>({l,i,seen:exposure(l)})).sort((a,b)=>a.seen-b.seen||a.i-b.i)[0].l;
  }
  function audit({readingLessons,questions,existingReadingIds=[],existingQuestionIds=[]}){
    const errors=[];
    const L=Array.isArray(readingLessons)?readingLessons:[];
    const Q=Array.isArray(questions)?questions:[];
    const oldL=new Set(existingReadingIds),oldQ=new Set(existingQuestionIds);
    const textFingerprints=new Set(),stemFingerprints=new Set();
    const lc={foundation:0,intermediate:0,advanced:0},gc={foundation:0,intermediate:0,advanced:0};
    for(const l of L){
      if(!LEVELS[l.tier])errors.push('未知文章等級：'+l.id);
      else lc[l.tier]++;
      if(oldL.has(l.id)||!/^v41-r-[a-z-]+$/.test(l.id))errors.push('篇章 ID 與舊版衝突：'+l.id);
      const n=words(readingText(l)),band=LEVELS[l.tier];
      if(band&&(n<band.min||n>band.max||n!==l.wordCount))errors.push('文章字數與級距不符：'+l.id+' '+n);
      const finger=readingText(l).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
      if(textFingerprints.has(finger))errors.push('跨等級重用文章：'+l.id);
      textFingerprints.add(finger);
      if(!Array.isArray(l.sentences)||l.sentences.length<6||l.sentences.some(s=>!s.en||!s.zh||!s.note))errors.push('文章逐句解析不足：'+l.id);
      const linked=Q.filter(q=>q.readingId===l.id);
      if(linked.length!==5)errors.push('文章並非五個獨立考點：'+l.id);
      const skills=new Set(linked.map(q=>q.skill)),evidenceIndices=new Set(linked.map(q=>q.evidenceIndex));
      if(skills.size!==5||evidenceIndices.size!==5)errors.push('文章理解題複用同一考點或同一依據：'+l.id);
      for(const q of linked){
        if(q.part!==7||q.tier!==l.tier||!Number.isInteger(q.evidenceIndex)||
            l.sentences[q.evidenceIndex]?.en!==q.evidence||!q.passage.includes(q.evidence)||
            !q.reasonEn.includes(q.evidence))errors.push('理解題缺少原文依據：'+q.id);
      }
    }
    for(const q of Q){
      if(oldQ.has(q.id))errors.push('覆寫舊題 ID：'+q.id);
      if(!LEVELS[q.tier])errors.push('未知題目等級：'+q.id);
      const s=String(q.question||'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
      if(stemFingerprints.has(s))errors.push('重用新題幹：'+q.id);
      stemFingerprints.add(s);
      if(!Array.isArray(q.options)||q.options.length!==4||new Set(q.options.map(s=>String(s).toLowerCase().trim())).size!==4||
        !Number.isInteger(q.answer)||q.answer<0||q.answer>3||!q.reasonEn||!q.reason)errors.push('選項答案或解析錯誤：'+q.id);
      if(q.part===5){
        if(!/^v41-p5-\d{3}$/.test(q.id)||!q.grammarTopic||!q.question.includes('___'))errors.push('新文法題格式不符：'+q.id);
        const [lo,hi]=P5_BANDS[q.tier]||[0,0],wc=words(q.question);
        if(wc<lo||wc>hi)errors.push('文法句長度分級不符：'+q.id+' '+wc);
        gc[q.tier]=(gc[q.tier]||0)+1;
      }else if(q.part!==7||!/^v41-r-[a-z-]+-q[1-5]$/.test(q.id))errors.push('不支援的新增題型：'+q.id);
    }
    for(const level of Object.keys(LEVELS)){
      if(lc[level]!==3)errors.push(level+' 篇章應有三篇，實際 '+lc[level]);
      if(gc[level]!==6)errors.push(level+' 文法應有六題，實際 '+gc[level]);
    }
    if(Q.length!==63||L.length!==9)errors.push('漸進題庫數量不符');
    return {ok:errors.length===0,errors,counts:{reading:L.length,questions:Q.length,part5:18,part7:45,levels:lc,grammarLevels:gc}};
  }
  return Object.freeze({LEVELS,P5_BANDS,words,readingText,filterLessons,nextLevel,pickNextArticle,audit});
});
