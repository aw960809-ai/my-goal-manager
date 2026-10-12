/* TOEIC Trainer V0.4.2 exam engine: answers and scoring remain separate until submission. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ToeicTrainerExam=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DRAFT_KEY='toeic-trainer-v042:active-exam-draft';
  const DRAFT_SCHEMA=1;
  const isIndex=i=>Number.isInteger(i)&&i>=0&&i<4;
  const snapshot=q=>({id:q.id,part:q.part,options:q.options,answer:q.answer,question:q.question,passage:q.passage||'',reason:q.reason||'',reasonEn:q.reasonEn||'',
    docGroup:q.docGroup||'',docType:q.docType||'',sourceCardId:q.sourceCardId||''});
  function validateMock(questions,def){
    const issues=[],lookup=new Map(questions.map(q=>[q.id,q]));
    const groups=['part5','part6','part7single','part7multiple'];
    const ids=groups.flatMap(k=>def?.[k]||[]);
    if(ids.length!==100||new Set(ids).size!==100)issues.push('試卷不是 100 個唯一題號');
    for(const [name,count,part] of [['part5',30,5],['part6',16,6],['part7single',29,7],['part7multiple',25,7]]){
      const rows=def?.[name]||[];
      if(rows.length!==count||rows.some(id=>lookup.get(id)?.part!==part))issues.push(name+' 數量／題型錯誤');
    }
    for(const id of ids)if(!lookup.has(id))issues.push('題庫缺少：'+id);
    const grouped=(arr,key)=>{const m=new Map();for(const id of arr){const q=lookup.get(id),g=q?.[key]||q?.readingId||null;if(!g)issues.push('題目未綁定原文：'+id);else m.set(g,(m.get(g)||0)+1);}return m;};
    const p6=grouped(def.part6||[],'docGroup');
    if(p6.size!==4||[...p6.values()].some(n=>n!==4))issues.push('Part 6 非四組每組四題');
    const p7s=grouped(def.part7single||[],'readingId');
    if(p7s.size!==10||[...p7s.values()].some(n=>n<2||n>4))issues.push('Part 7 單篇配置應為十篇各 2–4 題');
    const p7m=grouped(def.part7multiple||[],'docGroup');
    if(p7m.size!==5||[...p7m.values()].some(n=>n!==5))issues.push('Part 7 多篇配置應為五組每組五題');
    if((def?.bundles||[]).length!==9)issues.push('跨篇與篇章題組數量錯誤');
    let doubles=0,triples=0;
    for(const [id,n] of p7m){
      const q=questions.find(x=>x.docGroup===id);if(q?.docType==='double'&&q?.docCount===2)doubles++;else if(q?.docType==='triple'&&q?.docCount===3)triples++;else issues.push('雙／三篇文件數錯誤：'+id);
    }
    if(doubles!==2||triples!==3)issues.push('Part 7 多篇應為兩組雙篇、三組三篇');
    return {ok:issues.length===0,issues,questionCount:ids.length,
      distribution:{part5:30,part6:16,part7Single:29,part7Multiple:25}};
  }
  function assembleMock(questions,def){
    const valid=validateMock(questions,def);if(!valid.ok)throw new Error(valid.issues.join('；'));
    const dict=new Map(questions.map(q=>[q.id,q]));
    return [...def.part5,...def.part6,...def.part7single,...def.part7multiple].map(id=>dict.get(id));
  }
  function start(items,{context,mode,timed=false,durationSeconds=0,now=Date.now(),type='question'}={}){
    if(!Array.isArray(items)||!items.length||items.some(q=>!q?.id||!Array.isArray(q.options)||q.options.length!==4))throw new Error('題目不完整');
    const ids=items.map(q=>q.id);if(new Set(ids).size!==ids.length)throw new Error('同份考卷題號重複');
    if(!['reading','grammar','vocab'].includes(context))throw new Error('題型未知');
    return {schema:DRAFT_SCHEMA,createdAt:now,context,mode:mode||context,type,timed:!!timed,durationSeconds:timed?durationSeconds:0,
       index:0,itemIds:ids,responses:{},vocabItems:type==='vocab'?items.map(snapshot):[],elapsedSeconds:0};
  }
  function answer(draft,id,choice){
    if(!draft||!draft.itemIds.includes(id)||!isIndex(choice))throw new Error('無效題號或選項');
    return {...draft,responses:{...draft.responses,[id]:choice}};
  }
  function move(draft,index){
    if(!draft||!Number.isInteger(index)||index<0||index>=draft.itemIds.length)throw new Error('題號超出範圍');
    return {...draft,index};
  }
  function completed(draft){
    return (draft?.itemIds||[]).filter(id=>isIndex(draft.responses?.[id])).length;
  }
  function score(draft,items,{timedOut=false}={}){
    if(!draft||!Array.isArray(items)||items.length!==draft.itemIds.length||items.some((q,i)=>q.id!==draft.itemIds[i]))throw new Error('試卷與題組不相符');
    const done=completed(draft);
    if(!timedOut&&done!==items.length)throw new Error(`還有 ${items.length-done} 題未作答，不可正式交卷`);
    const decisions=items.map(q=>({id:q.id,choice:isIndex(draft.responses[q.id])?draft.responses[q.id]:null,correctIndex:q.answer,
      correct:isIndex(draft.responses[q.id])&&draft.responses[q.id]===q.answer,part:q.part}));
    const correct=decisions.filter(x=>x.correct).length;
    return {correct,answered:done,total:items.length,accuracy:Math.round(correct*100/items.length),
      decisions,unanswered:items.length-done,timedOut:!!timedOut};
  }
  function validDraft(input,questionBank,now=Date.now()){
    const data=typeof input==='string'?JSON.parse(input):input;
    if(!data||data.schema!==DRAFT_SCHEMA||!['reading','grammar','vocab'].includes(data.context)||
       !['question','vocab'].includes(data.type)||!Array.isArray(data.itemIds)||!data.itemIds.length||data.itemIds.length>100||
       new Set(data.itemIds).size!==data.itemIds.length||!Number.isFinite(data.createdAt)||
       now-data.createdAt>30*86400000||data.createdAt>now+60000||
       !Number.isInteger(data.index)||data.index<0||data.index>=data.itemIds.length||
       !data.responses||typeof data.responses!=='object'||Array.isArray(data.responses)||
       data.timed&&!Number.isFinite(data.durationSeconds))throw new Error('不合格或過期的暫存試卷');
    const dictionary=new Map(questionBank.map(q=>[q.id,q]));
    const items=data.type==='vocab'?data.vocabItems?.map(v=>({...v})):data.itemIds.map(id=>dictionary.get(id));
    if(!Array.isArray(items)||items.length!==data.itemIds.length||items.some((q,i)=>q?.id!==data.itemIds[i]||!Array.isArray(q.options)||q.options.length!==4))throw new Error('題目已變更，保留原始紀錄但不自動復原試卷');
    for(const [id,val] of Object.entries(data.responses))if(!data.itemIds.includes(id)||!isIndex(val))throw new Error('暫存答案內容錯誤');
    return {draft:data,items};
  }
  function elapsed(draft,now=Date.now()){
    return draft.timed?Math.max(0,Math.floor((now-draft.createdAt)/1000)):Math.max(0,Math.floor(draft.elapsedSeconds||0));
  }
  // Keep shared-document questions adjacent in daily practice; never split official 4-/5-question bundles.
  // Mistake/topic filters may offer only a subset of one legacy document, but no reused IDs.
  function pickPractice(pool,{count=10,stats={},random=Math.random}={}){
    const limit=Math.max(1,Math.min(100,Math.floor(Number(count)||10)));
    const groups=new Map();
    for(const q of Array.isArray(pool)?pool:[]){
      if(!q?.id)continue;
      const key=q.part===5?'single:'+q.id:q.docGroup?'bundle:'+q.docGroup:
        q.readingId?'article:'+q.readingId:'passage:'+String(q.passage||q.id);
      const rows=groups.get(key)||[];rows.push(q);groups.set(key,rows);
    }
    const priority=q=>{
      const row=stats?.[q.id];
      if(!row)return 0;
      const date=Date.parse(row.dueAt||'');
      return !Number.isFinite(date)||date<=Date.now()?1:2;
    };
    const bundles=[...groups.values()].map(rows=>({rows,score:Math.min(...rows.map(priority)),order:random()}));
    bundles.sort((a,b)=>a.score-b.score||a.order-b.order);
    const selected=[],used=new Set();
    for(const bundle of bundles){
      if(bundle.rows.length>limit-selected.length)continue;
      for(const q of bundle.rows){if(!used.has(q.id)){selected.push(q);used.add(q.id)}}
      if(selected.length>=limit)break;
    }
    return selected;
  }
  function vocabQuestions(cards,{random=Math.random}={}){
    const options=[];
    for(const card of cards){
      const others=cards.filter(c=>c.id!==card.id&&c.zh!==card.zh);
      const similar=others.filter(c=>c.pos===card.pos&&c.tag===card.tag),same=others.filter(c=>c.pos===card.pos&&!similar.includes(c));
      const pool=[...similar,...same,...others].filter((x,i,arr)=>arr.findIndex(y=>y.id===x.id)===i);
      pool.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
      const choices=[card.zh],used=new Set(choices);
      for(const row of pool){if(used.has(row.zh))continue;choices.push(row.zh);used.add(row.zh);if(choices.length===4)break;}
      if(choices.length<4)throw new Error('單字選項不足：'+card.id);
      const place=Math.floor(random()*4);
      const answer=place,final=[...choices.slice(1,place+1),card.zh,...choices.slice(place+1)];
      options.push({id:card.id,part:0,sourceCardId:card.id,question:`${card.word}（${card.pos}）在商務情境中的最佳意思為何？`,
        passage:`Context: ${card.example}`,options:final,answer,reasonEn:`${card.word}: ${card.collocation}. ${card.example}`,reason:`${card.word}：${card.zh}。常見搭配：${card.collocation}`,tag:card.tag});
    }
    return options;
  }
  return Object.freeze({DRAFT_KEY,DRAFT_SCHEMA,start,answer,move,completed,score,validDraft,assembleMock,validateMock,elapsed,pickPractice,vocabQuestions});
});
