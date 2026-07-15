import type { PublicKb } from '../../api/types';
import { MembersPanel } from '../MembersPanel';

type Props = {
  open: boolean;
  kb: PublicKb;
  onClose: () => void;
  onOwnershipTransferred?: () => void;
};

export function MembersDrawer({
  open,
  kb,
  onClose,
  onOwnershipTransferred,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="ws-overlay ws-overlay--drawer"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="ws-drawer" role="dialog" aria-modal="true" aria-labelledby="ws-members-title">
        <div className="ws-drawer-head">
          <h2 id="ws-members-title">成员管理</h2>
          <button type="button" className="ws-icon-btn" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="ws-drawer-body">
          <MembersPanel kb={kb} onOwnershipTransferred={onOwnershipTransferred} />
        </div>
      </aside>
    </div>
  );
}
