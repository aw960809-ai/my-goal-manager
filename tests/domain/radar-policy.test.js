const assert=require('assert');
const RadarPolicy=require('../../js/domain/radar-policy.js');

assert.deepStrictEqual(
  RadarPolicy.activityCircleInfo({scope:'東海校內'}),
  {
    level:1,
    label:'東海校內',
    key:'circle1',
    international:false
  }
);

assert.strictEqual(
  RadarPolicy.activityCircleInfo({scope:'台中'}).level,
  2
);

assert.strictEqual(
  RadarPolicy.activityCircleInfo({scope:'彰化'}).level,
  3
);

assert.strictEqual(
  RadarPolicy.activityCircleInfo({scope:'全臺'}).level,
  4
);

const overseas=RadarPolicy.activityCircleInfo({
  scope:'海外／國際',
  circleLevel:4
});
assert.strictEqual(overseas.level,4);
assert.strictEqual(overseas.label,'全國');
assert.strictEqual(overseas.international,true);

assert.strictEqual(RadarPolicy.circleLabel(3),'③ 中部');
assert.strictEqual(RadarPolicy.circleLabel(4),'④ 全國');

const review=RadarPolicy.activityReviewState({
  needsReview:true,
  missCount:3,
  lastSeen:'2026-09-29T07:01:11Z'
});
assert.strictEqual(review.blocked,true);
assert(review.reason.includes('2026-09-29'));

const reviewByMiss=RadarPolicy.activityReviewState({
  missCount:2
});
assert.strictEqual(reviewByMiss.blocked,true);

const fresh=RadarPolicy.activityReviewState({
  missCount:0,
  needsReview:false
});
assert.strictEqual(fresh.blocked,false);

assert.strictEqual(
  RadarPolicy.scholarshipRegionReason({
    target:'申請人須設籍嘉義縣滿一年'
  })!==null,
  true
);

assert.strictEqual(
  RadarPolicy.scholarshipRegionReason({
    target:'限臺中市大專院校在學學生'
  })!==null,
  true
);

assert.strictEqual(
  RadarPolicy.scholarshipRegionReason({
    restrictions:'限彰化縣戶籍學生申請'
  })!==null,
  true
);

assert.strictEqual(
  RadarPolicy.scholarshipRegionReason({
    target:'全國大專院校學生，不限地區、不限戶籍'
  }),
  null
);

assert.strictEqual(
  RadarPolicy.scholarshipRegionReason({
    note:'主辦單位位於台北市，申請資格為全國大學生'
  }),
  null
);

console.log('OK: RadarPolicy circle, review blocking and strict region rules');
