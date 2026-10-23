import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { auth } from "@/lib/api/admin";
import { sessionToken } from "@/lib/supabase";
import { unsubscribe as pushUnsubscribe } from "@/lib/push";
import type { StaffUser } from "@/types";

interface AuthCtx {
  user: StaffUser | null;
  ready: boolean;
  login: (u: string, p: string) => Promise<StaffUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (level: number) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionToken.get()) {
      setUser(null);
      return;
    }
    try {
      const me = await auth.me();
      setUser(me);
      if (!me) sessionToken.set(null);
    } catch {
      // ağ hatasında oturumu silme; yalnızca kullanıcıyı boş bırak
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setReady(true));
    // Sunucu "oturum geçersiz" dediğinde (rpc yardımcıdan) çıkış yap
    const onAuth = (e: Event) => {
      const reason = (e as CustomEvent).detail;
      if (reason === "AUTH_REQUIRED") {
        sessionToken.set(null);
        setUser(null);
      } else refresh();
    };
    window.addEventListener("lucana:auth", onAuth);
    return () => window.removeEventListener("lucana:auth", onAuth);
  }, [refresh]);

  const value: AuthCtx = {
    user,
    ready,
    async login(u, p) {
      const me = await auth.login(u, p);
      setUser(me);
      return me;
    },
    async logout() {
      // Bu cihaz artık personel bildirimi almasın (token hâlâ geçerliyken sil)
      await pushUnsubscribe();
      await auth.logout().catch(() => {});
      setUser(null);
    },
    refresh,
    can: (level) => (user?.level ?? 0) >= level,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider eksik");
  return c;
}
