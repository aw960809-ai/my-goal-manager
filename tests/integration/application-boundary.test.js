const assert=require('assert');
const fs=require('fs');
const path=require('path');

const dir=path.join(__dirname,'../../js/application');
const files=fs.readdirSync(dir).filter(x=>x.endsWith('.js'));

for(const file of files){
  const src=fs.readFileSync(path.join(dir,file),'utf8');

  for(const forbidden of [
    'document',
    'localStorage',
    'sessionStorage',
    'storeGet(',
    'storeSet('
  ]){
    assert(
      !src.includes(forbidden),
      `${file} must not access ${forbidden} directly`
    );
  }
}

console.log('OK: Application orchestration has no DOM or storage dependency');
