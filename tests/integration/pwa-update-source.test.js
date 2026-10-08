const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const versionSource=read('config/version.js');
const sw=read('sw.js');
const pwa=read('js/pwa.js');

const match=versionSource.match(
  /GOAL_MANAGER_VERSION\s*=\s*['"]([^'"]+)['"]/
);

assert(match,'version.js must expose GOAL_MANAGER_VERSION');
assert.strictEqual(match[1],'98.11.6');

assert(
  sw.includes("importScripts('./config/version.js')"),
  'service worker must use version.js as source of truth'
);

assert(
  pwa.includes("new URL('./config/version.js',location.href)"),
  'PWA remoteMeta must fetch version.js'
);

assert(
  pwa.includes('GOAL_MANAGER_VERSION\\s*=\\s*'),
  'PWA remoteMeta must parse GOAL_MANAGER_VERSION'
);

assert(
  !pwa.includes('source.match(/const\\s+PWA_VERSION'),
  'PWA update check must not expect literal PWA_VERSION in sw.js'
);


assert(
  sw.includes('const CRITICAL_SHELL=[')&&
  sw.includes('async function warmInstallCache(urls)')&&
  sw.includes('self.skipWaiting();'),
  'service worker install must use a bounded critical-shell warmup'
);

assert(
  !sw.includes('await cache.addAll(APP_SHELL)'),
  'service worker install must not block on the whole app shell'
);

assert(
  pwa.includes('const UPDATE_SETTLE_MAX_MS=30*1000')&&
  pwa.includes('function updateWaitExpired()')&&
  pwa.includes('UPDATE_SETTLE_RETRY_MS'),
  'PWA update settlement must have a bounded retry window'
);

assert(
  pwa.includes('目前頁面可繼續使用')&&
  pwa.includes('下次啟動自動重試'),
  'PWA update timeout must fail open without blocking normal use'
);

console.log('OK: PWA update check uses canonical version source');
