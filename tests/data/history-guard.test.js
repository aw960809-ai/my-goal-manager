const assert=require('assert');
const HistoryGuard=require('../../js/data/history-guard.js');

const previous={
  logs:[
    {id:'a',taskId:'t1',name:'A',time:'2026-10-01T01:00:00.000Z',minutes:30,actual:true,kind:'goal-study'},
    {id:'b',taskId:null,name:'其他',time:'2026-10-02T01:00:00.000Z',minutes:59,actual:true,kind:'other-study'}
  ]
};

assert.strictEqual(
  HistoryGuard.assertPreserved(previous,{
    logs:[
      {...previous.logs[0],status:'已刪除'},
      {...previous.logs[1]},
      {id:'c',taskId:'t2',name:'C',time:'2026-10-03T01:00:00.000Z',minutes:10,actual:true,kind:'goal-study'}
    ]
  }),
  true
);

assert.throws(
  ()=>HistoryGuard.assertPreserved(previous,{logs:[previous.logs[0]]}),
  /歷程保護/
);

assert.throws(
  ()=>HistoryGuard.assertPreserved(previous,{
    logs:[
      {...previous.logs[0],minutes:5},
      {...previous.logs[1]}
    ]
  }),
  /核心內容被改寫/
);

assert.strictEqual(
  HistoryGuard.assertPreserved(
    previous,
    {logs:[]},
    {allowReplacement:true}
  ),
  true
);

const m=HistoryGuard.metrics(previous);
assert.strictEqual(m.logCount,2);
assert.strictEqual(m.countableCount,2);
assert.strictEqual(m.totalMinutes,89);
assert.strictEqual(m.otherMinutes,59);

console.log('OK: HistoryGuard preserves old logs, permits soft-delete and explicit replacement');
