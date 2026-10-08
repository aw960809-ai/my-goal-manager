'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const tokens=read('css/tokens.css');
const design=read('css/design-system.css');
const html=read('index.html');
const begin='GM-VISUAL-PHASE3-20261008-BEGIN';
const end='GM-VISUAL-PHASE3-20261008-END';
function count(s,term){return s.split(term).length-1}
for(const [name,s] of [['tokens',tokens],['design',design]]){
  assert.strictEqual(count(s,begin),1,`${name}: design block must occur once`);
  assert.strictEqual(count(s,end),1,`${name}: design block must be closed`);
}
for(const key of ['--gm-font-sans','--gm-font-size-body','--gm-on-primary',
  '--gm-layout-pad','--gm-layout-gap','--gm-layout-card','--gm-primary-soft']){
  assert(tokens.includes(key),`shared token missing: ${key}`);
}
assert(tokens.includes('"Noto Sans TC"'), 'Taiwanese font stack missing');
assert(tokens.includes('html[data-appearance="dark"]'),'explicit dark appearance missing');
assert(tokens.includes('html[data-appearance="system"]'),'system dark appearance missing');
assert(tokens.includes('html[data-density="compact"]'),'compact density missing');
assert(tokens.includes('html[data-density="comfortable"]'),'comfortable density missing');
for(const selector of ['.home-metric','.goal-browse-card','.stats-kpi',
  '.bottom-nav button.active','.home-explore-card','.actual-history-row-main small',
  '#activity .filter-control','#calendar .calendar-shell','.settings-section']){
  assert(design.includes(selector),`visual component missing: ${selector}`);
}
for(const id of ['id="dash"','id="goals"','id="today"','id="stats"',
  'id="calendar"','id="activity"','id="scholarship"']){
  assert(html.includes(id),`missing expected view: ${id}`);
}
assert(design.includes('@media(max-width:700px)'), 'mobile layout contract missing');
assert(design.includes('prefers-reduced-motion:reduce'), 'reduced motion contract missing');
assert(design.includes('color:var(--gm-on-primary)!important'), 'adaptive primary text missing');
assert(!design.includes('font-family:url('),'remote font injection is disallowed');
assert(!design.includes('@import url('),'style must work offline');
// Palette contract: normal and secondary labels remain legible in both modes.
const light=tokens.match(/:root\{([\s\S]*?)\n\}/)?.[1];
const dark=tokens.match(/html\[data-appearance="dark"\]\{([\s\S]*?)\n\}/)?.[1];
assert(light&&dark,'missing canonical light/dark palette');
const hex=(block,key)=>{
  const value=block.match(new RegExp(`--${key}:(#[0-9A-Fa-f]{6});`))?.[1];
  assert(value,`missing color token ${key}`);
  return value;
};
const luminance=color=>{
  const rgb=[1,3,5].map(n=>parseInt(color.slice(n,n+2),16)/255)
    .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
const contrast=(a,b)=>{
  const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (hi+.05)/(lo+.05);
};
for(const block of [light,dark]){
  const surface=hex(block,'gm-surface');
  for(const key of ['gm-text','gm-text-secondary','gm-text-muted']){
    assert(contrast(hex(block,key),surface)>=4.5,`${key} must have readable contrast`);
  }
  assert(contrast(hex(block,'gm-primary'),hex(block,'gm-bg'))>=3,'accent text must stay distinguishable');
}
console.log('OK: Phase 3 typography, colors (contrast), theme, density, mobile and navigation');
