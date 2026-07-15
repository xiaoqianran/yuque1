import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicShareUrl,
  confirmDeleteKbMessage,
  confirmDeleteNodeMessage,
  confirmEmptyTrashMessage,
  confirmPurgeNodeMessage,
} from './urls';

describe('buildPublicShareUrl', () => {
  it('builds absolute URL with root base', () => {
    const u = buildPublicShareUrl('abcTOKEN', {
      origin: 'https://code-sg.example.com',
      baseUrl: '/',
    });
    assert.equal(u, 'https://code-sg.example.com/s/abcTOKEN');
  });

  it('includes vite/code-server base path', () => {
    const u = buildPublicShareUrl('tok123', {
      origin: 'https://code-sg.example.com',
      baseUrl: '/proxy/5173/',
    });
    assert.equal(u, 'https://code-sg.example.com/proxy/5173/s/tok123');
  });

  it('encodes token safely', () => {
    const u = buildPublicShareUrl('a+b/c', {
      origin: 'http://localhost:5173',
      baseUrl: '/',
    });
    assert.equal(u, 'http://localhost:5173/s/a%2Bb%2Fc');
  });

  it('returns empty for blank token', () => {
    assert.equal(buildPublicShareUrl('  ', { origin: 'http://x', baseUrl: '/' }), '');
  });
});

describe('confirm delete messages', () => {
  it('mentions node title and soft-delete', () => {
    const m = confirmDeleteNodeMessage('规范', 'doc');
    assert.match(m, /规范/);
    assert.match(m, /文档/);
    assert.match(m, /回收站|软删/);
  });

  it('purge message warns irreversible', () => {
    const m = confirmPurgeNodeMessage('废稿', 'doc');
    assert.match(m, /废稿/);
    assert.match(m, /永久/);
    assert.match(m, /不可恢复/);
  });

  it('empty trash message includes count', () => {
    const m = confirmEmptyTrashMessage(3);
    assert.match(m, /3/);
    assert.match(m, /清空回收站/);
    assert.match(m, /不可恢复/);
  });

  it('mentions kb name', () => {
    const m = confirmDeleteKbMessage('工程');
    assert.match(m, /工程/);
    assert.match(m, /知识库/);
  });
});
