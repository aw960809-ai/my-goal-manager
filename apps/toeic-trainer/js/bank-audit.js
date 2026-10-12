/* V0.4 pure bank structure and duplicate audit; semantic-review claims excluded. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.ToeicTrainerBankAudit=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const fold=x=>String(x??'').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
 const normalizeText=x=>fold(x).replace(/[^\p{L}\p{N}\s]/gu,'').replace(/\s+/g,' ').trim();
 function audit({cards=[],questions=[],readingLessons=[],grammarLessons=[],expected=null}={}){
   const errors=[],warnings=[],cardIds=new Set(),words=new Map(),questionIds=new Set(),stems=new Map();
   const lessonIds=new Set(),topicIds=new Set();
   readingLessons.forEach(row=>{
     if(!row?.id||lessonIds.has(row.id))errors.push('重複閱讀篇章 ID：'+String(row?.id));
     lessonIds.add(row.id);
     if(!Array.isArray(row.sentences)||row.sentences.length<3)errors.push('篇章句子不足：'+row.id);
     (row.sentences||[]).forEach((s,i)=>{if(!s.en||!s.zh||!s.note)errors.push(`篇章句子／翻譯／解析缺失：${row.id}/${i}`)});
   });
   grammarLessons.forEach(row=>{
     if(!row?.id||topicIds.has(row.id))errors.push('重複文法主題：'+String(row?.id));
     topicIds.add(row.id);
     if(!row.ruleEn||!row.ruleZh||!row.example)errors.push('文法主題說明不足：'+row.id);
   });
   cards.forEach((row,i)=>{
     if(!row?.id||cardIds.has(row.id))errors.push('重複或空白字卡 ID：'+String(row?.id));
     cardIds.add(row.id);
     const normalized=fold(row?.word);
     if(!normalized||words.has(normalized))errors.push('相同詞條重複計數：'+String(row?.word));
     words.set(normalized,row.id);
     if(!row?.zh||!row?.pos||!row?.example)errors.push('詞條內容缺漏：'+String(row?.id));
   });
   questions.forEach((q,i)=>{
     if(!q?.id||questionIds.has(q.id)||cardIds.has(q.id))errors.push('重複試題 ID：'+String(q?.id));
     questionIds.add(q.id);
     if(![5,6,7].includes(q?.part))errors.push('不支援的書面題型：'+String(q?.id));
     if(!q?.question||!q.reasonEn||!q.reason)errors.push('缺少題文或解析：'+String(q?.id));
     if(!Array.isArray(q?.options)||q.options.length!==4||new Set((q.options||[]).map(fold)).size!==4){
       errors.push('選項不足或重複：'+String(q?.id));
     }
     if(!Number.isInteger(q?.answer)||q.answer<0||q.answer>=4)errors.push('答案索引錯誤：'+String(q?.id));
     if(q.part>=6&&!q.passage)errors.push('缺少篇章：'+String(q?.id));
     if(q.readingId&&!lessonIds.has(q.readingId))errors.push('題目引用不存在的文章：'+q.id);
     if(q.grammarTopic&&!topicIds.has(q.grammarTopic)&&q.part===5)errors.push('題目引用不存在的文法：'+q.id);
     // The prompt and the source passage form the true item identity.
     const key=normalizeText(q?.question)+'|'+normalizeText(q?.passage||'');
     if(stems.has(key))errors.push(`相同題文／篇章重複收錄：${stems.get(key)}、${q?.id}`);
     stems.set(key,q?.id);
   });
   const countPart=p=>questions.filter(q=>q.part===p).length;
   const target=expected||{cards:800,questions:524,reading:34,grammar:20,part5:338,part6:28,part7:158};
   if(cards.length!==target.cards||questions.length!==target.questions||readingLessons.length!==target.reading||grammarLessons.length!==target.grammar||countPart(5)!==target.part5||countPart(6)!==target.part6||countPart(7)!==target.part7)
     errors.push('題庫數量與建置清單不一致');
   const counts={words:words.size,questions:questions.length,part5:countPart(5),part6:countPart(6),part7:countPart(7),reading:readingLessons.length,grammar:grammarLessons.length};
   warnings.push('結構、文字重複與選項索引檢查不能取代逐題語意與答案專業校對。');
   return {ok:errors.length===0,errors,warnings,counts};
 }
 return Object.freeze({audit,normalizeText});
});
