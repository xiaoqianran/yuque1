import { Plus, Search, X } from 'lucide-react';
import type { PublicKb, PublicNode } from '../../api/types';
import { DocumentTree } from './DocumentTree';
import { KnowledgeHeader, type KbMenuAction } from './KnowledgeHeader';

type Props = {
  kb: PublicKb;
  nodes: PublicNode[];
  selectedId: string | null;
  collapsedIds: ReadonlySet<string>;
  canWrite: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  searchQ: string;
  onSearchQChange: (v: string) => void;
  onSearch: () => void;
  searching?: boolean;
  searchHits: PublicNode[] | null;
  onClearSearch: () => void;
  onSelect: (n: PublicNode) => void;
  onToggleCollapse: (id: string) => void;
  onCreate: (type: 'folder' | 'doc') => void;
  onCreateUnder: (type: 'folder' | 'doc', contextNode: PublicNode) => void;
  onRename: (node: PublicNode, title: string) => void;
  onMoveRequest: (node: PublicNode) => void;
  onReorder: (node: PublicNode, direction: 'up' | 'down') => void;
  onDeleteRequest: (node: PublicNode) => void;
  onDuplicateRequest?: (node: PublicNode) => void;
  onDragMove?: (plan: {
    nodeId: string;
    parentId: string | null;
    sortOrder: number;
  }) => void;
  onKbMenu: (action: KbMenuAction) => void;
  renameNodeId?: string | null;
  onRenameNodeIdChange?: (id: string | null) => void;
};

export function KnowledgeSidebar({
  kb,
  nodes,
  selectedId,
  collapsedIds,
  canWrite,
  mobileOpen,
  onMobileClose,
  searchQ,
  onSearchQChange,
  onSearch,
  searching: _searching,
  searchHits,
  onClearSearch,
  onSelect,
  onToggleCollapse,
  onCreate,
  onCreateUnder,
  onRename,
  onMoveRequest,
  onReorder,
  onDeleteRequest,
  onDuplicateRequest,
  onDragMove,
  onKbMenu,
  renameNodeId,
  onRenameNodeIdChange,
}: Props) {
  return (
    <aside
      className={`ws-sidebar${mobileOpen ? ' ws-sidebar--open' : ''}`}
      aria-label="知识库导航"
      id="ws-knowledge-sidebar"
    >
      {onMobileClose && (
        <div className="ws-sidebar-mobile-bar">
          <span className="ws-sidebar-mobile-title">文档目录</span>
          <button
            type="button"
            className="ws-icon-btn"
            aria-label="关闭文档目录"
            title="关闭"
            onClick={onMobileClose}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <KnowledgeHeader kb={kb} onAction={onKbMenu} />

      <div className="ws-sidebar-tools">
        <div className="ws-search">
          <Search size={14} aria-hidden />
          <input
            value={searchQ}
            onChange={(e) => onSearchQChange(e.target.value)}
            placeholder="搜索文档…"
            aria-label="搜索节点标题"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSearch();
              }
            }}
          />
          {(searchQ || searchHits) && (
            <button
              type="button"
              className="ws-icon-btn"
              aria-label="清除搜索"
              onClick={onClearSearch}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {searchHits && (
          <div className="ws-search-hits" role="listbox" aria-label="搜索结果">
            {searchHits.length === 0 ? (
              <p className="hint">无匹配节点</p>
            ) : (
              searchHits.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="ws-search-hit"
                  role="option"
                  onClick={() => onSelect(n)}
                >
                  {n.title}
                </button>
              ))
            )}
          </div>
        )}

        {canWrite && (
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className="ws-create-btn"
              onClick={() => onCreate('doc')}
              title="新建文档"
            >
              <Plus size={16} />
              新建文档
            </button>
            <button
              type="button"
              className="ws-btn"
              style={{ flexShrink: 0 }}
              onClick={() => onCreate('folder')}
              title="新建文件夹"
              aria-label="新建文件夹"
            >
              文件夹
            </button>
          </div>
        )}
      </div>

      <div className="ws-tree-scroll">
        {nodes.length === 0 ? (
          <p className="hint" style={{ padding: '8px 4px' }}>
            文档树为空
          </p>
        ) : (
          <DocumentTree
            nodes={nodes}
            selectedId={selectedId}
            collapsedIds={collapsedIds}
            canWrite={canWrite}
            onSelect={onSelect}
            onToggleCollapse={onToggleCollapse}
            onCreateUnder={onCreateUnder}
            onRename={onRename}
            onMoveRequest={onMoveRequest}
            onReorder={onReorder}
            onDeleteRequest={onDeleteRequest}
            onDuplicateRequest={onDuplicateRequest}
            onDragMove={onDragMove}
            renameNodeId={renameNodeId}
            onRenameNodeIdChange={onRenameNodeIdChange}
          />
        )}
      </div>
    </aside>
  );
}
