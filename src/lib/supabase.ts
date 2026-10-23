import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anonKey);
if (!isConfigured) {
  console.warn("[Lucana] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tanımlı değil (.env).");
}

export const TOKEN_KEY = "lucana.staff_token";

export const sessionToken = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* gizli sekme vb. */
    }
  },
};

// Özel auth: her isteğe personel token'ı "x-session-token" header'ı olarak eklenir.
// Sunucudaki RPC'ler bu header'ı okuyup oturumu ve yetki seviyesini doğrular.
const customFetch: typeof fetch = (input, init = {}) => {
  const token = sessionToken.get();
  const headers = new Headers(init.headers);
  if (token) headers.set("x-session-token", token);
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
