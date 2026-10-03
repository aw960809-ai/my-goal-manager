const assert=require('assert');
const fs=require('fs');
const path=require('path');

const dir=path.join(__dirname,'../../js/ui/pages');
const files=fs.readdirSync(dir).filter(x=>x.endsWith('.js'));

for(const file of files){
  const src=fs.readFileSync(path.join(dir,file),'utf8');

  for(const forbidden of [
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

console.log('OK: UI page layer has no direct storage dependency');
