// Lucana — Web Push gönderici
// Yalnızca veritabanı (pg_net, lucana._push) çağırır; x-push-secret header'ı ile doğrulanır.
// Gövde: { subs: [{id, endpoint, p256dh, auth}], notification: {title, body, url, tag} }
// Ölmüş abonelikler (404/410) veritabanından silinir.
//
// Secrets: LUCANA_VAPID_PUBLIC_KEY, LUCANA_VAPID_PRIVATE_KEY, LUCANA_VAPID_SUBJECT, LUCANA_PUSH_SECRET
// Deploy: npx supabase functions deploy lucana-push --no-verify-jwt --use-api --project-ref <ref>

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("LUCANA_PUSH_SECRET") ?? "";
const PUB = Deno.env.get("LUCANA_VAPID_PUBLIC_KEY") ?? "";
const PRIV = Deno.env.get("LUCANA_VAPID_PRIVATE_KEY") ?? "";
const SUBJECT = Deno.env.get("LUCANA_VAPID_SUBJECT") ?? "mailto:admin@example.com";

interface Sub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// deno-lint-ignore no-explicit-any
let webpush: any = null;
async function getWebPush() {
  if (!webpush) {
    const m = await import("npm:web-push@3.6.7");
    // deno-lint-ignore no-explicit-any
    webpush = (m as any).default ?? m;
    webpush.setVapidDetails(SUBJECT, PUB, PRIV);
  }
  return webpush;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "GET") return json({ ok: true, configured: Boolean(PUB && PRIV && SECRET) });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!SECRET || !safeEqual(req.headers.get("x-push-secret") ?? "", SECRET)) return json({ error: "forbidden" }, 403);

  const { subs, notification } = (await req.json()) as { subs: Sub[]; notification: Record<string, string> };
  if (!Array.isArray(subs) || !subs.length) return json({ sent: 0 });

  const wp = await getWebPush();
  const payload = JSON.stringify(notification);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.slice(0, 500).map(async (s) => {
      try {
        await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 30,
          urgency: "high",
        });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
        else console.error("push hata", code, (e as Error).message);
      }
    }),
  );

  if (dead.length) {
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=in.(${dead.join(",")})`, {
      method: "DELETE",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Profile": "lucana", "Accept-Profile": "lucana" },
    });
  }
  return json({ sent, removed: dead.length });
});
