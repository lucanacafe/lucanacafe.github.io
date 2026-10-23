#!/usr/bin/env node
// Supabase yönetim betiği (Management API üzerinden, CLI/psql gerekmez)
//
//   node scripts/db.mjs migrate            → supabase/migrations/*.sql dosyalarını sırayla uygular
//   node scripts/db.mjs migrate 0003       → adı "0003" ile başlayanları uygular (+ grants)
//   node scripts/db.mjs expose             → "lucana" şemasını REST API'ye açar
//   node scripts/db.mjs bucket             → görsel depolama bucket'ını oluşturur
//   node scripts/db.mjs bootstrap          → kurucu hesabı yoksa rastgele şifreyle oluşturur
//   node scripts/db.mjs sql "select 1"     → tek seferlik sorgu
//
// Gerekli .env: SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const p = join(root, ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!REF || !TOKEN) {
  console.error("SUPABASE_PROJECT_REF ve SUPABASE_ACCESS_TOKEN .env içinde olmalı");
  process.exit(1);
}
const API = `https://api.supabase.com/v1/projects/${REF}`;
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function sql(query) {
  const res = await fetch(`${API}/database/query`, { method: "POST", headers, body: JSON.stringify({ query }) });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL hatası (${res.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

async function migrate(prefix) {
  const dir = join(root, "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const selected = prefix ? files.filter((f) => f.startsWith(prefix)) : files;
  for (const f of selected) {
    process.stdout.write(`→ ${f} ... `);
    await sql(readFileSync(join(dir, f), "utf8"));
    console.log("ok");
  }
  // Yeni fonksiyonların yetkileri için grants her zaman en sonda tekrar çalışır
  const grants = files.find((f) => f.includes("grants"));
  if (prefix && grants && !selected.includes(grants)) {
    process.stdout.write(`→ ${grants} ... `);
    await sql(readFileSync(join(dir, grants), "utf8"));
    console.log("ok");
  }
}

async function expose() {
  const cur = await (await fetch(`${API}/postgrest`, { headers })).json();
  const schemas = new Set(String(cur.db_schema).split(",").map((s) => s.trim()).filter(Boolean));
  if (schemas.has("lucana")) return console.log("lucana zaten açık:", cur.db_schema);
  schemas.add("lucana");
  const res = await fetch(`${API}/postgrest`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ db_schema: [...schemas].join(",") }),
  });
  console.log(res.status, await res.text());
}

async function bucket() {
  const res = await fetch(`${API}/storage/buckets`, { headers });
  const list = await res.json();
  if (list.some((b) => b.id === "lucana")) return console.log("bucket zaten var");
  await sql(`insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
             values ('lucana', 'lucana', true, 5242880, array['image/webp','image/jpeg','image/png','image/avif'])
             on conflict (id) do nothing`);
  console.log("bucket oluşturuldu");
}

async function bootstrap() {
  const rows = await sql(`select count(*)::int n from lucana.staff s join lucana.roles r on r.id = s.role_id where r.key = 'founder'`);
  if (rows[0].n > 0) return console.log("Kurucu hesabı zaten var.");
  const password = randomBytes(9).toString("base64url");
  await sql(`insert into lucana.staff(username, password_hash, full_name, role_id, must_change_pw)
             select 'kurucu', extensions.crypt('${password}', extensions.gen_salt('bf', 10)), 'Lucana Kurucu',
                    (select id from lucana.roles where key = 'founder'), true`);
  const out = join(root, "ADMIN_GIRIS.local.txt");
  writeFileSync(
    out,
    `Lucana yönetim paneli ilk giriş\n\nKullanıcı adı: kurucu\nGeçici şifre : ${password}\n\nİlk girişte şifre değiştirmeniz istenecek. Bu dosyayı sonra silin.\n`,
  );
  console.log(`Kurucu oluşturuldu. Bilgiler: ${out}`);
}

const [cmd, arg] = process.argv.slice(2);
const run = { migrate: () => migrate(arg), expose, bucket, bootstrap, sql: async () => console.log(JSON.stringify(await sql(arg), null, 2)) }[cmd];
if (!run) {
  console.log("Komutlar: migrate [önek] | expose | bucket | bootstrap | sql \"...\"");
  process.exit(1);
}
run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
