const assert=require('assert');
const DataMigrations=require('../../js/data/migrations.js');

let normalizeCount=0;
let repairCount=0;

const result=DataMigrations.migrate(
  {tasks:[{id:'x'}],logs:[]},
  {
    fromVersion:5,
    schemaVersion:6,
    normalize:data=>{
      normalizeCount++;
      return {
        ...data,
        tasks:Array.isArray(data.tasks)?data.tasks:[]
      };
    },
    repair:tasks=>{
      repairCount++;
      tasks[0].repaired=true;
    }
  }
);

assert.strictEqual(normalizeCount,2);
assert.strictEqual(repairCount,1);
assert.strictEqual(result.schemaVersion,6);
assert.strictEqual(result.tasks[0].repaired,true);

console.log('OK: DataMigrations normalize-repair-normalize pipeline');
