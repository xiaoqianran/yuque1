import { BookOpen, MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PublicKb } from '../../api/types';

export type KbMenuAction =
  | 'settings'
  | 'members'
  | 'expand-all'
  | 'collapse-all'
  | 'trash'
  | 'back';

type Props = {
  kb: PublicKb;
  onAction: (action: KbMenuAction) => void;
};

export function KnowledgeHeader({ kb, onAction }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClick() {
      setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [open]);

  return (
    <div className="ws-kb-head">
      <div className="ws-kb-icon" aria-hidden>
        <BookOpen size={18} />
      </div>
      <div className="ws-kb-meta">
        <h1 className="ws-kb-name" title={kb.name}>
          {kb.name}
        </h1>
        <p className="ws-kb-sub">私有知识库</p>
      </div>
      <button
        ref={btnRef}
        type="button"
        className="ws-icon-btn"
        aria-label="知识库更多操作"
        title="更多"
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({ x: rect.right - 180, y: rect.bottom + 4 });
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div
          className="ws-menu"
          style={{ left: pos.x, top: pos.y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAction('settings');
            }}
          >
            知识库设置
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAction('members');
            }}
          >
            成员管理
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAction('trash');
            }}
          >
            回收站
          </button>
          <div className="ws-menu-sep" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAction('expand-all');
            }}
          >
            全部展开
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAction('collapse-all');
            }}
          >
            全部折叠
          </button>
          <div className="ws-menu-sep" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAction('back');
            }}
          >
            返回知识库列表
          </button>
        </div>
      )}
    </div>
  );
}
