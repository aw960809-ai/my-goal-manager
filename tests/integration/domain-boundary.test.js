'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'../..');
const domainDir=path.join(root,'js','domain');

const forbidden=[
  /\bdocument\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bstoreGet\b/,
  /\bstoreSet\b/
];

for(const name of fs.readdirSync(domainDir).filter(x=>x.endsWith('.js'))){
  const src=fs.readFileSync(path.join(domainDir,name),'utf8');
  const hit=forbidden.find(re=>re.test(src));
  assert.strictEqual(
    hit,
    undefined,
    `${name} violates Domain boundary: ${hit}`
  );
}

console.log('OK: Domain boundary has no DOM or storage dependency');
