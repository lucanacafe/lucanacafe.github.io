-- =============================================================
--  Lucana Cafe & Lounge — 0001 Çekirdek şema
--  Ayrı "lucana" şeması: aynı Supabase projesindeki diğer
--  uygulamalarla (PERPS) hiçbir tablo çakışmaz.
--
--  Güvenlik modeli (BigLoft modelinin sıkılaştırılmış hâli):
--   * Özel personel tablosu + bcrypt (pgcrypto) şifreler
--   * Oturum token'ı istemciye bir kez verilir, DB'de yalnızca
--     SHA-256 hash'i saklanır
--   * İstemci token'ı "x-session-token" header'ı ile gönderir
--   * TÜM tablolar RLS açık + anon/authenticated için hiçbir
--     tablo yetkisi yok → erişim yalnızca SECURITY DEFINER RPC'ler
--   * Her RPC yetki seviyesini kendi içinde kontrol eder
--   * Brute-force kilidi, ilk girişte zorunlu şifre değişimi
-- =============================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists lucana;

-- Yeni fonksiyonlar varsayılan olarak herkese EXECUTE vermesin
alter default privileges in schema lucana revoke execute on functions from public;

-- =============================================================
--  TABLOLAR
-- =============================================================

create table if not exists lucana.roles (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,          -- founder, manager, cashier, waiter, kitchen
  name       text not null,
  level      int  not null,                 -- yüksek = daha çok yetki
  color      text not null default '#d4a24c',
  created_at timestamptz not null default now()
);

create table if not exists lucana.staff (
  id             uuid primary key default gen_random_uuid(),
  username       text not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  password_hash  text not null,
  full_name      text not null,
  role_id        uuid not null references lucana.roles(id),
  is_active      boolean not null default true,
  must_change_pw boolean not null default true,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists lucana.sessions (
  token_hash   text primary key,
  staff_id     uuid not null references lucana.staff(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days',
  user_agent   text
);
create index if not exists sessions_staff_idx on lucana.sessions(staff_id);

create table if not exists lucana.login_attempts (
  id       bigserial primary key,
  username text not null,
  ip       text,
  ok       boolean not null,
  at       timestamptz not null default now()
);
create index if not exists login_attempts_user_idx on lucana.login_attempts(username, at desc);
create index if not exists login_attempts_ip_idx on lucana.login_attempts(ip, at desc);

-- Tek satırlık ayarlar (jsonb → ileride alan eklemek migration gerektirmez)
create table if not exists lucana.settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists lucana.menu_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  icon        text,                         -- lucide ikon adı
  image_url   text,
  sort        int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists lucana.menu_items (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references lucana.menu_categories(id) on delete restrict,
  name        text not null,
  description text,
  price       numeric(10,2) not null check (price >= 0),
  image_url   text,
  tags        text[] not null default '{}',
  is_active   boolean not null default true,
  is_featured boolean not null default false,
  track_stock boolean not null default false,
  stock       int not null default 0,
  low_stock   int not null default 5,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists menu_items_cat_idx on lucana.menu_items(category_id);

-- Ham madde / depo stoğu (menüden bağımsız)
create table if not exists lucana.inventory_items (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text not null default 'Genel',
  unit       text not null default 'adet',
  qty        numeric(12,2) not null default 0,
  critical   numeric(12,2) not null default 0,
  note       text,
  updated_by uuid references lucana.staff(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists lucana.tables (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  area       text not null default 'Salon',
  code       text not null unique,          -- QR içindeki gizli kod
  is_active  boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists lucana.day_counters (
  day date primary key,
  n   int not null default 0
);

create table if not exists lucana.orders (
  id             uuid primary key default gen_random_uuid(),
  no             int not null,                -- iş günü içinde sıra no
  biz_day        date not null,
  table_id       uuid references lucana.tables(id) on delete set null,
  table_label    text,
  device_id      text,
  source         text not null default 'qr' check (source in ('qr','staff')),
  status         text not null default 'new'
                 check (status in ('new','preparing','served','paid','cancelled')),
  note           text,
  total          numeric(12,2) not null default 0,
  payment_method text check (payment_method in ('cash','card','other')),
  cancel_reason  text,
  created_by     uuid references lucana.staff(id) on delete set null,
  handled_by     uuid references lucana.staff(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  paid_at        timestamptz
);
create index if not exists orders_status_idx on lucana.orders(status, created_at desc);
create index if not exists orders_day_idx on lucana.orders(biz_day);
create index if not exists orders_table_idx on lucana.orders(table_id, created_at desc);
create index if not exists orders_device_idx on lucana.orders(device_id, created_at desc);

create table if not exists lucana.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references lucana.orders(id) on delete cascade,
  menu_item_id uuid references lucana.menu_items(id) on delete set null,
  category_id  uuid,
  name         text not null,
  unit_price   numeric(10,2) not null,
  qty          int not null check (qty > 0),
  note         text
);
create index if not exists order_items_order_idx on lucana.order_items(order_id);

create table if not exists lucana.waiter_calls (
  id         uuid primary key default gen_random_uuid(),
  table_id   uuid not null references lucana.tables(id) on delete cascade,
  device_id  text,
  type       text not null check (type in ('waiter','bill','coal','other')),
  note       text,
  status     text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now(),
  done_at    timestamptz,
  done_by    uuid references lucana.staff(id) on delete set null
);
create index if not exists waiter_calls_open_idx on lucana.waiter_calls(status, created_at desc);

create table if not exists lucana.stock_moves (
  id         bigserial primary key,
  kind       text not null check (kind in ('menu','inventory')),
  ref_id     uuid not null,
  ref_name   text,
  delta      numeric(12,2) not null,
  reason     text,
  order_id   uuid,
  staff_id   uuid references lucana.staff(id) on delete set null,
  at         timestamptz not null default now()
);
create index if not exists stock_moves_ref_idx on lucana.stock_moves(ref_id, at desc);
create index if not exists stock_moves_at_idx on lucana.stock_moves(at desc);

create table if not exists lucana.audit_logs (
  id          bigserial primary key,
  staff_id    uuid references lucana.staff(id) on delete set null,
  staff_label text,
  action      text not null,
  entity      text not null,
  summary     text not null,
  at          timestamptz not null default now()
);
create index if not exists audit_at_idx on lucana.audit_logs(at desc);

-- RLS: tümü açık, hiçbir policy yok → doğrudan tablo erişimi tamamen kapalı
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'lucana' loop
    execute format('alter table lucana.%I enable row level security', t);
  end loop;
end $$;

-- =============================================================
--  YARDIMCI FONKSİYONLAR (anon'a AÇIK DEĞİL)
-- =============================================================

-- İş günü: kafe 04:00'e kadar açık → gün 05:00'te döner (İstanbul saati)
create or replace function lucana._biz_day(ts timestamptz default now())
returns date language sql immutable as $$
  select ((ts at time zone 'Europe/Istanbul') - interval '5 hours')::date;
$$;

create or replace function lucana._header(p_name text)
returns text language sql stable as $$
  select nullif(current_setting('request.headers', true)::json->>p_name, '');
$$;

create or replace function lucana._client_ip()
returns text language sql stable as $$
  select coalesce(
    lucana._header('cf-connecting-ip'),
    split_part(coalesce(lucana._header('x-forwarded-for'), ''), ',', 1),
    'unknown');
$$;

create or replace function lucana._hash_token(p_token text)
returns text language sql immutable
set search_path = lucana, extensions as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- Geçerli oturumun personel id'si (header'daki token'dan)
create or replace function lucana._sid()
returns uuid language sql stable security definer
set search_path = lucana, extensions as $$
  select s.staff_id
  from lucana.sessions s
  join lucana.staff u on u.id = s.staff_id
  where s.token_hash = lucana._hash_token(coalesce(lucana._header('x-session-token'), '-'))
    and s.expires_at > now()
    and u.is_active
  limit 1;
$$;

create or replace function lucana._level(p_staff uuid)
returns int language sql stable security definer
set search_path = lucana as $$
  select coalesce((select r.level from lucana.staff u join lucana.roles r on r.id = u.role_id
                   where u.id = p_staff), 0);
$$;

-- Yetki kontrolü: oturum yoksa / seviye yetmiyorsa istisna fırlatır
create or replace function lucana._require(p_min int, p_allow_pw_change boolean default false)
returns uuid language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid; v_must boolean;
begin
  v_id := lucana._sid();
  if v_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000', hint = 'Oturum geçersiz veya süresi doldu';
  end if;
  if not p_allow_pw_change then
    select must_change_pw into v_must from lucana.staff where id = v_id;
    if v_must then
      raise exception 'PASSWORD_CHANGE_REQUIRED' using errcode = '28000';
    end if;
  end if;
  if lucana._level(v_id) < p_min then
    raise exception 'Bu işlem için yetkiniz yok' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

create or replace function lucana._staff_label(p_staff uuid)
returns text language sql stable security definer
set search_path = lucana as $$
  select '[' || r.name || '] ' || u.full_name
  from lucana.staff u join lucana.roles r on r.id = u.role_id where u.id = p_staff;
$$;

create or replace function lucana._audit(p_staff uuid, p_action text, p_entity text, p_summary text)
returns void language sql security definer
set search_path = lucana as $$
  insert into lucana.audit_logs(staff_id, staff_label, action, entity, summary)
  values (p_staff, lucana._staff_label(p_staff), p_action, p_entity, left(p_summary, 500));
$$;

-- Realtime "ping": veri içermez, yalnızca "değişti, yeniden çek" sinyali.
-- Asıl veri her zaman yetki kontrollü RPC'lerden okunur.
create or replace function lucana._ping(p_topic text)
returns void language plpgsql security definer
set search_path = lucana, realtime as $$
begin
  perform realtime.send(jsonb_build_object('at', extract(epoch from now())), 'changed', p_topic, false);
exception when others then
  null; -- realtime yoksa sessizce geç (istemci zaten periyodik yeniler)
end;
$$;

create or replace function lucana._valid_device(p_device text)
returns boolean language sql immutable as $$
  select p_device is not null and p_device ~ '^[A-Za-z0-9-]{16,64}$';
$$;

create or replace function lucana._new_table_code()
returns text language sql volatile
set search_path = lucana, extensions as $$
  select encode(extensions.gen_random_bytes(6), 'hex');
$$;

-- =============================================================
--  KİMLİK DOĞRULAMA RPC'LERİ
-- =============================================================

create or replace function lucana.staff_login(p_username text, p_password text)
returns json language plpgsql volatile security definer
set search_path = lucana, extensions as $$
declare
  v_user  lucana.staff%rowtype;
  v_role  lucana.roles%rowtype;
  v_name  text := lower(trim(coalesce(p_username, '')));
  v_ip    text := lucana._client_ip();
  v_token text;
begin
  -- Brute-force kilidi: kullanıcı başına 15 dk'da 5, IP başına 25 hatalı deneme
  if (select count(*) from lucana.login_attempts
      where username = v_name and not ok and at > now() - interval '15 minutes') >= 5
     or (select count(*) from lucana.login_attempts
         where ip = v_ip and not ok and at > now() - interval '15 minutes') >= 25 then
    raise exception 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.' using errcode = '42501';
  end if;

  select * into v_user from lucana.staff where username = v_name and is_active;

  if v_user.id is null or v_user.password_hash <> extensions.crypt(coalesce(p_password, ''), v_user.password_hash) then
    -- raise etmiyoruz: istisna transaction'ı geri alır ve deneme kaydı kaybolurdu
    insert into lucana.login_attempts(username, ip, ok) values (v_name, v_ip, false);
    perform pg_sleep(0.4);
    return json_build_object('error', 'Kullanıcı adı veya şifre hatalı');
  end if;

  insert into lucana.login_attempts(username, ip, ok) values (v_name, v_ip, true);
  delete from lucana.login_attempts where at < now() - interval '7 days';
  delete from lucana.sessions where expires_at < now();

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into lucana.sessions(token_hash, staff_id, user_agent)
  values (lucana._hash_token(v_token), v_user.id, left(lucana._header('user-agent'), 200));

  update lucana.staff set last_login_at = now() where id = v_user.id;
  select * into v_role from lucana.roles where id = v_user.role_id;
  perform lucana._audit(v_user.id, 'login', 'auth', v_user.full_name || ' giriş yaptı');

  return json_build_object(
    'token', v_token,
    'user', json_build_object(
      'id', v_user.id, 'username', v_user.username, 'full_name', v_user.full_name,
      'role_key', v_role.key, 'role_name', v_role.name, 'level', v_role.level,
      'must_change_pw', v_user.must_change_pw));
end;
$$;

create or replace function lucana.staff_me()
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._sid();
begin
  if v_id is null then return null; end if;
  -- kayan oturum süresi
  update lucana.sessions set last_seen_at = now(), expires_at = now() + interval '14 days'
  where token_hash = lucana._hash_token(lucana._header('x-session-token'))
    and last_seen_at < now() - interval '10 minutes';
  return (
    select json_build_object(
      'id', u.id, 'username', u.username, 'full_name', u.full_name,
      'role_key', r.key, 'role_name', r.name, 'level', r.level,
      'must_change_pw', u.must_change_pw)
    from lucana.staff u join lucana.roles r on r.id = u.role_id where u.id = v_id);
end;
$$;

create or replace function lucana.staff_logout()
returns void language sql volatile security definer
set search_path = lucana as $$
  delete from lucana.sessions
  where token_hash = lucana._hash_token(coalesce(lucana._header('x-session-token'), '-'));
$$;

create or replace function lucana.staff_change_password(p_old text, p_new text)
returns json language plpgsql volatile security definer
set search_path = lucana, extensions as $$
declare v_id uuid := lucana._require(0, true); v_hash text;
begin
  select password_hash into v_hash from lucana.staff where id = v_id;
  if v_hash <> extensions.crypt(coalesce(p_old, ''), v_hash) then
    raise exception 'Mevcut şifre hatalı';
  end if;
  if length(coalesce(p_new, '')) < 8 then
    raise exception 'Yeni şifre en az 8 karakter olmalı';
  end if;
  if p_new = p_old then
    raise exception 'Yeni şifre eskisiyle aynı olamaz';
  end if;
  update lucana.staff
  set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)),
      must_change_pw = false, updated_at = now()
  where id = v_id;
  -- diğer cihazlardaki oturumları kapat
  delete from lucana.sessions
  where staff_id = v_id and token_hash <> lucana._hash_token(lucana._header('x-session-token'));
  perform lucana._audit(v_id, 'password', 'auth', 'Kendi şifresini değiştirdi');
  return json_build_object('ok', true);
end;
$$;

-- Edge function (görsel yükleme) bu fonksiyonla yetki doğrular
create or replace function lucana.staff_can_upload()
returns boolean language plpgsql stable security definer
set search_path = lucana as $$
begin
  perform lucana._require(80);
  return true;
end;
$$;
