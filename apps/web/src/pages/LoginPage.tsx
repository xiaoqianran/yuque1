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
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  async function onSend() {
    setBusy(true);
    setMsg(null);
    try {
      await sendSms(mobile.trim());
      setMsg('验证码已发送（mock 默认 123456，见服务端日志）');
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : '发送失败');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await login(mobile.trim(), code.trim(), nickname.trim() || undefined);
      navigate(from, { replace: true });
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : '登录失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card login-card">
      <h1>登录 yuque1</h1>
      <p className="muted">短信验证码登录（本地 mock：验证码 123456）</p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          手机号 E.164
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+8613800138000"
            autoComplete="tel"
            required
          />
        </label>
        <label>
          验证码
          <div className="row">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              required
            />
            <button type="button" className="btn secondary" disabled={busy} onClick={onSend}>
              发送
            </button>
          </div>
        </label>
        <label>
          昵称（新用户可选）
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="可选"
            maxLength={64}
          />
        </label>
        {msg && <p className="form-msg">{msg}</p>}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? '处理中…' : '登录'}
        </button>
      </form>
    </section>
  );
}
