'use strict';
const assert=require('node:assert/strict');
const api=require('../../js/toeic-embed.js');
const nav='.main-nav [data-tab="settings"]';
const markers=['#homeStartPractice','#homeStartVocab','#homeStartGrammar','#vocabViewTabs'];
function doc(xs){
  return {querySelector:s=>xs.includes(s)?{}:null};
}
assert.equal(api.isOldFrame(doc([nav,...markers])),false);
assert.equal(api.isOldFrame(doc([nav])),true);
assert.equal(api.isOldFrame(doc(markers)),false);
assert.equal(api.isOldFrame(doc([nav,...markers.slice(0,3)])),true);
console.log('TOEIC_MODERN_FRAME_DETECTION_OK');
