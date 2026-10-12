/* V0.4.2 non-destructive quality ledger. Automated structure ≠ expert answer validation. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ToeicTrainerQuality=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clean=x=>String(x||'').normalize('NFKC').toLocaleLowerCase('en').replace(/[\p{P}\p{S}\s]/gu,'');
 const optionKey=x=>String(x||'').normalize('NFKC').toLocaleLowerCase('en').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
 function check({legacy=[],fresh=[],reading=[],mock=null}={}){
   const errors=[],warnings=[],historyIds=new Set(legacy.map(q=>q.id)),all=[...legacy,...fresh];
   const fingerprints=new Map();
   for(const q of all){
     const identity=clean(q.question)+'|'+clean(q.passage);
     if(fingerprints.has(identity))errors.push('重複題文及來源：'+q.id+' / '+fingerprints.get(identity));
     fingerprints.set(identity,q.id);
     if(!q?.id||!Number.isInteger(q.answer)||q.answer<0||q.answer>3||!Array.isArray(q.options)||q.options.length!==4||
       new Set(q.options.map(optionKey)).size!==4||!q.reasonEn||!q.reason)errors.push('題目答案／選項／解析格式錯誤：'+q.id);
   }
   for(const q of fresh){
     if(historyIds.has(q.id)||!/^v42-p[567]-/.test(q.id))errors.push('新舊 ID 衝突：'+q.id);
     if(q.part===5){if(!q.question.includes('___')||q.passage)errors.push('Part5 題型錯誤：'+q.id)}
     if(q.part===6){if(!/^p6-/.test(q.docGroup)||!q.passage.includes('['+q.blank+']')||q.docCount!==1)errors.push('Part6 題組格式錯誤：'+q.id)}
     if(q.part===7){if(!/^p7-/.test(q.docGroup)||![2,3].includes(q.docCount)||
       !q.evidence||!q.passage.includes(q.evidence)||!q.skill)errors.push('Part7 跨篇原文依據／結構不符：'+q.id)}
     if(!q.reasonEn||String(q.reasonEn).length<30||String(q.reason).length<10)errors.push('新增題目解析不足：'+q.id);
   }
   const docs=new Map();
   for(const q of fresh.filter(q=>q.part>=6)){
      const k=q.docGroup;let rows=docs.get(k)||[];rows.push(q);docs.set(k,rows);
   }
   for(const [id,rows] of docs){
     const expected=id.startsWith('p6-')?4:5;
     if(rows.length!==expected||new Set(rows.map(x=>x.passage)).size!==1||
       (id.startsWith('p6-') && new Set(rows.map(x=>x.blank)).size!==4)||
       (id.startsWith('p7-') && new Set(rows.map(x=>x.skill)).size!==5)) errors.push('題組有重複考點／文檔不一致：'+id);
   }
   if(fresh.length!==53||fresh.filter(q=>q.part===5).length!==12||fresh.filter(q=>q.part===6).length!==16||fresh.filter(q=>q.part===7).length!==25)errors.push('V0.4.2 新題數量不符');
   const legacySingle5=new Set();
   for(const q of legacy.filter(q=>q.part===7&&q.readingId)){
     const n=legacy.filter(x=>x.readingId===q.readingId).length;if(n>4)legacySingle5.add(q.readingId);
   }
   const weakVocab=[];
   for(const row of reading||[]){if(!row.sentences?.length)warnings.push('文章缺少逐句資料：'+row.id)}
   if(legacySingle5.size)warnings.push(`既有 ${legacySingle5.size} 篇單篇閱讀含超過四題：保留歷史，不直接改寫；官方模考僅選 2–4 題／篇。`);
   warnings.push('所有 587 道舊題保留原文及 ID，完整語意／錯誤選項專業覆核仍待進行。');
   warnings.push('新增題已通過格式及來源一致性檢查，但此檢查無法證明沒有第二個語意成立的答案。');
   return {ok:errors.length===0,errors,warnings,counts:{legacy:legacy.length,new:fresh.length,all:all.length,
     part5:all.filter(q=>q.part===5).length,part6:all.filter(q=>q.part===6).length,part7:all.filter(q=>q.part===7).length,
     newPart6Groups:[...docs.keys()].filter(x=>x.startsWith('p6-')).length,newMultiGroups:[...docs.keys()].filter(x=>x.startsWith('p7-')).length,
     legacySinglePassagesOutsideExamRange:legacySingle5.size}};
 }
 return Object.freeze({check});
});
