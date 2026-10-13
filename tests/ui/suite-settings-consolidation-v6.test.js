/* V6 UI-only settings consolidation: five clear accordion destinations. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const settings=read('js/settings.js'),css=read('css/design-system.css');
const templates=settings.slice(settings.indexOf('function renderSettings(){'));
assert.equal((templates.match(/settingsPanelMarkup\('/g)||[]).length,5,'retain five settings destinations');
assert(!templates.includes('data-settings-jump='),'do not duplicate accordion navigation');
assert(!settings.includes('function showSettingsSection('),'remove dead navigation handler');
assert(settings.includes('設定由此統一管理')||settings.includes('外觀統一管理'));
for(const name of ['外觀與顯示','提醒與通知','學習連動','資料與備份','系統工具'])
  assert(templates.includes(name),'retain destination: '+name);
for(const id of ['settingsToeicLinkState','settingsToeicLinkInfo','settingsDataStatus','settingsHealthMount'])
  assert(templates.includes('id="'+id+'"'),'retain: '+id);
assert(settings.includes("report?.lastCheckedAt"));
assert(settings.includes("timeZone:'Asia/Taipei'"));
assert(settings.includes("report?.blocked"));
assert(settings.includes("const SHARED_APPEARANCE_KEY='gm-suite:appearance-v1'"));
assert(!settings.includes('localStorage.clear('));
assert(css.includes('.settings-hub-panel{margin-bottom:8px;border-radius:14px;box-shadow:none}'));
assert(css.includes('.settings-hub-color-option:has(input:focus-visible)'));
assert(css.trimEnd().endsWith('/* GM-VISUAL-PHASE3-20261008-END */'));
console.log('PASS: V6 Goal settings, five compact disclosures, accurate read-only status, unchanged data boundary');
