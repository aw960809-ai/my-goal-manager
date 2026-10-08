'use strict';
/* Activity circle UI integration against a tiny DOM harness; no real user data. */
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const nav=read('js/navigation.js');
const css=read('css/design-system.css');
const html=read('index.html');
const activity=read('js/activity.js');

assert(html.includes('id="activityScope"'), 'keep original scope selector as a fallback');
for(const v of ['東海校內','台中','中部','全國'])assert(html.includes(`value="${v}"`),`missing ${v}`);
assert(nav.includes('GM-ACTIVITY-CIRCLE-CARDS-20261008'));
assert(nav.includes("select.dispatchEvent(new Event('change',{bubbles:true}))"), 'reuse original filter lifecycle');
assert(nav.includes("new MutationObserver(syncCircleSelection).observe(stats,{childList:true})"), 'reset must sync active selection');
assert(css.includes('#activity .activity-filter-row.radar-filters-ready .activity-scope-legacy{display:none!important}'), 'duplicate control should hide only after enhancement');
assert(css.includes('.radar-ring.active'), 'active state must be perceptible');
assert(activity.includes("circleFilter==='全部'||a.fit.circleLabel===circleFilter"), 'circle policy must remain source of truth');

class Node {
  constructor(tag='div',className=''){
    this.tagName=tag.toUpperCase();this.className=className;
    this.dataset={};this.attributes={};this.children=[];this.parentNode=null;
    this.listeners={};
    this.classList={
      add:name=>{const names=new Set(this.className.split(/\s+/));names.add(name);this.className=[...names].join(' ');},
      remove:name=>{this.className=this.className.split(/\s+/).filter(x=>x!==name).join(' ');},
      toggle:(name,value)=>{if(value)this.classList.add(name);else this.classList.remove(name)}
    };
  }
  get firstChild(){return this.children[0]||null}
  appendChild(child){if(child.parentNode){child.parentNode.children=child.parentNode.children.filter(n=>n!==child)}this.children.push(child);child.parentNode=this;return child}
  replaceWith(next){const nodes=this.parentNode.children;const i=nodes.indexOf(this);assert(i>=0);nodes[i]=next;next.parentNode=this.parentNode;this.parentNode=null}
  setAttribute(name,value){this.attributes[name]=String(value)}
  addEventListener(type,callback){(this.listeners[type]??=[]).push(callback)}
  dispatchEvent(event){(this.listeners[event.type]||[]).forEach(fn=>fn(event));return true}
  click(){this.dispatchEvent({type:'click',target:this})}
  querySelector(selector){const parts=selector.split('.').filter(Boolean);return this.children.find(n=>parts.every(c=>n.className.split(' ').includes(c)))||null}
  closest(selector){if(selector==='.filter-control')return this.filterControl||null;
    if(selector==='.activity-filter-row')return this.filterRow||null;return null}
}
const guide=new Node('div','activity-radar-guide');
for(const c of ['core','near','extended','explore']){
  const el=new Node('div','radar-ring '+c);
  el.appendChild(new Node('b'));el.appendChild(new Node('small'));
  guide.appendChild(el);
}
const label=new Node('label','filter-control');
const row=new Node('div','activity-filter-row');
const select=new Node('select');
select.options=['全部','東海校內','台中','中部','全國'].map(value=>({value}));
select.value='全部';select.filterControl=label;select.filterRow=row;
const stats=new Node('div');
let summaryVersion=0;
const observerByTarget=new Map();
let renders=0;
// Mimic original HTML onchange: render uses same select and updates summary.
select.addEventListener('change',()=>{renders++;summaryVersion++;
  (observerByTarget.get(stats)||[]).forEach(callback=>callback());
});
const navElement=new Node('nav','bottom-nav');
const body=new Node('body');
const events=[];
const document={readyState:'loading',body,documentElement:{scrollTop:0},
  getElementById:id=>({activityScope:select,activityStats:stats})[id]||null,
  querySelector:selector=>selector==='#activity .activity-radar-guide'?guide:
    selector==='.bottom-nav'?navElement:null,
  querySelectorAll:()=>[],
  addEventListener:(event,cb)=>events.push([event,cb]),
  createElement:tag=>new Node(tag)
};
const window={scrollY:0,matchMedia:()=>({matches:true}),addEventListener:()=>{}};
const MutationObserver=class{constructor(fn){this.fn=fn}observe(target){
  const list=observerByTarget.get(target)||[];list.push(this.fn);observerByTarget.set(target,list);
}};
vm.runInNewContext(nav,{window,document,MutationObserver,
  requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn(),Event:class Event{constructor(type){this.type=type}}
},{filename:'navigation.js'});
for(const [event,fn] of events)if(event==='DOMContentLoaded')fn();
assert.strictEqual(guide.children.length,4);
assert(guide.children.every(child=>child.tagName==='BUTTON'));
assert(label.className.includes('activity-scope-legacy'));
assert(row.className.includes('radar-filters-ready'));
assert(guide.children.every(button=>button.attributes['aria-pressed']==='false'));

const [thu,taichung,central,nationwide]=guide.children;
thu.click();assert.strictEqual(select.value,'東海校內');
assert.strictEqual(thu.attributes['aria-pressed'],'true');assert.strictEqual(renders,1);
central.click();assert.strictEqual(select.value,'中部');assert.strictEqual(thu.attributes['aria-pressed'],'false');
assert.strictEqual(central.attributes['aria-pressed'],'true');assert.strictEqual(renders,2);
central.click();assert.strictEqual(select.value,'全部');assert.strictEqual(central.attributes['aria-pressed'],'false');
assert.strictEqual(renders,3);
nationwide.click();assert.strictEqual(select.value,'全國');
assert.strictEqual(nationwide.attributes['aria-pressed'],'true');
select.value='全部'; // Simulate a reset that does not dispatch a native change event.
(observerByTarget.get(stats)||[]).forEach(callback=>callback());
assert(guide.children.every(button=>button.attributes['aria-pressed']==='false'));
taichung.click();assert.strictEqual(select.value,'台中');
assert.strictEqual(taichung.attributes['aria-pressed'],'true');
assert.strictEqual(guide.children[0].children.length,2,'ring text content must be preserved');
console.log('OK: four accessible circle buttons, native filter reuse, toggle-reset, and rerender synchronization');
