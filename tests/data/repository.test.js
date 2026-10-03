const assert=require('assert');
const DataRepository=require('../../js/data/repository.js');

const good=DataRepository.readCandidate(
  '{"data":{"tasks":[],"logs":[]},"schemaVersion":6}',
  {
    parseEnvelope:raw=>JSON.parse(raw),
    migrateData:(data)=>data,
    isUsableData:data=>Array.isArray(data.tasks)&&Array.isArray(data.logs),
    validateData:()=>[]
  }
);

assert(good);
assert.deepStrictEqual(good.tasks,[]);

const bad=DataRepository.readCandidate(
  'bad-json',
  {
    parseEnvelope:raw=>JSON.parse(raw),
    migrateData:data=>data,
    isUsableData:()=>true,
    validateData:()=>[]
  }
);

assert.strictEqual(bad,null);

const invalid=DataRepository.readCandidate(
  '{"data":{"tasks":[],"logs":[]},"schemaVersion":6}',
  {
    parseEnvelope:raw=>JSON.parse(raw),
    migrateData:data=>data,
    isUsableData:()=>true,
    validateData:()=>['錯誤']
  }
);

assert.strictEqual(invalid,null);

console.log('OK: DataRepository candidate decoding and validation boundary');
