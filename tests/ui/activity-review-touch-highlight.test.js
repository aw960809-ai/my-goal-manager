'use strict';
/* Regression: extend canonical Android styles; no cascade override added. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const css = read('css/refinements.css');
const activity = read('js/activity.js');
const base = read('css/design-system.css');
const marker = '/* GM-V98.13.4: prevent Android native blue touch highlight on accordions.';
assert.equal(css.split(marker).length - 1, 1, 'one canonical Android style block');
assert(!css.includes('/* GM-REVIEW-ANDROID-TAP-20261017'), 'discard duplicate override block');
const body = css.slice(css.indexOf(marker));
const end = `  #settingsBody .settings-hub-advanced > summary,\n  #activity .activity-review-disclosure > summary,\n  #activity .activity-review-why > summary\n)`;
assert.equal(body.split(end).length - 1, 4, 'cover normal, touch-focus, keyboard-focus and active states');
for (const suffix of [' {', ':focus:not(:focus-visible) {', ':focus-visible {', ':active {']) {
  assert(body.includes(end + suffix), 'missing expected Android accordion rule: '+suffix);
}
assert(body.includes('-webkit-tap-highlight-color: transparent !important;'));
assert(body.includes('touch-action: manipulation;'));
assert(body.includes('outline: 3px solid var(--gm-focus'));
assert(!body.includes('display: none'), 'never hide details or content in the Android block');
assert(base.includes('.activity-review-disclosure[open]>summary::after'), 'preserve chevron for native toggle');
assert(activity.includes('<details class="activity-review-disclosure"><summary>'));
assert(activity.includes('<details class="activity-review-why"><summary>'));
assert(activity.includes('const wasOpen=!!box.querySelector'));
console.log('PASS: review accordion Android tap without added CSS cascade debt');
