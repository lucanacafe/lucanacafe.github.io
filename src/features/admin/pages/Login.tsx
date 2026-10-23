import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui";
import { Logo, Smoke } from "@/components/ui/brand";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <img src={import.meta.env.BASE_URL + "images/nargile-pirinc.webp"} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-night-950/70 via-night-950/90 to-night-950" />
      <Smoke />
      <form
        className="glass relative w-full max-w-sm rounded-3xl p-8 shadow-2xl"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          setBusy(true);
          try {
            await login(u.trim().toLowerCase(), p);
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="text-center">
          <Logo className="text-6xl" />
          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-smoke-400">
            <Lock className="h-3.5 w-3.5" /> Personel girişi
          </p>
        </div>
        <div className="mt-8 space-y-4">
          <label className="block">
            <span className="label">Kullanıcı adı</span>
            <input className="input" autoComplete="username" autoCapitalize="none" value={u} onChange={(e) => setU(e.target.value)} required />
          </label>
          <label className="block">
            <span className="label">Şifre</span>
            <div className="relative">
              <input
                className="input pr-11"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={p}
                onChange={(e) => setP(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-smoke-400" aria-label="Şifreyi göster">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          {err && <p className="rounded-xl bg-wine-600/15 px-3 py-2 text-sm text-wine-400">{err}</p>}
          <Button type="submit" className="w-full" size="lg" loading={busy}>
            Giriş yap
          </Button>
        </div>
        <Link to="/" className="mt-6 block text-center text-xs text-smoke-500 hover:text-smoke-300">
          ← Siteye dön
        </Link>
      </form>
    </div>
  );
}
