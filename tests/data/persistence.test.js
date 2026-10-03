const assert=require('assert');
const DataPersistence=require('../../js/data/persistence.js');

const memory=new Map();
const read=key=>memory.get(key)||null;
const write=(key,value)=>{
  memory.set(key,value);
  return true;
};

memory.set('main','old-current');
memory.set('b1','old-b1');
memory.set('b2','old-b2');

DataPersistence.rotateBackups({
  read,
  write,
  backupKeys:['b1','b2','b3'],
  currentRaw:'old-current'
});

assert.strictEqual(read('b1'),'old-current');
assert.strictEqual(read('b2'),'old-b1');
assert.strictEqual(read('b3'),'old-b2');

memory.clear();

const stable=value=>JSON.stringify(value);
const checksum=value=>String(value.length);
const makeEnvelope=data=>({
  schemaVersion:6,
  data,
  checksum:checksum(stable(data))
});
const parseEnvelope=raw=>{
  const parsed=JSON.parse(raw);
  const payload=stable(parsed.data);
  if(parsed.checksum!==checksum(payload)){
    throw new Error('bad checksum');
  }
  return parsed;
};

const prepared=DataPersistence.persist(
  {tasks:[],logs:[]},
  {
    prepare:data=>({...data,normalized:true}),
    read,
    write,
    writeStatus:()=>({persistent:true}),
    key:'main',
    backupKeys:['b1','b2'],
    backup:false,
    makeEnvelope,
    parseEnvelope,
    serializePayload:stable,
    checksum
  }
);

assert.strictEqual(prepared.normalized,true);
assert(read('main'));

memory.clear();
memory.set('main','bad');
memory.set('b1','good-backup');

const found=DataPersistence.loadFirstValid({
  read,
  currentKey:'main',
  backupKeys:['b1'],
  legacyKeys:['legacy'],
  decode:raw=>{
    if(raw==='good-backup'){
      return {tasks:[],logs:[]};
    }
    return null;
  }
});

assert(found);
assert.strictEqual(found.source,'backup');
assert.strictEqual(found.key,'b1');

const none=DataPersistence.loadFirstValid({
  read:()=>null,
  currentKey:'main',
  backupKeys:['b1'],
  legacyKeys:['legacy'],
  decode:()=>null
});

assert.strictEqual(none,null);

console.log('OK: DataPersistence backup rotation, verified write and recovery selection');
