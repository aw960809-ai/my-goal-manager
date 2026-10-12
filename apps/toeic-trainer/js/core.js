/* TOEIC Trainer V0.2 — standalone reading, vocabulary and grammar domain. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ToeicTrainerCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const APP_ID='toeic-trainer-standalone';
  const SCHEMA=1;
  const VERSION='0.5.0';
  const KEY='toeic-trainer-v01:learning-state';
  const BACKUP_KEY='toeic-trainer-v01:learning-state-backup';
  const PHASES=[
    {start:'2026-10-01',due:'2026-11-01',prefix:'g3-2026-10',units:['article','review','practice']},
    {start:'2026-11-02',due:'2026-11-29',prefix:'g3-2026-11',units:['article','review','practice']},
    {start:'2026-11-30',due:'2026-12-19',prefix:'g3-2026-12',units:['review','practice','mock']}
  ];
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const asArray=x=>Array.isArray(x)?x:[];
  const fresh=()=>({appId:APP_ID,schema:SCHEMA,version:VERSION,review:{},questionStats:{},sessions:[],savedWordIds:[],readingProgress:{},createdAt:new Date().toISOString()});
  function normalized(raw){
    if(!raw||raw.appId!==APP_ID||raw.schema!==SCHEMA)throw new Error('備份格式或來源不符，不會覆寫現有資料。');
    const out=fresh();
    out.createdAt=typeof raw.createdAt==='string'?raw.createdAt:out.createdAt;
    for(const key of ['review','questionStats']){
      const v=raw[key];
      if(v&&typeof v==='object'&&!Array.isArray(v)){
        for(const [id,row] of Object.entries(v).slice(0,15000)){
          if(/^[a-z0-9_-]{1,60}$/i.test(id)&&row&&typeof row==='object'&&!Array.isArray(row)){
            out[key][id]={...row};
          }
        }
      }
    }
    // Additive V0.2 fields: the exact V0.1 key, schema, sessions, SRS and stats stay intact.
    out.savedWordIds=[...new Set(asArray(raw.savedWordIds).filter(id=>typeof id==='string'&&/^v\d{3}$/.test(id)))].slice(0,1200);
    const reading=raw.readingProgress;
    if(reading&&typeof reading==='object'&&!Array.isArray(reading)){
      for(const [id,r] of Object.entries(reading).slice(0,500)){
        if(/^(?:r-[a-z-]{1,50}|v4-r-[a-z-]{1,50}|v41-r-[a-z-]{1,50})$/.test(id)&&r&&typeof r==='object'){
          out.readingProgress[id]={attempts:clamp(Math.floor(Number(r.attempts)||0),0,10000),
            best:clamp(Math.floor(Number(r.best)||0),0,100),lastAt:typeof r.lastAt==='string'?r.lastAt:''};
        }
      }
    }
    out.sessions=asArray(raw.sessions).filter(s=>s&&typeof s.id==='string'&&s.appId===APP_ID&&Number.isFinite(Number(s.seconds))).slice(-2000);
    return out;
  }
  function dateKey(date){
    const d=date instanceof Date?date:new Date(date);
    if(Number.isNaN(d.getTime()))return '';
    const bits=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const get=t=>bits.find(p=>p.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function taskFor(date,unit){
    const phase=PHASES.find(x=>date>=x.start&&date<=x.due);
    if(!phase)return null;
    const wanted=phase.units.includes(unit)?unit:phase.units.includes('practice')?'practice':phase.units.includes('review')?'review':phase.units[0];
    return {taskId:`${phase.prefix}-${wanted}`,unit:wanted,phase:phase.prefix};
  }
  function nextReview(prev,grade,now=new Date()){
    if(!['again','hard','good','easy'].includes(grade))throw new Error('Unknown review grade');
    const before=prev&&typeof prev==='object'?prev:{};
    const right=Number(before.repetitions)||0;
    const repetitions=grade==='again'?0:right+1;
    const days=grade==='again'?0:grade==='hard'?1:grade==='good'?[2,4,7,14,30][clamp(repetitions-1,0,4)]:[4,8,14,30,60][clamp(repetitions-1,0,4)];
    const due=new Date(now.getTime()+ (days||0)*86400000);
    if(!days)due.setTime(now.getTime()+10*60000);
    return {
      repetitions,intervalDays:days,dueAt:due.toISOString(),lastAt:now.toISOString(),
      times:(Number(before.times)||0)+1,
      mistakes:(Number(before.mistakes)||0)+(grade==='again'?1:0)
    };
  }
  function reviewIsDue(record,now=new Date()){
    return !record||!record.dueAt||new Date(record.dueAt).getTime()<=now.getTime();
  }
  function recordAnswer(prev,correct,now=new Date()){
    const p=prev&&typeof prev==='object'?prev:{};
    const hits=(Number(p.correct)||0)+(correct?1:0);
    const misses=(Number(p.wrong)||0)+(correct?0:1);
    const streak=correct?(Number(p.streak)||0)+1:0;
    const dueDays=correct?(streak>=3?7:streak===2?3:1):0;
    const dueAt=new Date(now.getTime()+(dueDays||0)*86400000+(dueDays?0:10*60000)).toISOString();
    return {correct:hits,wrong:misses,streak,dueAt,lastAt:now.toISOString()};
  }
  function inMistakePool(record,now=new Date()){
    return !!record&&Number(record.wrong)>0&&(Number(record.streak)<2||reviewIsDue(record,now));
  }
  function createSession({id,date,mode,unit,part,seconds,answered,correct,questionIds}){
    const time=Number(seconds);
    if(typeof id!=='string'||!/^tt-[a-z0-9-]{8,70}$/i.test(id))throw new Error('無效的學習事件 ID');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('無效的日期');
    if(!Number.isFinite(time)||time<0||time>21600)throw new Error('無效的學習時間');
    if(!Number.isInteger(answered)||answered<=0||!Number.isInteger(correct)||correct<0||correct>answered)throw new Error('無效的答題結果');
    if(!['review','article','practice','mock'].includes(unit))throw new Error('無效的訓練類型');
    const target=taskFor(date,unit);
    return {
      appId:APP_ID,schema:SCHEMA,id,createdAt:new Date().toISOString(),date,mode,unit,
      part:part===null?null:Number(part),seconds:Math.round(time),minutes:Math.round((time/60)*100)/100,
      questionsAnswered:answered,correct,accuracy:Math.round(100*correct/answered),questionIds:asArray(questionIds).slice(0,200),
      goalSyncEligible:time>=60,
      suggestedGoalTaskId:target?.taskId||null,
      goalImportStatus:'not-imported'
    };
  }
  function chooseQuestions(questions,{mode='mixed',part=null,count=10,stats={},random=Math.random,topic=null,readingId=null,tier='all'}={}){
    // Listening is deliberately disabled in V0.2, including legacy mode strings.
    const parts=mode==='listening'?[]:mode==='grammar'?[5,6]:
      (mode==='reading'||mode==='passage')?[6,7]:[5,6,7];
    let bank=asArray(questions).filter(q=>Number.isInteger(q.part)&&parts.includes(q.part));
    if(Number.isInteger(part))bank=bank.filter(q=>q.part===part);
    if(topic)bank=bank.filter(q=>q.grammarTopic===topic);
    if(readingId)bank=bank.filter(q=>q.readingId===readingId);
    if(tier!=='all')bank=bank.filter(q=>tier==='legacy'?!q.tier:q.tier===tier);
    if(mode==='mistakes')bank=bank.filter(q=>inMistakePool(stats[q.id]));
    // Prefer unanswered or due items, but include experienced questions when necessary.
    const annotated=bank.map(q=>({q,priority:!stats[q.id]?0:reviewIsDue(stats[q.id])?1:2,rand:random()}));
    annotated.sort((a,b)=>a.priority-b.priority||a.rand-b.rand);
    return annotated.slice(0,clamp(Number(count)||10,1,200)).map(x=>x.q);
  }
  function validateBank(cards,questions){
    const errors=[],ids=new Set();
    for(const row of [...asArray(cards),...asArray(questions)]){
      if(!row.id||ids.has(row.id))errors.push('Missing/duplicate id: '+row.id);ids.add(row.id);
    }
    for(const q of asArray(questions)){
      if(![2,3,4,5,6,7].includes(q.part))errors.push('unsupported part: '+q.id);
      if(!Array.isArray(q.options)||![3,4].includes(q.options.length))errors.push('bad options: '+q.id);
      if(!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length)errors.push('bad answer: '+q.id);
      if(!q.reason||!q.question)errors.push('missing explanation: '+q.id);
      if([2,3,4].includes(q.part)&&!q.audio)errors.push('missing audio text: '+q.id);
      if([6,7].includes(q.part)&&!q.passage)errors.push('missing passage: '+q.id);
    }
    return errors;
  }
  function weakTopics(questions,stats){
    const total=new Map();
    asArray(questions).filter(q=>q.part===5||q.part===6).forEach(q=>{
      const topic=q.grammarTopic||q.tag;
      const r=stats?.[q.id]||{},seen=Math.max(0,Number(r.correct)||0)+Math.max(0,Number(r.wrong)||0);
      if(!seen)return;
      const value=total.get(topic)||{topic,correct:0,wrong:0,answered:0};
      value.correct+=Math.max(0,Number(r.correct)||0);
      value.wrong+=Math.max(0,Number(r.wrong)||0);
      value.answered+=seen;total.set(topic,value);
    });
    return [...total.values()].map(x=>({...x,errorRate:Math.round(x.wrong/x.answered*100)}))
      .sort((a,b)=>b.errorRate-a.errorRate||b.answered-a.answered);
  }
  return Object.freeze({APP_ID,SCHEMA,VERSION,KEY,BACKUP_KEY,PHASES,fresh,normalized,dateKey,taskFor,nextReview,reviewIsDue,recordAnswer,inMistakePool,createSession,chooseQuestions,validateBank,weakTopics});
});
