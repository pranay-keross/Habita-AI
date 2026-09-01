#!/usr/bin/env node
/* eslint-env node */
/**
 * Sends one of the four real alert payloads to a device, for verifying the push
 * integration by hand (docs/DECISIONS.md D-059).
 *
 * Why this exists rather than "just use the Firebase console": the console can
 * only send *notification* messages. The backend sends **data-only** messages,
 * which take a different delivery path — different handler, different display
 * behaviour, and the one the app actually has to get right. Testing with the
 * console would verify a path production never uses.
 *
 * Usage:
 *   1. Get a service-account key:
 *        Firebase console -> Project settings -> Service accounts
 *        -> "Generate new private key" -> save the JSON.
 *   2. Get the device token: run the app in dev and read the Metro log line
 *        [notifications] FCM token: <token>
 *   3. node scripts/send-test-push.js <service-account.json> <device-token> <type>
 *
 *      type is one of: dosage | low-stock | due-soon | due-today | all
 */

const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

const PAYLOADS = {
  dosage: {
    type: 'DOSAGE_REMINDER',
    medicineName: 'Paracetamol',
    click_action: 'OPEN_DOSAGE_SCREEN',
  },
  'low-stock': {
    type: 'LOW_STOCK',
    medicineName: 'Paracetamol',
    remainingQuantity: '5',
    click_action: 'OPEN_MEDICINE_SCREEN',
  },
  'due-soon': {
    type: 'UTILITY_DUE_SOON',
    utilityType: 'Electricity',
    provider: 'WBSEDCL',
    dueDate: '2026-09-05',
    click_action: 'OPEN_UTILITY_BILLS_SCREEN',
  },
  'due-today': {
    type: 'UTILITY_DUE_TODAY',
    utilityType: 'Electricity',
    provider: 'WBSEDCL',
    dueDate: '2026-09-05',
    click_action: 'OPEN_UTILITY_BILLS_SCREEN',
  },
};

const [keyPath, deviceToken, which = 'dosage'] = process.argv.slice(2);
if (!keyPath || !deviceToken) {
  console.error('usage: node scripts/send-test-push.js <service-account.json> <device-token> [type]');
  console.error('types:', Object.keys(PAYLOADS).join(' | '), '| all');
  process.exit(1);
}

if (!fs.existsSync(keyPath)) {
  console.error(`\nCannot find the key file: ${keyPath}\n`);
  console.error('Get one from: Firebase console -> gear icon -> Project settings');
  console.error('  -> Service accounts tab -> "Generate new private key" -> Generate key.');
  console.error('A .json file downloads. Pass its full path as the first argument.\n');
  process.exit(1);
}

let key;
try {
  key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
} catch (err) {
  console.error(`\nThat file is not valid JSON: ${keyPath}\n(${err.message})\n`);
  process.exit(1);
}

// Checked here so a wrong file fails with an explanation, rather than deep inside
// the JWT signer, which reports the useless "No key provided to sign".
for (const field of ['private_key', 'client_email', 'project_id']) {
  if (!key[field]) {
    console.error(`\nThat JSON has no "${field}", so it is not a service-account key.\n`);
    console.error('Two files are easy to confuse:');
    console.error('  google-services.json                     <- client config, already in');
    console.error('                                              android/app/. NOT this one.');
    console.error('  <project>-firebase-adminsdk-<hash>.json  <- service-account key. THIS one.\n');
    console.error('Firebase console -> gear icon -> Project settings');
    console.error('  -> Service accounts -> "Generate new private key".\n');
    process.exit(1);
  }
}

const types = which === 'all' ? Object.keys(PAYLOADS) : [which];
for (const type of types) {
  if (!PAYLOADS[type]) {
    console.error(`\nUnknown type "${type}".`);
    console.error(`Expected one of: ${Object.keys(PAYLOADS).join(' | ')} | all\n`);
    process.exit(1);
  }
}

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Mints a Google OAuth access token from the service-account key. */
function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${base64url(signer.sign(key.private_key))}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let out = '';
      res.on('data', (d) => (out += d));
      res.on('end', () => {
        const parsed = JSON.parse(out);
        parsed.access_token ? resolve(parsed.access_token) : reject(new Error(out));
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

function send(token, data) {
  // `android.priority: high` is what wakes a killed app for a data-only
  // message; without it the background handler may not run until much later.
  const body = JSON.stringify({
    message: {
      token: deviceToken,
      data,
      android: { priority: 'high' },
    },
  });
  const url = `https://fcm.googleapis.com/v1/projects/${key.project_id}/messages:send`;
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let out = '';
      res.on('data', (d) => (out += d));
      res.on('end', () => (res.statusCode === 200 ? resolve(out) : reject(new Error(`${res.statusCode} ${out}`))));
    });
    req.on('error', reject);
    req.end(body);
  });
}

(async () => {
  console.log(`\nproject: ${key.project_id}`);
  console.log(`sending:  ${types.join(', ')}\n`);
  const token = await accessToken();
  for (const type of types) {
    await send(token, PAYLOADS[type]);
    console.log(`  sent ${type.padEnd(10)} ${JSON.stringify(PAYLOADS[type])}`);
    if (types.length > 1) await new Promise((r) => setTimeout(r, 1500));
  }
  console.log('\nDone - now check the device.\n');
})().catch((err) => {
  const msg = err.message || String(err);
  console.error(`\nfailed: ${msg}\n`);
  // The two failures worth naming, because the raw FCM response does not.
  if (msg.includes('UNREGISTERED') || msg.includes('404')) {
    console.error('That device token is stale or wrong. Relaunch the app and copy the');
    console.error('fresh one from:  npx react-native log-android\n');
  } else if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
    console.error('The key is valid but lacks FCM permission, or is for another project.');
    console.error(`This key is for "${key.project_id}" - it must match the app.\n`);
  }
  process.exit(1);
});
