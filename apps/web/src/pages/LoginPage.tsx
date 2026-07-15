import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/types';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { user, loading, login, sendSms } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [mobile, setMobile] = useState('+8613800138000');
  const [code, setCode] = useState('123456');
  const [nickname, setNickname] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<'ok' | 'error' | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="auth-gate">
        <div className="state-panel state-panel--loading" role="status">
          <div className="state-panel__icon" aria-hidden>
            …
          </div>
          <div className="state-panel__body">
            <p className="state-panel__title">正在恢复会话</p>
            <p className="state-panel__desc">请稍候</p>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function onSend() {
    setBusy(true);
    setMsg(null);
    setMsgKind(null);
    try {
      await sendSms(mobile.trim());
      setMsg('验证码已发送（本地 mock 默认 123456）');
      setMsgKind('ok');
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : '发送失败');
      setMsgKind('error');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setMsgKind(null);
    try {
      await login(mobile.trim(), code.trim(), nickname.trim() || undefined);
      navigate(from, { replace: true });
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : '登录失败');
      setMsgKind('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card login-card" aria-labelledby="login-title">
      <h1 id="login-title">登录 yuque1</h1>
      <p className="muted">短信验证码登录。本地开发可用 mock 验证码完成联调。</p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          手机号（E.164）
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+8613800138000"
            autoComplete="tel"
            inputMode="tel"
            required
          />
        </label>
        <label>
          验证码
          <div className="row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6 位数字"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              style={{ flex: 1 }}
            />
            <button type="button" className="btn secondary" disabled={busy} onClick={onSend}>
              发送验证码
            </button>
          </div>
        </label>
        <label>
          昵称（仅新用户可选）
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="显示名称"
            maxLength={64}
            autoComplete="nickname"
          />
        </label>
        {msg && (
          <p className={msgKind === 'ok' ? 'form-msg form-msg--ok' : 'form-msg form-msg--error'} role="alert">
            {msg}
          </p>
        )}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? '处理中…' : '登录'}
        </button>
      </form>
    </section>
  );
}
