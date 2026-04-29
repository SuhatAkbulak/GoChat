import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { setAuthTokens } from '../lib/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = useMemo(() => email.trim() && password.trim(), [email, password]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.authLogin({ email: email.trim(), password: password.trim() });
      setAuthTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      navigate('/dashboard', { replace: true });
    } catch (e2) {
      // API error format: `HTTP 401 - {json}`
      const raw = e2?.message || '';
      let uiMessage = 'Giris basarisiz. Bilgileri kontrol et.';
      if (raw.startsWith('HTTP ')) {
        const parts = raw.split(' - ');
        const statusPart = parts[0] || '';
        const jsonPart = parts.slice(1).join(' - ');
        const code = statusPart.split(' ')[1];
        try {
          const parsed = JSON.parse(jsonPart);
          if (parsed?.message) {
            uiMessage = parsed.message;
          } else if (parsed?.error) {
            uiMessage = parsed.error;
          }
          if (code === '401' && parsed?.message === 'Invalid credentials') {
            uiMessage = 'E-posta veya sifre hatali.';
          }
        } catch {
          // ignore parse error, fallback to generic
        }
      }
      setError({
        title: 'Giris yapilamadi',
        detail: uiMessage,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow"
        >
          <div className="mb-5">
            <h1 className="text-xl font-semibold">GoChat Giris</h1>
            <p className="mt-1 text-sm text-slate-400">GoChat paneline erisim icin giris yap.</p>
          </div>

          {error ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-4 flex items-start gap-3 rounded-xl border border-rose-700/60 bg-gradient-to-r from-rose-900/60 to-rose-900/30 p-3 text-sm text-rose-50"
            >
              <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-rose-600 text-center text-[11px] font-bold">
                !
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wide text-rose-100">
                  {error.title}
                </div>
                <div className="mt-0.5 text-[13px] text-rose-100/90">{error.detail}</div>
              </div>
            </motion.div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">E-posta</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none"
                placeholder="mail@ornek.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Sifre</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none"
                placeholder="••••••••"
                type="password"
                autoComplete="current-password"
              />
            </div>

            <button
              disabled={!canSubmit || loading}
              className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium disabled:opacity-60"
            >
              {loading ? 'Giris yapiliyor...' : 'Giris yap'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

