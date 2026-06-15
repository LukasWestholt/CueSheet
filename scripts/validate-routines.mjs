// Validate the committed routine JSON files against public/routines.schema.json,
// and check that public/routines.json only references files that exist. Run in
// CI (and locally via `npm run validate:json`) so a malformed routine can't
// reach main. The app validates again at runtime (validateTracks), but this
// catches authoring mistakes before they ship.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020').default ?? require('ajv/dist/2020');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const SCHEMA = join(publicDir, 'routines.schema.json');

const errors = [];

// 1. The schema itself must compile.
const ajv = new Ajv2020({ allErrors: true, strict: false });
let validate;
try {
  validate = ajv.compile(JSON.parse(readFileSync(SCHEMA, 'utf8')));
} catch (e) {
  console.error(`✗ routines.schema.json failed to compile: ${e.message}`);
  process.exit(1);
}

// 2. Every routine file (playbook-*.json, default.json, default.*.json) must
//    validate against the schema. These are the array-shaped routine files; the
//    manifest (routines.json) and the schema are intentionally excluded.
const isRoutineFile = (f) => /^playbook-.*\.json$/.test(f) || /^default(\.[^/]+)?\.json$/.test(f);
const files = readdirSync(publicDir).filter(isRoutineFile).sort();

if (files.length === 0) {
  console.error('✗ No routine files found in public/ (expected at least playbook-*.json).');
  process.exit(1);
}

for (const f of files) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(publicDir, f), 'utf8'));
  } catch (e) {
    errors.push(`${f}: not valid JSON — ${e.message}`);
    continue;
  }
  if (validate(data)) {
    console.log(`✓ ${f} (${Array.isArray(data) ? data.length : '?'} tracks)`);
  } else {
    for (const err of validate.errors ?? []) {
      errors.push(`${f}: ${err.instancePath || '/'} ${err.message}`);
    }
  }
}

// 3. The manifest must only reference files that exist (a dead entry would 404).
const manifestPath = join(publicDir, 'routines.json');
if (existsSync(manifestPath)) {
  try {
    const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const list = Array.isArray(raw) ? raw : raw?.routines;
    if (!Array.isArray(list)) {
      errors.push('routines.json: expected an array or { "routines": [...] }.');
    } else {
      for (const entry of list) {
        const file = entry?.file;
        if (typeof file !== 'string' || !file) {
          errors.push('routines.json: an entry is missing a "file".');
          continue;
        }
        if (/^https?:\/\//.test(file)) continue; // external URL — not our file
        const rel = file.replace(/^\//, '');
        if (!existsSync(join(publicDir, rel))) {
          errors.push(`routines.json: references "${file}" which does not exist in public/.`);
        }
      }
    }
  } catch (e) {
    errors.push(`routines.json: not valid JSON — ${e.message}`);
  }
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`\n✓ ${files.length} routine file(s) valid against routines.schema.json.`);
