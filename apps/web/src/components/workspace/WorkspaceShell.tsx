type Props = {
  focusMode?: boolean;
  children: React.ReactNode;
};

export function WorkspaceShell({ focusMode, children }: Props) {
  return (
    <div className={`ws-shell${focusMode ? ' ws-shell--focus' : ''}`}>
      {children}
    </div>
  );
}
