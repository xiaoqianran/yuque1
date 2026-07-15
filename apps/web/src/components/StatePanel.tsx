import type { ReactNode } from 'react';
import type { ViewPhase } from '../ui/viewState';
import { statePanelClass } from '../ui/viewState';

type Props = {
  phase: ViewPhase;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function StatePanel({ phase, title, description, action }: Props) {
  if (phase === 'ready') return null;
  return (
    <div className={statePanelClass(phase)} role="status" aria-live="polite">
      <div className="state-panel__icon" aria-hidden>
        {phase === 'loading' ? '⏳' : phase === 'error' ? '!' : '∅'}
      </div>
      <div className="state-panel__body">
        <p className="state-panel__title">{title}</p>
        {description ? <p className="state-panel__desc">{description}</p> : null}
        {action ? <div className="state-panel__action">{action}</div> : null}
      </div>
    </div>
  );
}
