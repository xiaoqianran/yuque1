import type { OutlineItem } from '../../ui/markdown';

type Props = {
  items: OutlineItem[];
  open: boolean;
  drawer?: boolean;
  onJump: (item: OutlineItem) => void;
  onClose?: () => void;
};

export function OutlinePanel({ items, open, drawer, onJump, onClose }: Props) {
  if (!open || items.length === 0) return null;
  return (
    <aside
      className={`ws-outline${drawer ? ' ws-outline--drawer' : ''}`}
      aria-label="文档大纲"
    >
      <div className="ws-outline-head">
        <strong>大纲</strong>
        <span className="muted">{items.length} 个标题</span>
        {drawer && onClose && (
          <button type="button" className="ws-icon-btn" aria-label="关闭大纲" onClick={onClose}>
            ×
          </button>
        )}
      </div>
      <ul className="ws-outline-list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`ws-outline-item level-${item.level}`}
              onClick={() => onJump(item)}
              title={`第 ${item.line + 1} 行`}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
