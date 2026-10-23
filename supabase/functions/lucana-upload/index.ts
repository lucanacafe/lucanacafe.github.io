// Lucana — panelden görsel yükleme
// İstek gövdesi: ham görsel (image/webp vb.), header: x-session-token
// Yetki: lucana.staff_can_upload() RPC'si personel token'ı ile çağrılır (seviye ≥ 80).
// Yükleme service role ile yapılır; service key asla istemciye gitmez.
//
// Deploy: npx supabase functions deploy lucana-upload --no-verify-jwt --use-api --project-ref <ref>

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "lucana";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/webp", "image/jpeg", "image/png", "image/avif"]);
const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/avif": "avif" };
const FOLDERS = new Set(["menu", "category", "site"]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-session-token, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Yöntem desteklenmiyor" }, 405);

  const token = req.headers.get("x-session-token") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "Oturum gerekli" }, 401);

  // 1) Yetki kontrolü — veritabanındaki oturum + seviye
  const auth = await fetch(`${SUPABASE_URL}/rest/v1/rpc/staff_can_upload`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
      "Content-Profile": "lucana",
      "Accept-Profile": "lucana",
      "x-session-token": token,
    },
    body: "{}",
  });
  if (!auth.ok) {
    const err = await auth.json().catch(() => ({}));
    return json({ error: err.message === "AUTH_REQUIRED" ? "Oturum geçersiz" : "Görsel yükleme yetkiniz yok" }, 403);
  }

  // 2) Dosya doğrulama
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!ALLOWED.has(type)) return json({ error: "Yalnızca WebP/JPEG/PNG/AVIF görseller" }, 415);
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength === 0) return json({ error: "Boş dosya" }, 400);
  if (body.byteLength > MAX_BYTES) return json({ error: "Görsel 5 MB'den büyük olamaz" }, 413);

  const folder = new URL(req.url).searchParams.get("folder") ?? "menu";
  const path = `${FOLDERS.has(folder) ? folder : "menu"}/${crypto.randomUUID()}.${EXT[type]}`;

  // 3) Storage'a yükle (service role)
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE}`,
      apikey: SERVICE,
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "false",
    },
    body,
  });
  if (!up.ok) return json({ error: "Depolama hatası: " + (await up.text()) }, 500);

  return json({ url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`, path });
});
