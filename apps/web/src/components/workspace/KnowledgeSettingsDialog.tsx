import { useEffect, useState } from 'react';
import type { PublicKb } from '../../api/types';
import {
  normalizeKbDescription,
  normalizeKbName,
} from '../../ui/treeOps';

type Props = {
  open: boolean;
  kb: PublicKb;
  canEdit: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (input: { name: string; description: string | null }) => Promise<void>;
};

export function KnowledgeSettingsDialog({
  open,
  kb,
  canEdit,
  saving,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(kb.name);
  const [desc, setDesc] = useState(kb.description ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(kb.name);
      setDesc(kb.description ?? '');
      setError(null);
    }
  }, [open, kb.name, kb.description]);

  if (!open) return null;

  async function handleSave() {
    const nameParsed = normalizeKbName(name);
    if (!nameParsed.ok) {
      setError(nameParsed.message);
      return;
    }
    const descParsed = normalizeKbDescription(desc);
    if (!descParsed.ok) {
      setError(descParsed.message);
      return;
    }
    setError(null);
    await onSave({
      name: nameParsed.name,
      description: descParsed.description,
    });
  }

  return (
    <div
      className="ws-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ws-dialog" role="dialog" aria-modal="true" aria-labelledby="ws-kb-settings-title">
        <div className="ws-dialog-head">
          <h2 id="ws-kb-settings-title">知识库设置</h2>
          <button type="button" className="ws-icon-btn" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ws-dialog-body">
          {error && (
            <p className="form-msg form-msg--error" role="alert">
              {error}
            </p>
          )}
          <div className="ws-field">
            <label htmlFor="ws-kb-name">名称</label>
            <input
              id="ws-kb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={128}
              disabled={!canEdit}
            />
          </div>
          <div className="ws-field">
            <label htmlFor="ws-kb-desc">简介</label>
            <textarea
              id="ws-kb-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={2000}
              rows={4}
              disabled={!canEdit}
              placeholder="可选"
            />
          </div>
          {!canEdit && (
            <p className="hint">只读成员无法修改知识库信息</p>
          )}
        </div>
        <div className="ws-dialog-foot">
          <button type="button" className="ws-btn" onClick={onClose}>
            关闭
          </button>
          {canEdit && (
            <button
              type="button"
              className="ws-btn ws-btn--primary"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
