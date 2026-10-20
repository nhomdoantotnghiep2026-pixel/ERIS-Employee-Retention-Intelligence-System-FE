import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('site configuration points to a shipped favicon', () => {
  const config = JSON.parse(readFileSync('.figma/make/site.json', 'utf8')) as { icons?: { icon?: string } };
  assert.equal(config.icons?.icon, '/favicon.svg');
  const favicon = readFileSync('public/favicon.svg', 'utf8');
  assert.match(favicon, /^<svg[\s\S]*<\/svg>\s*$/);
});
