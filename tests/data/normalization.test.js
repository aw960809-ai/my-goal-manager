const assert=require('assert');
const DataNormalization=require('../../js/data/normalization.js');

const legacy=DataNormalization.normalizeTask({
  id:'x',
  name:'舊日制',
  level:4,
  parent:'p',
  minutes:60,
  cycle:'日',
  mode:'repeat',
  status:'進行中',
  progress:25
});

assert.strictEqual(legacy.weeklyMinutes,420);
assert.strictEqual(legacy.level,4);
assert.strictEqual(legacy.start,'');
assert.strictEqual(legacy.due,'');
assert.strictEqual('minutes' in legacy,false);
assert.strictEqual('cycle' in legacy,false);
assert.strictEqual('mode' in legacy,false);

const sub=DataNormalization.normalizeTask({
  id:'s',
  name:'子任務',
  level:3,
  parent:'m',
  weeklyMinutes:999,
  start:'2026-10-01',
  due:'2026-10-31'
});

assert.strictEqual(sub.weeklyMinutes,0);
assert.strictEqual(sub.start,'2026-10-01');
assert.strictEqual(sub.due,'2026-10-31');

assert.strictEqual(
  DataNormalization.normalizeWeekReviews([
    {weekStart:'2026-09-28',taskId:'x',reason:'課業負荷'},
    {weekStart:'',taskId:'x',reason:'無效'}
  ]).length,
  1
);

console.log('OK: DataNormalization task and week-review canonicalization');
