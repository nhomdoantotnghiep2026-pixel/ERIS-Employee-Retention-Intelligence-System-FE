import assert from 'node:assert/strict';
import test from 'node:test';
import { isManualPasswordEdit } from '../src/utils/manualPassword.ts';

test('saved-password autofill is not accepted as a manually entered password', () => {
  for (const type of [undefined, null, '', 'insertReplacementText']) assert.equal(isManualPasswordEdit(type), false);
});

test('typing, composition, paste and deletion remain available for password entry', () => {
  for (const type of ['insertText', 'insertCompositionText', 'insertFromComposition', 'insertFromPaste', 'insertFromDrop', 'deleteContentBackward', 'deleteContentForward', 'historyUndo', 'historyRedo']) {
    assert.equal(isManualPasswordEdit(type), true, type);
  }
});
