#!/usr/bin/env node
/*
 * Rewrites upstream identifiers in packages/happy-app/{app.config.js,eas.json}
 * to fork-specific values supplied via env vars. Run inside CI before `eas build`.
 *
 * Required env:
 *   IOS_BUNDLE_ID        e.g. fyi.ms.happy
 *   EXPO_OWNER           Expo account/org slug, e.g. heianhu
 *   EAS_PROJECT_ID       UUID of the EAS project under EXPO_OWNER
 *   ASC_APP_ID           App Store Connect numeric App ID
 *   APPLE_TEAM_ID        10-char Apple developer team ID
 *   ASC_KEY_ID           ASC API Key ID
 *   ASC_ISSUER_ID        ASC API Key Issuer UUID
 *   ASC_KEY_PATH         absolute path to the .p8 file written by the workflow
 */

const fs = require('fs');
const path = require('path');

const required = [
    'IOS_BUNDLE_ID', 'EXPO_OWNER', 'EAS_PROJECT_ID',
    'ASC_APP_ID', 'APPLE_TEAM_ID',
    'ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_KEY_PATH',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
    console.error(`Missing required env: ${missing.join(', ')}`);
    process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..', '..');
const appDir = path.join(repoRoot, 'packages', 'happy-app');
const configPath = path.join(appDir, 'app.config.js');
const easPath = path.join(appDir, 'eas.json');

const {
    IOS_BUNDLE_ID, EXPO_OWNER, EAS_PROJECT_ID,
    ASC_APP_ID, APPLE_TEAM_ID,
    ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH,
} = process.env;

// --- Patch app.config.js (string replacements; keep file shape stable) ---
let cfg = fs.readFileSync(configPath, 'utf8');

const replacements = [
    {
        from: /production:\s*"com\.ex3ndr\.happy"/,
        to: `production: "${IOS_BUNDLE_ID}"`,
        label: 'production bundleId',
    },
    {
        from: /owner:\s*"bulkacorp"/,
        to: `owner: "${EXPO_OWNER}"`,
        label: 'expo owner',
    },
    {
        from: /projectId:\s*"4558dd3d-cd5a-47cd-bad9-e591a241cc06"/,
        to: `projectId: "${EAS_PROJECT_ID}"`,
        label: 'eas projectId',
    },
    {
        from: /url:\s*"https:\/\/u\.expo\.dev\/4558dd3d-cd5a-47cd-bad9-e591a241cc06"/,
        to: `url: "https://u.expo.dev/${EAS_PROJECT_ID}"`,
        label: 'updates url',
    },
];

for (const r of replacements) {
    if (!r.from.test(cfg)) {
        console.error(`Pattern not found in app.config.js: ${r.label}. Upstream file changed?`);
        process.exit(1);
    }
    cfg = cfg.replace(r.from, r.to);
    console.log(`patched app.config.js :: ${r.label}`);
}
fs.writeFileSync(configPath, cfg);

// --- Patch eas.json submit.production.ios ---
const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
eas.submit = eas.submit || {};
eas.submit.production = eas.submit.production || {};
eas.submit.production.ios = {
    ascAppId: ASC_APP_ID,
    appleTeamId: APPLE_TEAM_ID,
    ascApiKeyPath: ASC_KEY_PATH,
    ascApiKeyId: ASC_KEY_ID,
    ascApiKeyIssuerId: ASC_ISSUER_ID,
};
fs.writeFileSync(easPath, JSON.stringify(eas, null, 2) + '\n');
console.log('patched eas.json :: submit.production.ios -> ASC API Key');
