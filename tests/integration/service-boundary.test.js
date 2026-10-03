const assert=require('assert');
const fs=require('fs');

const src=fs.readFileSync(
  require.resolve('../../js/services/timer-service.js'),
  'utf8'
);

for(const forbidden of [
  'document',
  'localStorage',
  'sessionStorage',
  'storeGet(',
  'storeSet('
]){
  assert(
    !src.includes(forbidden),
    `TimerService must not depend on ${forbidden}`
  );
}

console.log(
  'OK: TimerService boundary has no DOM or storage dependency'
);
