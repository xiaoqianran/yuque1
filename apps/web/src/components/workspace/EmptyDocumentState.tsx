type Props = {
  canWrite: boolean;
  onCreateDoc: () => void;
};

export function EmptyDocumentState({ canWrite, onCreateDoc }: Props) {
  return (
    <div className="ws-empty" role="status">
      <h2>暂无文档</h2>
      <p>创建第一篇文档，开始整理知识。</p>
      {canWrite && (
        <button type="button" className="ws-btn ws-btn--primary" onClick={onCreateDoc}>
          新建文档
        </button>
      )}
    </div>
  );
}
