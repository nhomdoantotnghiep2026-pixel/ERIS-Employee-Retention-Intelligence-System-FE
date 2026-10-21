// Autofill commonly emits input with no inputType or insertReplacementText.
// Only accept edits made by typing, pasting, dropping text, or deleting it.
export function isManualPasswordEdit(inputType?: string | null) {
  return Boolean(inputType && (
    ['insertText', 'insertCompositionText', 'insertFromComposition', 'insertFromPaste', 'insertFromDrop', 'historyUndo', 'historyRedo'].includes(inputType)
    || inputType.startsWith('delete')
  ));
}
