import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { memberApi, type Member } from "@/lib/api/member";
import { memberToken } from "@/lib/supabase";
import { Onboarding } from "./Onboarding";

/**
 * Müşteri üyeliği. QR okutulunca (ya da oyun/profil gibi üyelik isteyen
 * bir sayfaya girilince) tek dokunuşluk onay ekranı açılır ve hesap
 * otomatik oluşturulur. Token cihazda saklanır; geçerli token varken
 * sunucu ikinci hesap açmaz.
 */
interface Ctx {
  member: Member | null;
  /** İlk kontrol bitti mi */
  ready: boolean;
  refresh: () => Promise<Member | null>;
  setMember: (m: Member | null) => void;
  /** Üye yoksa onay ekranını açar; üye olunca resolve olur */
  ensure: () => Promise<Member>;
  logout: () => Promise<void>;
}

const MemberCtx = createContext<Ctx | null>(null);

export function MemberProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [ready, setReady] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const waiters = useRef<((m: Member) => void)[]>([]);

  const refresh = useCallback(async () => {
    if (!memberToken.get()) {
      setMember(null);
      return null;
    }
    try {
      const m = await memberApi.me();
      if (!m) memberToken.set(null);
      setMember(m);
      return m;
    } catch {
      return null; // ağ hatası: oturumu silme
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setReady(true));
    const onExpire = () => setMember(null);
    window.addEventListener("lucana:member", onExpire);
    return () => window.removeEventListener("lucana:member", onExpire);
  }, [refresh]);

  const ensure = useCallback(() => {
    if (member) return Promise.resolve(member);
    setOnboarding(true);
    return new Promise<Member>((resolve) => waiters.current.push(resolve));
  }, [member]);

  const done = (m: Member) => {
    setMember(m);
    setOnboarding(false);
    waiters.current.splice(0).forEach((w) => w(m));
  };

  return (
    <MemberCtx.Provider
      value={{
        member,
        ready,
        refresh,
        setMember,
        ensure,
        async logout() {
          await memberApi.logout();
          setMember(null);
        },
      }}
    >
      {children}
      {onboarding && <Onboarding onDone={done} onClose={() => setOnboarding(false)} />}
    </MemberCtx.Provider>
  );
}

export function useMember() {
  const c = useContext(MemberCtx);
  if (!c) throw new Error("MemberProvider eksik");
  return c;
}

/** Sayfa açıldığında üyelik iste (QR masa, oyunlar, profil) */
export function useRequireMember() {
  const { member, ready, ensure } = useMember();
  useEffect(() => {
    if (ready && !member) ensure().catch(() => {});
  }, [ready, member, ensure]);
  return member;
}
