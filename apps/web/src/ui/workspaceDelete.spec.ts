import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { confirmDeleteNodeMessage } from './urls';

const root = resolve(fileURLToPath(import.meta.url), '../../..');

function readSrc(rel: string): string {
  return readFileSync(resolve(root, 'src', rel), 'utf8');
}

describe('workspace delete confirm path', () => {
  it('names node type and soft-delete impact', () => {
    const doc = confirmDeleteNodeMessage('验收文档', 'doc');
    assert.match(doc, /文档/);
    assert.match(doc, /验收文档/);
    assert.match(doc, /软删|不可撤销/);

    const folder = confirmDeleteNodeMessage('资料夹', 'folder');
    assert.match(folder, /文件夹/);
    assert.match(folder, /资料夹/);
  });

  it('workspace page and hook use DeleteConfirmDialog, not window.confirm', () => {
    const page = readSrc('pages/KbWorkspacePage.tsx');
    const hook = readSrc('hooks/useKnowledgeWorkspace.ts');
    const dialog = readSrc('components/workspace/DeleteConfirmDialog.tsx');

    assert.match(page, /DeleteConfirmDialog/);
    assert.match(page, /deleteTarget/);
    assert.match(page, /confirmDelete/);
    assert.equal(page.includes('window.confirm'), false);

    assert.match(hook, /setDeleteTarget/);
    assert.match(hook, /confirmDelete/);
    assert.equal(hook.includes('window.confirm'), false);

    assert.match(dialog, /alertdialog|role="alertdialog"/);
    assert.match(dialog, /onConfirm/);
    assert.match(dialog, /onCancel/);
  });

  it('knowledge list page uses DeleteConfirmDialog, not window.confirm', () => {
    const list = readSrc('pages/KbListPage.tsx');
    assert.match(list, /DeleteConfirmDialog/);
    assert.match(list, /deleteTarget|setDeleteTarget/);
    assert.match(list, /confirmDeleteKb/);
    assert.equal(list.includes('window.confirm'), false);
  });

  it('models request → dialog → confirm flow without auto-delete', () => {
    // Mirrors useKnowledgeWorkspace: select target first; API only on confirm.
    type State = { deleteTarget: { id: string; title: string } | null };
    let state: State = { deleteTarget: null };
    let removed: string | null = null;

    function requestDelete(node: { id: string; title: string }) {
      state = { deleteTarget: node };
    }
    function cancelDelete() {
      state = { deleteTarget: null };
    }
    function confirmDelete() {
      if (!state.deleteTarget) return;
      removed = state.deleteTarget.id;
      state = { deleteTarget: null };
    }

    requestDelete({ id: 'n1', title: 'T' });
    assert.equal(state.deleteTarget?.id, 'n1');
    assert.equal(removed, null); // not deleted until confirm

    cancelDelete();
    assert.equal(state.deleteTarget, null);
    assert.equal(removed, null);

    requestDelete({ id: 'n1', title: 'T' });
    confirmDelete();
    assert.equal(removed, 'n1');
    assert.equal(state.deleteTarget, null);
  });
});
