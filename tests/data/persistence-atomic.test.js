const assert=require('assert');
const DataPersistence=require('../../js/data/persistence.js');

const stable=JSON.stringify;
const checksum=value=>String(value.length);
const makeEnvelope=data=>({
  data,
  checksum:checksum(stable(data))
});
const parseEnvelope=raw=>{
  const parsed=JSON.parse(raw);
  if(parsed.checksum!==checksum(stable(parsed.data))){
    throw new Error('bad checksum');
  }
  return parsed;
};
const envelope=data=>JSON.stringify(makeEnvelope(data));

{
  const old=envelope({tasks:[],logs:[{id:'old'}]});
  const memory=new Map([
    ['main',old],
    ['b1','old-b1']
  ]);
  const read=k=>memory.get(k)||null;
  const write=(k,v)=>{memory.set(k,v);return true};
  let guardSawOld=false;

  DataPersistence.persist(
    {tasks:[],logs:[{id:'old'},{id:'new'}]},
    {
      prepare:x=>x,
      read,
      write,
      writeStatus:()=>({persistent:true}),
      key:'main',
      backupKeys:['b1','b2'],
      backup:true,
      guard:({oldRaw})=>{guardSawOld=oldRaw===old},
      makeEnvelope,
      parseEnvelope,
      serializePayload:stable,
      checksum
    }
  );

  assert.strictEqual(guardSawOld,true);
  assert.strictEqual(read('b1'),old);
  assert.strictEqual(read('b2'),'old-b1');
}

{
  const old=envelope({tasks:[],logs:[{id:'safe'}]});
  const memory=new Map([
    ['main',old],
    ['b1','protected-b1']
  ]);
  const read=k=>memory.get(k)||null;
  let mainWrites=0;
  const write=(k,v)=>{
    if(k==='main'){
      mainWrites++;
      if(mainWrites===1){
        memory.set(k,'{"data":{},"checksum":"999"}');
        return true;
      }
    }
    memory.set(k,v);
    return true;
  };

  assert.throws(
    ()=>DataPersistence.persist(
      {tasks:[],logs:[]},
      {
        prepare:x=>x,
        read,
        write,
        writeStatus:()=>({persistent:true}),
        key:'main',
        backupKeys:['b1'],
        backup:true,
        makeEnvelope,
        parseEnvelope,
        serializePayload:stable,
        checksum
      }
    )
  );

  assert.strictEqual(read('main'),old);
  assert.strictEqual(read('b1'),'protected-b1');
}

console.log('OK: DataPersistence verifies primary before rotating backups and rolls back failed writes');
