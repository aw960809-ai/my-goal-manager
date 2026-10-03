const assert=require('assert');
const fs=require('fs');
const path=require('path');
const RadarPolicy=require('../../js/domain/radar-policy.js');

const root=path.join(__dirname,'../..');

const activityPayload=JSON.parse(
  fs.readFileSync(path.join(root,'data/activities.json'),'utf8')
);
const activities=Array.isArray(activityPayload)
  ?activityPayload
  :(activityPayload.events||activityPayload.activities||[]);

const reviewRows=activities.filter(x=>
  x.needsReview===true||
  Number(x.missCount||0)>=2
);

for(const row of reviewRows){
  assert.strictEqual(
    RadarPolicy.activityReviewState(row).blocked,
    true,
    `${row.id} must be blocked while pending source review`
  );
}

const ids=activities.map(x=>String(x.id||''));
assert(ids.every(Boolean),'activity IDs must be non-empty');
assert.strictEqual(ids.length,new Set(ids).size,'activity IDs must be unique');

const scholarshipPayload=JSON.parse(
  fs.readFileSync(path.join(root,'data/scholarships.json'),'utf8')
);
const scholarships=Array.isArray(scholarshipPayload)
  ?scholarshipPayload
  :(scholarshipPayload.scholarships||
    scholarshipPayload.items||
    scholarshipPayload.events||
    []);

const scholarshipIds=scholarships.map(x=>String(x.id||''));
assert(scholarshipIds.every(Boolean),'scholarship IDs must be non-empty');
assert.strictEqual(
  scholarshipIds.length,
  new Set(scholarshipIds).size,
  'scholarship IDs must be unique'
);

console.log(
  `OK: radar data policy activities=${activities.length} pendingReview=${reviewRows.length} scholarships=${scholarships.length}`
);
