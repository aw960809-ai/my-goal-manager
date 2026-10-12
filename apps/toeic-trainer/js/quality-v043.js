/* TOEIC Trainer V0.4.3: deterministic QA report. Never edits or silently rekeys existing items. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ToeicTrainerQualityV043=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[\p{P}\p{S}\s]/gu,'');
  const words=value=>String(value??'').toLowerCase().match(/[a-z]{3,}/g)||[];
  const list=value=>Array.isArray(value)?value:[];
  function inspect({questions=[],cards=[],readingLessons=[],grammarLessons=[]}={}){
    const issues=[],flagged=[],duplicates=[],seenIds=new Map(),seenStems=new Map();
    const partCounts={5:0,6:0,7:0};
    const addIssue=(id,code,detail)=>issues.push({id:String(id||''),code,detail});
    const addFlag=(id,code,detail)=>flagged.push({id:String(id),code,detail});
    const validPart=new Set([5,6,7]);
    for(const q of list(questions)){
      const id=String(q?.id||'');
      if(!id||seenIds.has(id))addIssue(id,'duplicate-id','試題 ID 缺少或重複');
      else seenIds.set(id,true);
      if(!validPart.has(q?.part))addIssue(id,'invalid-part','僅接受 Part 5–7');
      else partCounts[q.part]++;
      if(!String(q?.question||'').trim())addIssue(id,'missing-stem','缺少題文');
      if(!Array.isArray(q?.options)||q.options.length!==4){addIssue(id,'invalid-options','選項必須為四項');continue;}
      const labels=q.options.map(x=>String(x??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim());
      if(labels.some(label=>!label)||new Set(labels).size!==4)addIssue(id,'duplicate-options','四個選項需有不同且非空的文字');
      if(!Number.isInteger(q.answer)||q.answer<0||q.answer>3)addIssue(id,'invalid-answer','答案索引範圍有誤');
      if(!String(q.reasonEn||'').trim()||!String(q.reason||'').trim())addIssue(id,'missing-rationale','缺少英文或中文解析');
      if(q.part>=6&&!String(q.passage||'').trim())addIssue(id,'missing-passage','篇章題缺少原文');
      const key=normalize(q.question)+'|'+normalize(q.passage||'');
      if(seenStems.has(key)){duplicates.push([seenStems.get(key),id]);addIssue(id,'duplicate-content','相同題文與原文重複');}
      else seenStems.set(key,id);
      if(String(q.reasonEn||'').trim().length<45||String(q.reason||'').trim().length<17){
        addFlag(id,'brief-rationale','解析較短，需人工確認是否足以說明正確與錯誤選項');
      }
      if(q.part===7&&!String(q.evidence||'').trim())addFlag(id,'missing-cited-evidence','閱讀題缺少機器可驗證的原文依據欄位（不代表答案錯誤）');
      if(q.options.some((text,i)=>i!==q.answer&&/\b(unrelated|random stranger|unrelated store|contact the newspaper|visit a different planet)\b/i.test(String(text)))){
        addFlag(id,'implausible-distractor','疑似過於明顯的干擾選項，建議優先人工覆核');
      }
    }
    for(const c of list(cards)){
      if(!c?.id||seenIds.has(c.id))addIssue(c?.id,'card-id-conflict','單字與題目 ID 不可重複');
      else seenIds.set(c.id,true);
    }
    // Near duplicates are leads for review, not automatic proof of plagiarism or duplication.
    const nearPairs=[];
    const byPart=new Map();
    for(const q of questions){if(!validPart.has(q.part))continue;let a=byPart.get(q.part)||[];a.push(q);byPart.set(q.part,a);}
    for(const [part,rows] of byPart){
      for(let i=0;i<rows.length;i++){
        const a=rows[i];const aw=new Set(words(a.question));
        if(aw.size<5)continue;
        for(let j=i+1;j<rows.length;j++){
          const b=rows[j];if(a.id===b.id)continue;
          if(part>=6&&normalize(a.passage)!==normalize(b.passage))continue;
          if(a.docGroup&&a.docGroup===b.docGroup)continue; // Distinct blanks/skills in one official-style document
          const bw=new Set(words(b.question));
          const overlap=[...aw].filter(x=>bw.has(x)).length;
          const similarity=overlap/(aw.size+bw.size-overlap||1);
          if(similarity>=.91&&a.question!==b.question&&aw.size>=7){
            nearPairs.push({a:a.id,b:b.id,similarity:Number(similarity.toFixed(2))});
          }
        }
      }
    }
    const uniqueReviewIds=new Set(flagged.map(x=>x.id));
    const criticalIds=[...new Set(issues.map(x=>x.id))];
    return {
      version:'0.4.3',
      source:'machine-checks-only',
      counts:{questions:questions.length,cards:cards.length,reading:readingLessons.length,grammar:grammarLessons.length,
        part5:partCounts[5],part6:partCounts[6],part7:partCounts[7],uniqueQuestionIds:seenStems.size,
        mechanicallyBlocked:criticalIds.length,flaggedForReview:uniqueReviewIds.size,
        notSemanticallyCertified:questions.length},
      ok:issues.length===0,
      blockedIds:criticalIds,
      errors:issues,
      reviewFlags:flagged,
      nearDuplicateCandidates:nearPairs,
      exactDuplicatePairs:duplicates,
      policy:'不得重編舊題 ID；機械檢查不等於英文語意、唯一解及干擾選項專業校對。疑似問題先列候審，不自行修改歷史題文或分數。'
    };
  }
  return Object.freeze({inspect,normalize});
});
