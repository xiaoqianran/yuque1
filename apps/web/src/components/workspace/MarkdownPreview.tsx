import { forwardRef } from 'react';
import { MarkdownView } from '../../ui/markdown';

type Props = {
  source: string;
  emptyLabel?: string;
  className?: string;
};

export const MarkdownPreview = forwardRef<HTMLDivElement, Props>(
  function MarkdownPreview(
    { source, emptyLabel = '（空文档 — 切换到编辑开始写）', className },
    ref,
  ) {
    return (
      <div ref={ref} className="ws-preview-wrap">
        <MarkdownView
          source={source}
          className={className ?? 'ws-preview md-preview'}
          emptyLabel={emptyLabel}
        />
      </div>
    );
  },
);
