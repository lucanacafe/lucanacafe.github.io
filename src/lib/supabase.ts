import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anonKey);
if (!isConfigured) {
  console.warn("[Lucana] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil (.env).");
}

export const TOKEN_KEY = "lucana.staff_token";
export const MEMBER_KEY = "lucana.member_token";

function tokenStore(key: string) {
  return {
    get: () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (t: string | null) => {
      try {
        if (t) localStorage.setItem(key, t);
        else localStorage.removeItem(key);
      } catch {
        /* gizli sekme vb. */
      }
    },
  };
}

/** Personel oturumu (panel) */
export const sessionToken = tokenStore(TOKEN_KEY);
/** Müşteri üyelik oturumu (QR ile otomatik açılan hesap) */
export const memberToken = tokenStore(MEMBER_KEY);

// Özel auth: personel token'ı "x-session-token", üye token'ı "x-member-token"
// header'ı ile gider. Sunucudaki RPC'ler bunları okuyup oturumu ve yetkiyi doğrular.
const customFetch: typeof fetch = (input, init = {}) => {
  const headers = new Headers(init.headers);
  const staff = sessionToken.get();
  const member = memberToken.get();
  if (staff) headers.set("x-session-token", staff);
  if (member) headers.set("x-member-token", member);
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(url || "http://localhost", anonKey || "anon", {
  db: { schema: "lucana" },
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: customFetch },
  realtime: { params: { eventsPerSecond: 5 } },
});

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/** Tipli RPC çağrısı. Sunucu hatalarını okunur Türkçe mesaja çevirir. */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.message === "MEMBER_REQUIRED") {
      memberToken.set(null);
      window.dispatchEvent(new CustomEvent("lucana:member", { detail: "expired" }));
      throw new ApiError("Üyelik oturumun bulunamadı, lütfen tekrar başla.", error.message);
    }
    if (error.message === "AUTH_REQUIRED" || error.message === "PASSWORD_CHANGE_REQUIRED") {
      window.dispatchEvent(new CustomEvent("lucana:auth", { detail: error.message }));
      throw new ApiError(
        error.message === "AUTH_REQUIRED" ? "Oturumunuz sona erdi, tekrar giriş yapın." : "Önce şifrenizi değiştirin.",
        error.message,
      );
    }
    if (error.message?.includes("Failed to fetch")) {
      throw new ApiError("Bağlantı kurulamadı. İnternetinizi kontrol edin.");
    }
    throw new ApiError(error.message || "Beklenmeyen bir hata oluştu", error.code);
  }
  if (data && typeof data === "object" && "error" in (data as object)) {
    throw new ApiError(String((data as { error: unknown }).error));
  }
  return data as T;
}
