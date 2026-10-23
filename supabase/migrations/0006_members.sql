-- =============================================================
--  Lucana — 0006 Üyelik, sadakat puanı, masa varlığı, sosyal akış
--
--  ÜYELİK: Müşteri masadaki QR'ı okutup koşulları onaylayınca tek
--  dokunuşla anonim üye hesabı açılır (rastgele takma ad). İsteğe
--  bağlı kullanıcı adı + şifre ile hesabını "kaydedip" başka cihazdan
--  girebilir. Oturum token'ı yalnızca SHA-256 hash olarak saklanır,
--  istemci "x-member-token" header'ı ile gönderir.
--
--  ÇİFT KAYIT YOK: Geçerli token varken yeni hesap açılmaz; başka bir
--  hesaba giriş yapıldığında cihazdaki boş anonim hesap silinir.
--
--  PUAN EKONOMİSİ (BigLoft modeli, %10 iade):
--    points_per_tl        = 1 ₺ NET ödemede kazanılan puan  (10)
--    redeem_points_per_tl = 1 ₺ indirim için gereken puan   (100)
--    max_discount_pct     = sepetin en fazla % kaçı puanla  (50)
--  Puan yalnızca cepten ödenen NET tutar üzerinden kazanılır (puanla
--  indirim alınan kısımdan tekrar puan kazanılmaz).
--
--  ÇİFT İŞLEM YOK: Her puan hareketi points_ledger'a yazılır;
--  (kind, ref_id) benzersizdir → aynı sipariş için iki kez puan
--  kazanılamaz/harcanamaz/iade edilemez. Bakiye satır kilidiyle güncellenir
--  ve asla eksiye düşemez.
-- =============================================================

-- -------------------------------------------------------------
--  TABLOLAR
-- -------------------------------------------------------------
create table if not exists lucana.members (
  id              uuid primary key default gen_random_uuid(),
  nickname        text not null,
  avatar          text not null default '🔥',
  username        text unique check (username ~ '^[a-z0-9._-]{3,24}$'),
  password_hash   text,
  points          int  not null default 0 check (points >= 0),
  lifetime_earned int  not null default 0,
  is_hidden       boolean not null default false,   -- sosyal akışta/liderlikte görünmez
  marketing_ok    boolean not null default false,   -- kampanya bildirimleri açık rızası
  is_banned       boolean not null default false,
  consent_version text not null,
  consent_at      timestamptz not null default now(),
  created_ip      text,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);
create unique index if not exists members_nickname_uq on lucana.members(lower(nickname));

create table if not exists lucana.member_sessions (
  token_hash   text primary key,
  member_id    uuid not null references lucana.members(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '365 days'
);
create index if not exists member_sessions_member_idx on lucana.member_sessions(member_id);

create table if not exists lucana.points_ledger (
  id            bigserial primary key,
  member_id     uuid not null references lucana.members(id) on delete cascade,
  delta         int  not null,
  kind          text not null check (kind in ('earn','redeem','refund','admin',
                                              'game_bet','game_win','game_refund','skill_reward')),
  ref_id        uuid,
  note          text,
  staff_id      uuid references lucana.staff(id) on delete set null,
  balance_after int,
  at            timestamptz not null default now()
);
create unique index if not exists points_ledger_once on lucana.points_ledger(kind, ref_id) where ref_id is not null;
create index if not exists points_ledger_member_idx on lucana.points_ledger(member_id, at desc);
create index if not exists points_ledger_at_idx on lucana.points_ledger(at desc);

create table if not exists lucana.table_presence (
  id        uuid primary key default gen_random_uuid(),
  member_id uuid not null references lucana.members(id) on delete cascade,
  table_id  uuid not null references lucana.tables(id) on delete cascade,
  since     timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  left_at   timestamptz
);
create unique index if not exists presence_one_active on lucana.table_presence(member_id) where left_at is null;
create index if not exists presence_table_idx on lucana.table_presence(table_id) where left_at is null;

alter table lucana.orders add column if not exists member_id uuid references lucana.members(id) on delete set null;
alter table lucana.orders add column if not exists subtotal numeric(12,2) not null default 0;
alter table lucana.orders add column if not exists points_discount numeric(10,2) not null default 0;
alter table lucana.orders add column if not exists points_spent int not null default 0;
alter table lucana.orders add column if not exists points_earned int not null default 0;
create index if not exists orders_member_idx on lucana.orders(member_id, created_at desc);
update lucana.orders set subtotal = total where subtotal = 0 and total > 0;

alter table lucana.push_subscriptions add column if not exists member_id uuid references lucana.members(id) on delete cascade;

alter table lucana.members enable row level security;
alter table lucana.member_sessions enable row level security;
alter table lucana.points_ledger enable row level security;
alter table lucana.table_presence enable row level security;

-- Varsayılan sadakat / oyun ayarları (mevcut değerleri ezmez)
update lucana.settings set data = jsonb_build_object(
  'points_per_tl', 10,
  'redeem_points_per_tl', 100,
  'max_discount_pct', 50,
  'social_feed_enabled', true,
  'games_enabled', true,
  'game_min_bet', 10,
  'game_max_bet', 1000,
  'game_daily_loss_limit', 5000,
  'skill_daily_cap', 150
) || data where id = 1;

-- -------------------------------------------------------------
--  YARDIMCILAR
-- -------------------------------------------------------------
create or replace function lucana._setting_num(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = lucana as $$
  select coalesce((select nullif(data->>p_key, '')::numeric from lucana.settings where id = 1), p_default);
$$;

create or replace function lucana._setting_bool(p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = lucana as $$
  select coalesce((select (data->>p_key)::boolean from lucana.settings where id = 1), p_default);
$$;

create or replace function lucana._earn_rate() returns numeric language sql stable as $$
  select greatest(lucana._setting_num('points_per_tl', 10), 0);
$$;
create or replace function lucana._redeem_rate() returns numeric language sql stable as $$
  select greatest(lucana._setting_num('redeem_points_per_tl', 100), 1);
$$;

-- Geçerli üyenin id'si (x-member-token header'ından)
create or replace function lucana._mid()
returns uuid language sql stable security definer
set search_path = lucana, extensions as $$
  select s.member_id from lucana.member_sessions s
  where s.token_hash = lucana._hash_token(coalesce(lucana._header('x-member-token'), '-'))
    and s.expires_at > now()
  limit 1;
$$;

create or replace function lucana._require_member(p_allow_banned boolean default true)
returns uuid language plpgsql stable security definer set search_path = lucana as $$
declare v_id uuid := lucana._mid(); v_banned boolean;
begin
  if v_id is null then
    raise exception 'MEMBER_REQUIRED' using errcode = '28000', hint = 'Üye oturumu gerekli';
  end if;
  if not p_allow_banned then
    select is_banned into v_banned from lucana.members where id = v_id;
    if v_banned then raise exception 'Hesabınız bu işlem için kısıtlanmış. Lütfen personele danışın.'; end if;
  end if;
  return v_id;
end;
$$;

-- Puan hareketi: idempotent (kind+ref), kilitli, bakiye asla eksiye düşmez
create or replace function lucana._points_add(
  p_member uuid, p_delta int, p_kind text, p_ref uuid, p_note text, p_staff uuid default null)
returns boolean language plpgsql volatile security definer set search_path = lucana as $$
declare v_ledger bigint; v_bal int;
begin
  if p_delta = 0 then return false; end if;
  perform 1 from lucana.members where id = p_member for update;
  if not found then raise exception 'Üye bulunamadı'; end if;

  insert into lucana.points_ledger(member_id, delta, kind, ref_id, note, staff_id)
  values (p_member, p_delta, p_kind, p_ref, left(p_note, 200), p_staff)
  on conflict (kind, ref_id) where ref_id is not null do nothing
  returning id into v_ledger;
  if v_ledger is null then return false; end if; -- bu işlem zaten yapılmış

  update lucana.members
     set points = points + p_delta,
         lifetime_earned = lifetime_earned + case when p_kind = 'earn' then p_delta else 0 end
   where id = p_member and points + p_delta >= 0
  returning points into v_bal;
  if v_bal is null then
    raise exception 'Yetersiz puan' using errcode = 'P0001';
  end if;
  update lucana.points_ledger set balance_after = v_bal where id = v_ledger;
  return true;
end;
$$;

create or replace function lucana._random_nickname()
returns text language plpgsql volatile set search_path = lucana as $$
declare
  a text[] := array['Köz','Duman','Nargile','Okey','Çay','Kahve','Gece','Altın','Lucana','Taş','Joker','Elma','Nane','Kavun','Fincan','Zar'];
  b text[] := array['Ustası','Kralı','Kurdu','Sultanı','Prensi','Avcısı','Tutkunu','Efsanesi','Ustası','Aslanı','Kaptanı','Dostu'];
  v text;
  i int := 0;
begin
  loop
    v := a[1 + floor(random() * array_length(a, 1))::int] || ' ' ||
         b[1 + floor(random() * array_length(b, 1))::int] || ' ' ||
         (10 + floor(random() * 90))::int;
    exit when not exists (select 1 from lucana.members where lower(nickname) = lower(v)) or i > 20;
    i := i + 1;
  end loop;
  return v;
end;
$$;

create or replace function lucana._clean_nickname(p text)
returns text language plpgsql immutable as $$
declare v text := regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g');
begin
  if length(v) < 2 or length(v) > 24 then raise exception 'Takma ad 2-24 karakter olmalı'; end if;
  if v !~ '^[[:alnum:] ._çğıöşüÇĞİÖŞÜ-]+$' then raise exception 'Takma ad yalnızca harf, rakam, boşluk, nokta ve tire içerebilir'; end if;
  if lower(v) ~ '(amk|aq|sik|s[iı]k|orospu|piç|pic|yarrak|göt|got|ibne|kahpe|pezevenk|admin|lucana|personel|garson)' then
    raise exception 'Bu takma ad kullanılamaz';
  end if;
  return v;
end;
$$;

create or replace function lucana._member_json(p_id uuid)
returns json language sql stable security definer set search_path = lucana as $$
  select json_build_object(
    'id', m.id, 'nickname', m.nickname, 'avatar', m.avatar, 'username', m.username,
    'points', m.points, 'lifetime_earned', m.lifetime_earned, 'is_hidden', m.is_hidden,
    'marketing_ok', m.marketing_ok, 'is_banned', m.is_banned, 'created_at', m.created_at,
    'has_password', m.password_hash is not null,
    'discount_value', floor(m.points / lucana._redeem_rate() * 100) / 100,
    'rates', json_build_object('earn', lucana._earn_rate(), 'redeem', lucana._redeem_rate(),
                               'max_discount_pct', lucana._setting_num('max_discount_pct', 50)))
  from lucana.members m where m.id = p_id;
$$;

create or replace function lucana._new_member_session(p_member uuid)
returns text language plpgsql volatile security definer set search_path = lucana, extensions as $$
declare v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into lucana.member_sessions(token_hash, member_id) values (lucana._hash_token(v_token), p_member);
  return v_token;
end;
$$;

-- -------------------------------------------------------------
--  ÜYELİK RPC'LERİ
-- -------------------------------------------------------------

-- QR okutup koşulları kabul edince: tek dokunuşla hesap
create or replace function lucana.mem_start(p_consent_version text, p_adult boolean, p_marketing boolean default false)
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_id uuid := lucana._mid(); v_ip text := lucana._client_ip(); v_token text;
begin
  -- Geçerli oturum varsa yeni hesap AÇILMAZ (çift kayıt önlemi)
  if v_id is not null then
    update lucana.members set last_seen_at = now() where id = v_id;
    return json_build_object('token', null, 'member', lucana._member_json(v_id), 'existing', true);
  end if;
  if not coalesce(p_adult, false) then raise exception 'Devam etmek için 18 yaşından büyük olduğunuzu onaylayın'; end if;
  if coalesce(p_consent_version, '') = '' then raise exception 'Koşulları onaylayın'; end if;

  -- Kafe Wi-Fi'ı tek IP paylaşır; bu yüzden sınır cömert, ama bot taşkınını keser
  if (select count(*) from lucana.members where created_ip = v_ip and created_at > now() - interval '1 hour') >= 80 then
    raise exception 'Çok fazla yeni hesap açıldı, lütfen biraz sonra tekrar deneyin';
  end if;

  insert into lucana.members(nickname, avatar, consent_version, marketing_ok, created_ip)
  values (lucana._random_nickname(),
          (array['🔥','☕','🍹','🎲','🃏','👑','🌙','⭐','🍓','🍋','💨','🎯'])[1 + floor(random() * 12)::int],
          left(p_consent_version, 20), coalesce(p_marketing, false), v_ip)
  returning id into v_id;

  v_token := lucana._new_member_session(v_id);
  return json_build_object('token', v_token, 'member', lucana._member_json(v_id), 'existing', false);
end;
$$;

create or replace function lucana.mem_me()
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_id uuid := lucana._mid();
begin
  if v_id is null then return null; end if;
  update lucana.members set last_seen_at = now() where id = v_id and last_seen_at < now() - interval '5 minutes';
  return lucana._member_json(v_id);
end;
$$;

create or replace function lucana.mem_update(p jsonb)
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_id uuid := lucana._require_member(); v_nick text;
begin
  if p ? 'nickname' then
    v_nick := lucana._clean_nickname(p->>'nickname');
    if exists (select 1 from lucana.members where lower(nickname) = lower(v_nick) and id <> v_id) then
      raise exception 'Bu takma ad alınmış';
    end if;
    update lucana.members set nickname = v_nick where id = v_id;
  end if;
  if p ? 'avatar' then
    update lucana.members set avatar = left(p->>'avatar', 8) where id = v_id;
  end if;
  if p ? 'is_hidden' then
    update lucana.members set is_hidden = (p->>'is_hidden')::boolean where id = v_id;
  end if;
  if p ? 'marketing_ok' then
    update lucana.members set marketing_ok = (p->>'marketing_ok')::boolean where id = v_id;
  end if;
  return lucana._member_json(v_id);
end;
$$;

-- Hesabı kaydet: kullanıcı adı + şifre (başka cihazdan giriş için)
create or replace function lucana.mem_save_account(p_username text, p_password text)
returns json language plpgsql volatile security definer set search_path = lucana, extensions as $$
declare v_id uuid := lucana._require_member(); v_user text := lower(trim(coalesce(p_username, '')));
begin
  if v_user !~ '^[a-z0-9._-]{3,24}$' then
    raise exception 'Kullanıcı adı 3-24 karakter; küçük harf, rakam, nokta, alt çizgi, tire';
  end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Şifre en az 6 karakter olmalı'; end if;
  if exists (select 1 from lucana.members where username = v_user and id <> v_id) then
    raise exception 'Bu kullanıcı adı alınmış';
  end if;
  update lucana.members set username = v_user,
         password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 8))
   where id = v_id;
  return lucana._member_json(v_id);
end;
$$;

-- Başka cihazdan giriş. Bu cihazdaki BOŞ anonim hesap silinir (çift hesap birikmez).
create or replace function lucana.mem_login(p_username text, p_password text)
returns json language plpgsql volatile security definer set search_path = lucana, extensions as $$
declare
  v_user text := lower(trim(coalesce(p_username, '')));
  v_key  text := 'm:' || v_user;
  v_ip   text := lucana._client_ip();
  v_m    lucana.members%rowtype;
  v_cur  uuid := lucana._mid();
  v_token text;
begin
  if (select count(*) from lucana.login_attempts where username = v_key and not ok and at > now() - interval '15 minutes') >= 6
     or (select count(*) from lucana.login_attempts where ip = v_ip and not ok and username like 'm:%' and at > now() - interval '15 minutes') >= 40 then
    raise exception 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.';
  end if;
  select * into v_m from lucana.members where username = v_user;
  if v_m.id is null or v_m.password_hash is null or v_m.password_hash <> extensions.crypt(coalesce(p_password, ''), v_m.password_hash) then
    insert into lucana.login_attempts(username, ip, ok) values (v_key, v_ip, false);
    return json_build_object('error', 'Kullanıcı adı veya şifre hatalı');
  end if;
  insert into lucana.login_attempts(username, ip, ok) values (v_key, v_ip, true);

  if v_cur is not null and v_cur <> v_m.id then
    -- cihazdaki hesap boşsa (şifresiz, puansız, siparişsiz) sil; değilse sadece oturumu kapat
    delete from lucana.members m
     where m.id = v_cur and m.password_hash is null and m.points = 0 and m.lifetime_earned = 0
       and not exists (select 1 from lucana.orders o where o.member_id = m.id)
       and not exists (select 1 from lucana.points_ledger l where l.member_id = m.id);
    delete from lucana.member_sessions where token_hash = lucana._hash_token(coalesce(lucana._header('x-member-token'), '-'));
  end if;

  v_token := lucana._new_member_session(v_m.id);
  update lucana.members set last_seen_at = now() where id = v_m.id;
  return json_build_object('token', v_token, 'member', lucana._member_json(v_m.id));
end;
$$;

create or replace function lucana.mem_logout()
returns void language sql volatile security definer set search_path = lucana as $$
  delete from lucana.member_sessions
  where token_hash = lucana._hash_token(coalesce(lucana._header('x-member-token'), '-'));
$$;

-- KVKK: hesabımı ve verilerimi sil
create or replace function lucana.mem_delete()
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_id uuid := lucana._require_member();
begin
  delete from lucana.members where id = v_id; -- oturum, puan geçmişi, varlık, abonelikler cascade
  return json_build_object('ok', true);
end;
$$;

create or replace function lucana.mem_history(p_limit int default 50)
returns json language plpgsql stable security definer set search_path = lucana as $$
declare v_id uuid := lucana._require_member();
begin
  return coalesce((select json_agg(x) from (
    select id, delta, kind, note, balance_after, at from lucana.points_ledger
    where member_id = v_id order by at desc limit least(greatest(p_limit, 1), 200)) x), '[]'::json);
end;
$$;

-- -------------------------------------------------------------
--  MASA VARLIĞI (kim hangi masada)
-- -------------------------------------------------------------
create or replace function lucana.mem_checkin(p_code text)
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_id uuid := lucana._require_member(); v_table uuid;
begin
  select id into v_table from lucana.tables where code = p_code and is_active;
  if v_table is null then raise exception 'Masa bulunamadı'; end if;
  update lucana.table_presence set left_at = now()
   where member_id = v_id and left_at is null and (table_id <> v_table or last_seen < now() - interval '4 hours');
  update lucana.table_presence set last_seen = now() where member_id = v_id and left_at is null and table_id = v_table;
  if not found then
    insert into lucana.table_presence(member_id, table_id) values (v_id, v_table);
    perform lucana._ping('lucana-staff');
    perform lucana._ping('lucana-t-' || v_table);
  end if;
  return json_build_object('ok', true);
end;
$$;

-- Masadakiler + masada kim ne sipariş etti (yalnızca o masada oturan üyeye)
create or replace function lucana.mem_table_state(p_code text)
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_id uuid := lucana._require_member(); v_table uuid;
begin
  select id into v_table from lucana.tables where code = p_code and is_active;
  if v_table is null then raise exception 'Masa bulunamadı'; end if;
  update lucana.table_presence set last_seen = now()
   where member_id = v_id and table_id = v_table and left_at is null and last_seen < now() - interval '2 minutes';
  return json_build_object(
    'people', coalesce((
      select json_agg(json_build_object('nickname', case when m.is_hidden and m.id <> v_id then null else m.nickname end,
                                        'avatar', case when m.is_hidden and m.id <> v_id then '👤' else m.avatar end,
                                        'me', m.id = v_id) order by p.since)
      from lucana.table_presence p join lucana.members m on m.id = p.member_id
      where p.table_id = v_table and p.left_at is null and p.last_seen > now() - interval '4 hours'), '[]'::json),
    'orders', coalesce((
      select json_agg(x order by x.created_at desc) from (
        select o.no, o.status, o.created_at,
               case when m.is_hidden and m.id <> v_id then 'Gizli misafir' else coalesce(m.nickname, 'Masa') end as nickname,
               coalesce(m.avatar, '🍽️') as avatar, m.id = v_id as me,
               (select string_agg(oi.qty || '× ' || oi.name, ', ') from lucana.order_items oi where oi.order_id = o.id) as items
        from lucana.orders o left join lucana.members m on m.id = o.member_id
        where o.table_id = v_table and o.status in ('new','preparing','served')
        order by o.created_at desc limit 30) x), '[]'::json));
end;
$$;

-- -------------------------------------------------------------
--  SİPARİŞ: üye bağlantısı + puanla indirim
-- -------------------------------------------------------------
drop function if exists lucana._order_insert(uuid, text, jsonb, text, uuid, text);

create or replace function lucana._order_insert(
  p_table uuid, p_device text, p_items jsonb, p_note text, p_staff uuid, p_source text,
  p_member uuid default null, p_discount numeric default 0)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare
  v_order uuid;
  v_no    int;
  v_day   date := lucana._biz_day(now());
  v_sub   numeric(12,2) := 0;
  v_disc  numeric(10,2) := 0;
  v_pts   int := 0;
  v_label text;
  v_item  lucana.menu_items%rowtype;
  r       record;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Sepet boş';
  end if;
  if jsonb_array_length(p_items) > 40 then
    raise exception 'Tek siparişte en fazla 40 satır olabilir';
  end if;

  select name into v_label from lucana.tables where id = p_table;

  insert into lucana.day_counters(day, n) values (v_day, 1)
  on conflict (day) do update set n = lucana.day_counters.n + 1
  returning n into v_no;

  insert into lucana.orders(no, biz_day, table_id, table_label, device_id, source, note, created_by, member_id)
  values (v_no, v_day, p_table, v_label, p_device, p_source, nullif(left(trim(p_note), 300), ''), p_staff, p_member)
  returning id into v_order;

  for r in
    select (e->>'id')::uuid as id,
           sum(coalesce((e->>'qty')::int, 0))::int as qty,
           string_agg(nullif(left(trim(e->>'note'), 150), ''), ' / ') as note
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    if r.qty < 1 or r.qty > 50 then raise exception 'Geçersiz adet'; end if;

    select mi.* into v_item
    from lucana.menu_items mi
    join lucana.menu_categories c on c.id = mi.category_id and c.is_active
    where mi.id = r.id and mi.is_active
    for update of mi;

    if v_item.id is null then
      raise exception 'Sepetteki bir ürün artık menüde yok, lütfen sepeti yenileyin';
    end if;

    if v_item.track_stock then
      if v_item.stock < r.qty then
        raise exception '"%" için yeterli stok yok (kalan: %)', v_item.name, greatest(v_item.stock, 0);
      end if;
      update lucana.menu_items set stock = stock - r.qty, updated_at = now() where id = v_item.id;
      insert into lucana.stock_moves(kind, ref_id, ref_name, delta, reason, order_id, staff_id)
      values ('menu', v_item.id, v_item.name, -r.qty, 'Sipariş #' || v_no, v_order, p_staff);
    end if;

    insert into lucana.order_items(order_id, menu_item_id, category_id, name, unit_price, qty, note)
    values (v_order, v_item.id, v_item.category_id, v_item.name, v_item.price, r.qty, r.note);

    v_sub := v_sub + v_item.price * r.qty;
  end loop;

  -- Puanla indirim (sunucuda hesaplanır, sınırlanır; bakiye yetmezse sipariş hiç oluşmaz)
  if p_member is not null and coalesce(p_discount, 0) > 0 then
    if (select is_banned from lucana.members where id = p_member) then
      raise exception 'Hesabınızda puan kullanımı kısıtlanmış';
    end if;
    -- istenen ↔ sepet tavanı ↔ bakiyenin karşıladığı tutar: en küçüğü
    v_disc := least(round(p_discount, 2),
                    floor(v_sub * lucana._setting_num('max_discount_pct', 50)) / 100,
                    floor((select points from lucana.members where id = p_member) / lucana._redeem_rate() * 100) / 100);
    v_pts  := ceil(v_disc * lucana._redeem_rate())::int;
    if v_pts > 0 then
      perform lucana._points_add(p_member, -v_pts, 'redeem', v_order, 'Sipariş #' || v_no || ' indirimi');
    else
      v_disc := 0;
    end if;
  end if;

  update lucana.orders
     set subtotal = v_sub, points_discount = v_disc, points_spent = v_pts, total = v_sub - v_disc
   where id = v_order;

  perform lucana._ping('lucana-staff');
  if p_table is not null then perform lucana._ping('lucana-t-' || p_table); end if;

  return json_build_object('id', v_order, 'no', v_no, 'total', v_sub - v_disc, 'subtotal', v_sub,
                           'discount', v_disc, 'points_spent', v_pts);
end;
$$;

drop function if exists lucana.order_place(text, text, jsonb, text);

create or replace function lucana.order_place(
  p_code text, p_device text, p_items jsonb, p_note text default null, p_discount_tl numeric default 0)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_table lucana.tables%rowtype; v_enabled boolean; v_member uuid := lucana._mid();
begin
  if not lucana._valid_device(p_device) then raise exception 'Geçersiz cihaz'; end if;

  select * into v_table from lucana.tables where code = p_code and is_active;
  if v_table.id is null then
    raise exception 'Masa bulunamadı. Lütfen masadaki QR kodu tekrar okutun.';
  end if;

  select coalesce((data->>'ordering_enabled')::boolean, true) into v_enabled from lucana.settings where id = 1;
  if not coalesce(v_enabled, true) then
    raise exception 'Şu anda QR ile sipariş alınmıyor, lütfen garsonu çağırın.';
  end if;

  if exists (select 1 from lucana.orders where device_id = p_device and created_at > now() - interval '15 seconds') then
    raise exception 'Lütfen birkaç saniye bekleyip tekrar deneyin';
  end if;
  if (select count(*) from lucana.orders where device_id = p_device and created_at > now() - interval '1 hour') >= 12 then
    raise exception 'Çok fazla sipariş denemesi. Lütfen garsonu çağırın.';
  end if;
  if (select count(*) from lucana.orders where table_id = v_table.id and status = 'new') >= 10 then
    raise exception 'Masanızda onay bekleyen çok sipariş var, lütfen garsonu çağırın.';
  end if;

  if v_member is not null then
    perform lucana.mem_checkin(p_code);
  end if;

  return lucana._order_insert(v_table.id, p_device, p_items, p_note, null, 'qr', v_member, p_discount_tl);
end;
$$;

-- Ödenince puan kazandır / iptal edilince harcanan puanı iade et (idempotent)
create or replace function lucana._trg_orders_points()
returns trigger language plpgsql security definer set search_path = lucana as $$
declare v_pts int;
begin
  if new.member_id is null or old.status = new.status then return null; end if;

  if new.status = 'paid' then
    v_pts := floor(new.total * lucana._earn_rate())::int;
    if v_pts > 0 and lucana._points_add(new.member_id, v_pts, 'earn', new.id, 'Sipariş #' || new.no || ' (' || new.total || '₺)', new.handled_by) then
      update lucana.orders set points_earned = v_pts where id = new.id;
      if new.device_id is not null then
        perform lucana._push('device', new.device_id, '⭐ +' || v_pts || ' puan kazandın!',
          'Sipariş #' || new.no || ' ödendi. Puanlarını indirim olarak ya da oyunlarda kullanabilirsin.', 'profil', 'points-' || new.id);
      end if;
    end if;
  elsif new.status = 'cancelled' and new.points_spent > 0 then
    perform lucana._points_add(new.member_id, new.points_spent, 'refund', new.id, 'Sipariş #' || new.no || ' iptal iadesi', new.handled_by);
  end if;
  return null;
end;
$$;

drop trigger if exists orders_points on lucana.orders;
create trigger orders_points after update of status on lucana.orders
for each row execute function lucana._trg_orders_points();

-- Push tetikleyicisi: yeni siparişi ara toplamdan algıla (puanla tam indirimde de çalışsın)
create or replace function lucana._trg_orders_push()
returns trigger language plpgsql security definer
set search_path = lucana as $$
begin
  if tg_op = 'UPDATE' and old.subtotal = 0 and new.subtotal > 0 and new.status = 'new' then
    perform lucana._notify_order_new(new.id);
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    perform lucana._notify_order_status(new.id);
  end if;
  return null;
end;
$$;

-- Müşterinin sipariş takibi: indirim/puan bilgisi eklendi
create or replace function lucana.order_track(p_code text, p_device text)
returns json language sql stable security definer
set search_path = lucana as $$
  with t as (select id from lucana.tables where code = p_code and is_active)
  select json_build_object(
    'orders', coalesce((
      select json_agg(json_build_object(
        'id', o.id, 'no', o.no, 'status', o.status, 'total', o.total, 'note', o.note,
        'subtotal', o.subtotal, 'points_discount', o.points_discount, 'points_earned', o.points_earned,
        'created_at', o.created_at, 'updated_at', o.updated_at,
        'items', (select json_agg(json_build_object('name', oi.name, 'qty', oi.qty,
                                                    'unit_price', oi.unit_price, 'note', oi.note)
                                  order by oi.name)
                  from lucana.order_items oi where oi.order_id = o.id))
        order by o.created_at desc)
      from lucana.orders o, t
      where o.table_id = t.id and o.device_id = p_device
        and o.created_at > now() - interval '12 hours'), '[]'::json),
    'calls', coalesce((
      select json_agg(json_build_object('id', c.id, 'type', c.type, 'created_at', c.created_at))
      from lucana.waiter_calls c, t
      where c.table_id = t.id and c.status = 'open'
        and c.created_at > now() - interval '3 hours'), '[]'::json))
  where lucana._valid_device(p_device);
$$;

-- Hesap kapanınca masadakiler "kalktı" sayılır
create or replace function lucana.adm_table_close(p_table uuid, p_payment text)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(60); v_n int; v_sum numeric; v_name text;
begin
  if coalesce(p_payment, '') not in ('cash','card','other') then raise exception 'Ödeme yöntemi seçin'; end if;
  select name into v_name from lucana.tables where id = p_table;
  with u as (
    update lucana.orders set status = 'paid', payment_method = p_payment, paid_at = now(),
           handled_by = v_id, updated_at = now()
    where table_id = p_table and status in ('new','preparing','served')
    returning total)
  select count(*), coalesce(sum(total), 0) into v_n, v_sum from u;
  update lucana.waiter_calls set status = 'done', done_at = now(), done_by = v_id
  where table_id = p_table and status = 'open';
  update lucana.table_presence set left_at = now() where table_id = p_table and left_at is null;
  if v_n > 0 then
    perform lucana._audit(v_id, 'paid', 'table', format('%s hesabı kapatıldı: %s sipariş, %s₺ (%s)', v_name, v_n, v_sum, p_payment));
  end if;
  perform lucana._ping('lucana-staff');
  perform lucana._ping('lucana-t-' || p_table);
  return json_build_object('orders', v_n, 'total', v_sum);
end;
$$;

-- Panel sipariş kartı: üye + indirim bilgisi
create or replace function lucana._order_json(o lucana.orders)
returns json language sql stable security definer
set search_path = lucana as $$
  select json_build_object(
    'id', o.id, 'no', o.no, 'biz_day', o.biz_day, 'status', o.status, 'source', o.source,
    'table_id', o.table_id, 'table_label', coalesce(t.name, o.table_label), 'area', t.area,
    'note', o.note, 'total', o.total, 'subtotal', o.subtotal, 'points_discount', o.points_discount,
    'points_spent', o.points_spent, 'points_earned', o.points_earned,
    'payment_method', o.payment_method,
    'cancel_reason', o.cancel_reason, 'created_at', o.created_at, 'updated_at', o.updated_at,
    'paid_at', o.paid_at,
    'member', (select json_build_object('id', m.id, 'nickname', m.nickname, 'avatar', m.avatar) from lucana.members m where m.id = o.member_id),
    'created_by', (select full_name from lucana.staff where id = o.created_by),
    'handled_by', (select full_name from lucana.staff where id = o.handled_by),
    'items', coalesce((select json_agg(json_build_object(
                 'id', oi.id, 'name', oi.name, 'qty', oi.qty, 'unit_price', oi.unit_price, 'note', oi.note)
               order by oi.name) from lucana.order_items oi where oi.order_id = o.id), '[]'::json))
  from (select 1) _ left join lucana.tables t on t.id = o.table_id;
$$;

-- Canlı masalar: masadaki kişi sayısı + isimler
create or replace function lucana.adm_tables_live()
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(30);
begin
  return coalesce((
    select json_agg(json_build_object(
      'id', t.id, 'name', t.name, 'area', t.area, 'is_active', t.is_active,
      'open_orders', coalesce(o.cnt, 0), 'open_total', coalesce(o.total, 0),
      'since', o.since, 'calls', coalesce(c.cnt, 0),
      'people', coalesce(p.people, '[]'::json), 'people_count', coalesce(p.cnt, 0)) order by t.sort, t.name)
    from lucana.tables t
    left join (select table_id, count(*) cnt, sum(total) total, min(created_at) since
               from lucana.orders where status in ('new','preparing','served') group by table_id) o
      on o.table_id = t.id
    left join (select table_id, count(*) cnt from lucana.waiter_calls where status = 'open' group by table_id) c
      on c.table_id = t.id
    left join (select p.table_id, count(*) cnt,
                      json_agg(json_build_object('id', m.id, 'nickname', m.nickname, 'avatar', m.avatar,
                                                 'points', m.points, 'since', p.since) order by p.since) people
               from lucana.table_presence p join lucana.members m on m.id = p.member_id
               where p.left_at is null and p.last_seen > now() - interval '4 hours'
               group by p.table_id) p on p.table_id = t.id
    where t.is_active), '[]'::json);
end;
$$;

-- -------------------------------------------------------------
--  SOSYAL: liderlik tablosu + canlı akış
-- -------------------------------------------------------------
create or replace function lucana.pub_leaderboard(p_board text default 'week')
returns json language plpgsql stable security definer set search_path = lucana as $$
declare v_me uuid := lucana._mid(); v_rows json; v_my json;
begin
  if p_board = 'all' then
    with r as (
      select m.id, m.nickname, m.avatar, m.lifetime_earned as score,
             rank() over (order by m.lifetime_earned desc) as rk
      from lucana.members m where not m.is_hidden and not m.is_banned and m.lifetime_earned > 0)
    select (select coalesce(json_agg(json_build_object('rank', rk, 'nickname', nickname, 'avatar', avatar, 'score', score, 'me', id = v_me) order by rk), '[]'::json) from (select * from r order by rk limit 25) t),
           (select json_build_object('rank', rk, 'score', score) from r where id = v_me)
      into v_rows, v_my;
  elsif p_board = 'games' then
    with r as (
      select m.id, m.nickname, m.avatar, sum(l.delta)::int as score,
             rank() over (order by sum(l.delta) desc) as rk
      from lucana.points_ledger l join lucana.members m on m.id = l.member_id
      where l.kind in ('game_bet','game_win','game_refund') and l.at > now() - interval '7 days'
        and not m.is_hidden and not m.is_banned
      group by m.id having sum(l.delta) > 0)
    select (select coalesce(json_agg(json_build_object('rank', rk, 'nickname', nickname, 'avatar', avatar, 'score', score, 'me', id = v_me) order by rk), '[]'::json) from (select * from r order by rk limit 25) t),
           (select json_build_object('rank', rk, 'score', score) from r where id = v_me)
      into v_rows, v_my;
  else -- 'week': bu hafta harcamayla kazanılan puan
    with r as (
      select m.id, m.nickname, m.avatar, sum(l.delta)::int as score,
             rank() over (order by sum(l.delta) desc) as rk
      from lucana.points_ledger l join lucana.members m on m.id = l.member_id
      where l.kind = 'earn' and l.at > now() - interval '7 days' and not m.is_hidden and not m.is_banned
      group by m.id)
    select (select coalesce(json_agg(json_build_object('rank', rk, 'nickname', nickname, 'avatar', avatar, 'score', score, 'me', id = v_me) order by rk), '[]'::json) from (select * from r order by rk limit 25) t),
           (select json_build_object('rank', rk, 'score', score) from r where id = v_me)
      into v_rows, v_my;
  end if;
  return json_build_object('rows', v_rows, 'me', v_my);
end;
$$;

-- Canlı akış: kim ne sipariş etti, kim ne kazandı (gizli üyeler hariç)
create or replace function lucana.pub_feed(p_limit int default 20)
returns json language plpgsql stable security definer set search_path = lucana as $$
begin
  if not lucana._setting_bool('social_feed_enabled', true) then return '[]'::json; end if;
  return coalesce((select json_agg(x order by x.at desc) from (
    (select 'order' as type, m.nickname, m.avatar, o.table_label as place, o.created_at as at,
            (select oi.name from lucana.order_items oi where oi.order_id = o.id order by oi.unit_price * oi.qty desc limit 1) as detail,
            (select sum(qty)::int from lucana.order_items oi where oi.order_id = o.id) as amount
     from lucana.orders o join lucana.members m on m.id = o.member_id
     where o.created_at > now() - interval '6 hours' and o.status <> 'cancelled'
       and not m.is_hidden and not m.is_banned
     order by o.created_at desc limit 15)
    union all
    (select 'join', m.nickname, m.avatar, t.name, p.since, null, null
     from lucana.table_presence p join lucana.members m on m.id = p.member_id join lucana.tables t on t.id = p.table_id
     where p.since > now() - interval '3 hours' and not m.is_hidden and not m.is_banned
     order by p.since desc limit 8)
    order by at desc limit least(greatest(p_limit, 1), 40)) x), '[]'::json);
end;
$$;

-- Herkese açık özet sayılar (ana sayfa)
create or replace function lucana.pub_stats()
returns json language sql stable security definer set search_path = lucana as $$
  select json_build_object(
    'members', (select count(*) from lucana.members),
    'here_now', (select count(*) from lucana.table_presence where left_at is null and last_seen > now() - interval '4 hours'),
    'orders_today', (select count(*) from lucana.orders where biz_day = lucana._biz_day(now()) and status <> 'cancelled'),
    'points_given', (select coalesce(sum(delta), 0) from lucana.points_ledger where kind = 'earn'));
$$;

-- -------------------------------------------------------------
--  PANEL: üyeler
-- -------------------------------------------------------------
create or replace function lucana.adm_members(p_q text default null, p_limit int default 100)
returns json language plpgsql stable security definer set search_path = lucana as $$
declare v_id uuid := lucana._require(60);
begin
  return coalesce((select json_agg(x) from (
    select m.id, m.nickname, m.avatar, m.username, m.points, m.lifetime_earned, m.is_hidden, m.is_banned,
           m.marketing_ok, m.created_at, m.last_seen_at,
           (select count(*) from lucana.orders o where o.member_id = m.id and o.status = 'paid') as orders_paid,
           (select coalesce(sum(total), 0) from lucana.orders o where o.member_id = m.id and o.status = 'paid') as spent,
           (select coalesce(sum(delta), 0) from lucana.points_ledger l where l.member_id = m.id and l.kind in ('game_bet','game_win','game_refund')) as game_net,
           (select t.name from lucana.table_presence p join lucana.tables t on t.id = p.table_id
             where p.member_id = m.id and p.left_at is null and p.last_seen > now() - interval '4 hours' limit 1) as at_table
    from lucana.members m
    where p_q is null or p_q = '' or m.nickname ilike '%' || p_q || '%' or m.username ilike '%' || p_q || '%'
    order by m.last_seen_at desc limit least(greatest(p_limit, 1), 500)) x), '[]'::json);
end;
$$;

create or replace function lucana.adm_member_detail(p_member uuid)
returns json language plpgsql stable security definer set search_path = lucana as $$
declare v_id uuid := lucana._require(60);
begin
  return json_build_object(
    'member', lucana._member_json(p_member),
    'ledger', coalesce((select json_agg(x) from (
      select l.delta, l.kind, l.note, l.balance_after, l.at, (select full_name from lucana.staff s where s.id = l.staff_id) as staff
      from lucana.points_ledger l where l.member_id = p_member order by l.at desc limit 100) x), '[]'::json));
end;
$$;

create or replace function lucana.adm_member_points(p_member uuid, p_delta int, p_reason text)
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_id uuid := lucana._require(80); v_nick text;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Açıklama yazın'; end if;
  if abs(p_delta) > 1000000 then raise exception 'Geçersiz miktar'; end if;
  perform lucana._points_add(p_member, p_delta, 'admin', null, trim(p_reason), v_id);
  select nickname into v_nick from lucana.members where id = p_member;
  perform lucana._audit(v_id, 'update', 'member', format('%s: %s%s puan (%s)', v_nick, case when p_delta > 0 then '+' else '' end, p_delta, p_reason));
  return lucana._member_json(p_member);
end;
$$;

create or replace function lucana.adm_member_ban(p_member uuid, p_banned boolean)
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_id uuid := lucana._require(80); v_nick text;
begin
  update lucana.members set is_banned = p_banned where id = p_member returning nickname into v_nick;
  perform lucana._audit(v_id, 'update', 'member', format('%s %s', v_nick, case when p_banned then 'kısıtlandı' else 'kısıtlaması kaldırıldı' end));
  return json_build_object('ok', true);
end;
$$;

-- Ayarlar: yeni anahtarlar + sayı doğrulama
create or replace function lucana.adm_settings_save(p jsonb)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare
  v_id   uuid := lucana._require(80);
  v_keys text[] := array['name','tagline','phone','address','hours','instagram','maps_url','maps_embed',
                         'announcement','ordering_enabled','calls_enabled','wifi_name','wifi_pass',
                         'about','currency',
                         'points_per_tl','redeem_points_per_tl','max_discount_pct','social_feed_enabled',
                         'games_enabled','game_min_bet','game_max_bet','game_daily_loss_limit','skill_daily_cap'];
  v_clean jsonb;
begin
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_clean
  from jsonb_each(coalesce(p, '{}'::jsonb)) where key = any(v_keys);

  if v_clean ? 'points_per_tl' and ((v_clean->>'points_per_tl')::numeric < 0 or (v_clean->>'points_per_tl')::numeric > 1000) then
    raise exception 'Kazanma oranı 0-1000 arası olmalı'; end if;
  if v_clean ? 'redeem_points_per_tl' and ((v_clean->>'redeem_points_per_tl')::numeric < 1 or (v_clean->>'redeem_points_per_tl')::numeric > 100000) then
    raise exception 'Harcama oranı 1-100000 arası olmalı'; end if;
  if v_clean ? 'max_discount_pct' and ((v_clean->>'max_discount_pct')::numeric < 0 or (v_clean->>'max_discount_pct')::numeric > 100) then
    raise exception 'En fazla indirim yüzdesi 0-100 arası olmalı'; end if;
  if v_clean ? 'game_min_bet' and (v_clean->>'game_min_bet')::numeric < 1 then raise exception 'En az bahis 1 olmalı'; end if;
  if v_clean ? 'game_max_bet' and (v_clean->>'game_max_bet')::numeric < coalesce((v_clean->>'game_min_bet')::numeric, lucana._setting_num('game_min_bet', 10)) then
    raise exception 'En fazla bahis en azdan küçük olamaz'; end if;

  update lucana.settings set data = data || v_clean, updated_at = now() where id = 1;
  perform lucana._audit(v_id, 'update', 'settings', 'Ayarlar güncellendi: ' ||
    (select string_agg(k, ', ') from jsonb_object_keys(v_clean) k));
  return (select data::json from lucana.settings where id = 1);
end;
$$;
