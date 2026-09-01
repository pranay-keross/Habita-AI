#!/usr/bin/env node
/* eslint-env node */
/**
 * Checks that this machine can actually receive push notifications.
 *
 * Exists because the failure is silent by design: `resolveTransport()` in
 * `src/features/notifications/messaging.ts` falls back to `NoopPushMessaging`
 * when Firebase cannot load, so a machine missing a dependency shows no crash,
 * no error dialog, and — the giveaway — never asks for notification permission.
 * That is indistinguishable from "the feature is broken" unless you know where
 * to look (docs/DECISIONS.md D-059).
 *
 *   node scripts/check-push-setup.js
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const results = [];

function check(label, fn, fix) {
  let ok = false;
  let detail = '';
  try {
    const r = fn();
    ok = r === true || (r && r.ok);
    detail = (r && r.detail) || '';
  } catch (err) {
    ok = false;
    detail = err.message;
  }
  results.push({ label, ok, detail, fix });
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

// --- 1. JS dependencies ----------------------------------------------------
// The single most common cause: the repo was pulled but `npm install` was not
// run, so the Firebase modules are absent and the transport silently no-ops.
for (const pkg of [
  '@react-native-firebase/app',
  '@react-native-firebase/messaging',
  '@notifee/react-native',
]) {
  check(
    `dependency installed: ${pkg}`,
    () => {
      const p = path.join(root, 'node_modules', pkg, 'package.json');
      if (!fs.existsSync(p)) return { ok: false, detail: 'not in node_modules' };
      return { ok: true, detail: `v${JSON.parse(fs.readFileSync(p, 'utf8')).version}` };
    },
    'run:  npm install',
  );
}

// --- 2. Firebase project config -------------------------------------------
check(
  'android/app/google-services.json present',
  () => exists('android/app/google-services.json'),
  'This file is committed to the repo. If it is missing, the pull was incomplete.',
);

check(
  'google-services.json package matches applicationId',
  () => {
    const gs = JSON.parse(read('android/app/google-services.json'));
    const pkgs = gs.client.map((c) => c.client_info.android_client_info.package_name);
    const m = read('android/app/build.gradle').match(/applicationId\s+"([^"]+)"/);
    const appId = m && m[1];
    return {
      ok: pkgs.includes(appId),
      detail: `applicationId=${appId} google-services=${pkgs.join(',')}`,
    };
  },
  'A mismatch means FCM will never issue a token for this build.',
);

check(
  'firebase.json sets the notification channel id',
  () => {
    if (!exists('firebase.json')) return { ok: false, detail: 'firebase.json missing' };
    const fj = JSON.parse(read('firebase.json'));
    const id = fj['react-native'] && fj['react-native'].messaging_android_notification_channel_id;
    const src = read('src/features/notifications/firebaseMessaging.ts');
    const codeId = (src.match(/ANDROID_CHANNEL_ID\s*=\s*'([^']+)'/) || [])[1];
    return {
      ok: !!id && id === codeId,
      detail: `firebase.json=${id} code=${codeId}`,
    };
  },
  'A mismatch silently drops every backgrounded message on Android 8+.',
);

// --- 3. Native Android config ---------------------------------------------
check(
  'firebase-messaging in android/app/build.gradle',
  () => read('android/app/build.gradle').includes('firebase-messaging'),
  'Without it the app has analytics only and cannot receive a push.',
);

check(
  'POST_NOTIFICATIONS in AndroidManifest.xml',
  () => read('android/app/src/main/AndroidManifest.xml').includes('POST_NOTIFICATIONS'),
  'Android 13+ shows no notification without this runtime permission.',
);

check(
  'AndroidManifest does NOT re-declare the channel meta-data',
  () =>
    !read('android/app/src/main/AndroidManifest.xml').includes(
      'default_notification_channel_id',
    ),
  'Re-declaring it fails the manifest merger — @react-native-firebase/messaging ' +
    'already declares that key. Set it in firebase.json instead.',
);

check(
  'background handler registered in index.js',
  () => read('index.js').includes('setBackgroundMessageHandler'),
  'Without it, messages arriving while the app is closed are dropped.',
);

// --- 4. Connected device / emulator ----------------------------------------
// Static config can be perfect and push still never arrive, because FCM is
// delivered *by* Google Play Services. A plain AOSP emulator image has none, so
// `getToken()` fails and no registration ever happens. This is the single most
// common emulator trap, and nothing in the JS can detect or work around it.
const { execSync } = require('child_process');

function adb(args) {
  return execSync(`adb ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

let deviceConnected = false;
try {
  const out = adb('devices');
  deviceConnected = out.split('\n').slice(1).some((l) => /\sdevice\s*$/.test(l.trim()));
} catch {
  // adb not on PATH — skip the runtime checks rather than failing the run.
}

if (deviceConnected) {
  check(
    'device has Google Play Services',
    () => {
      const pkgs = adb('shell pm list packages');
      const gms = pkgs.includes('com.google.android.gms');
      return {
        ok: gms,
        detail: gms ? 'com.google.android.gms present' : 'MISSING - FCM cannot deliver',
      };
    },
    'Your emulator image has no Play Services. In Android Studio -> Device Manager,\n' +
      '        create a device whose system image says "Google Play" or "Google APIs"\n' +
      '        (an image with no Google branding will never receive a push).',
  );

  check(
    'app installed on the device',
    () => {
      const pkgs = adb('shell pm list packages');
      return {
        ok: pkgs.includes('com.sahelicli'),
        detail: pkgs.includes('com.sahelicli') ? 'com.sahelicli' : 'not installed',
      };
    },
    'run:  npx react-native run-android',
  );
} else {
  console.log('  (no device/emulator detected via adb - runtime checks skipped)');
}

// --- Report ----------------------------------------------------------------
const pad = Math.max(...results.map((r) => r.label.length));
let failed = 0;
console.log('');
for (const r of results) {
  if (!r.ok) failed++;
  const mark = r.ok ? 'OK  ' : 'FAIL';
  console.log(`  ${mark}  ${r.label.padEnd(pad)}  ${r.detail}`);
}
console.log('');

if (failed === 0) {
  console.log('All static checks pass.\n');
  console.log('If push still does not work on this machine, the remaining causes are');
  console.log('runtime, not configuration:');
  console.log('  1. The app was not rebuilt natively after installing the packages.');
  console.log('     Adding a native module needs a real rebuild, not just Metro:');
  console.log('        npx react-native run-android');
  console.log('  2. The device or emulator has no Google Play Services. FCM cannot');
  console.log('     deliver without it — use an emulator image that includes Play.');
  console.log('        adb shell pm list packages | grep com.google.android.gms');
  console.log('  3. Nobody is signed in. Device registration is gated on sign-in,');
  console.log('     so no permission prompt appears until you log in.');
  console.log('  4. Check the log for the real reason:');
  console.log('        npx react-native log-android');
  console.log('     A line starting "[notifications] Firebase transport failed to');
  console.log('     load" names the cause exactly.\n');
} else {
  console.log(`${failed} check(s) failed. Fixes:\n`);
  for (const r of results.filter((x) => !x.ok)) {
    console.log(`  ${r.label}`);
    console.log(`     -> ${r.fix}\n`);
  }
  process.exitCode = 1;
}
