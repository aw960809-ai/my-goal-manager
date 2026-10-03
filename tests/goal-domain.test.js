const assert=require('assert');
const GoalDomain=require('../js/domain/goals.js');

const tasks=[
  {id:'r',name:'方向',level:1,parent:null,status:'進行中'},
  {id:'m',name:'階段',level:2,parent:'r',status:'進行中'},
  {id:'s1',name:'子任務一',level:3,parent:'m',start:'2026-09-01',due:'2026-10-31',status:'進行中'},
  {id:'s2',name:'子任務二',level:3,parent:'m',start:'2026-11-01',due:'2026-12-31',status:'未開始'},
  {id:'l',name:'具體行動',level:4,parent:'s1',status:'進行中'},
  {id:'x',name:'封存',level:3,parent:'m',start:'2026-01-01',due:'2026-01-31',status:'已封存'}
];

assert.deepStrictEqual(GoalDomain.roots(tasks).map(x=>x.id),['r']);
assert.deepStrictEqual(GoalDomain.children(tasks,'m').map(x=>x.id),['s1','s2','x']);
assert.deepStrictEqual(GoalDomain.ancestors(tasks,'l').map(x=>x.id),['r','m','s1','l']);
assert.deepStrictEqual(GoalDomain.path(tasks,'l'),['方向','階段','子任務一','具體行動']);
assert.deepStrictEqual(GoalDomain.periodForTask(tasks,'s1'),{start:'2026-09-01',due:'2026-10-31'});
assert.deepStrictEqual(GoalDomain.periodForTask(tasks,'l'),{start:'2026-09-01',due:'2026-10-31'});
assert.deepStrictEqual(GoalDomain.periodForTask(tasks,'m'),{start:'2026-09-01',due:'2026-12-31'});
assert.deepStrictEqual(GoalDomain.browseItems(tasks,null).map(x=>x.id),['r']);
assert.deepStrictEqual(GoalDomain.browseItems(tasks,'m').map(x=>x.id),['s1','s2']);

console.log('OK: GoalDomain hierarchy, path, browse and period helpers');
