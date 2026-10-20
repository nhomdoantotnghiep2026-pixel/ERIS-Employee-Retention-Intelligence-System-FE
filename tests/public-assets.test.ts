import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const folders = ['public/product-previews', 'public/login-slides'];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

test('public preview and login images ship as PNG files in Git without LFS', () => {
  for (const folder of folders) {
    const images = readdirSync(folder).filter(name => name.endsWith('.png'));
    assert.ok(images.length > 0, `${folder} must contain images`);
    for (const name of images) {
      const path = `${folder}/${name}`;
      const attrs = execFileSync('git', ['check-attr', 'filter', '--', path], { encoding: 'utf8' });
      assert.match(attrs, /filter: unset/, `${path} must not require Git LFS`);
      const local = readFileSync(path);
      assert.deepEqual(local.subarray(0, 8), pngSignature, `${path} must be a real PNG`);
      const entry = execFileSync('git', ['ls-files', '-s', '--', path], { encoding: 'utf8' });
      const objectId = entry.split(/\s+/)[1];
      assert.ok(objectId, `${path} must be tracked in Git`);
      const stored = execFileSync('git', ['cat-file', 'blob', objectId], { maxBuffer: 8 * 1024 * 1024 });
      assert.deepEqual(stored, local, `${path} must ship the complete image, not an LFS pointer`);
    }
  }
});