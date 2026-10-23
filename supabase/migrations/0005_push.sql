-- =============================================================
--  Lucana — 0005 Web Push bildirimleri (VAPID)
--
--  Akış: sipariş/çağrı/durum değişikliği olur → lucana._push()
--  hedef abonelikleri seçer → pg_net ile lucana-push Edge
--  Function'a gönderir (gizli header ile) → web-push.
--  Böylece uygulama/telefon kapalıyken bile bildirim gider.
--
--  Kime ne gider:
--   * Personel (abone olmuş, aktif): yeni sipariş, garson/köz/hesap çağrısı
--   * Müşteri cihazı (QR sayfasında izin vermişse): kendi siparişinin durumu
-- =============================================================

create extension if not exists pg_net;

-- Sunucu tarafı yapılandırma (fonksiyon adresi + gizli anahtar).
-- RLS açık, hiçbir rol yetkisi yok → yalnızca SECURITY DEFINER fonksiyonlar okur.
create table if not exists lucana.app_config (
  key   text primary key,
  value text not null
);
alter table lucana.app_config enable row level security;

create table if not exists lucana.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  kind       text not null check (kind in ('staff','customer')),
  staff_id   uuid references lucana.staff(id) on delete cascade,
  device_id  text,
  table_id   uuid references lucana.tables(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index if not exists push_subs_kind_idx on lucana.push_subscriptions(kind);
create index if not exists push_subs_device_idx on lucana.push_subscriptions(device_id);
alter table lucana.push_subscriptions enable row level security;

create or replace function lucana._valid_push(p_endpoint text, p_p256dh text, p_auth text)
returns boolean language sql immutable as $$
  select p_endpoint ~ '^https://\S+$' and length(p_endpoint) between 20 and 1000
     and p_p256dh ~ '^[A-Za-z0-9_-]{60,120}=*$'
     and p_auth   ~ '^[A-Za-z0-9_-]{10,40}=*$';
$$;

-- -------------------------------------------------------------
--  Gönderim çekirdeği
-- -------------------------------------------------------------
create or replace function lucana._push(
  p_audience text,          -- 'staff' | 'device'
  p_device   text,
  p_title    text,
  p_body     text,
  p_url      text,
  p_tag      text,
  p_min_level int default 0)
returns void language plpgsql volatile security definer
set search_path = lucana, extensions as $$
declare
  v_url    text;
  v_secret text;
  v_subs   jsonb;
begin
  select value into v_url    from lucana.app_config where key = 'push_url';
  select value into v_secret from lucana.app_config where key = 'push_secret';
  if v_url is null or v_secret is null then return; end if;

  if p_audience = 'staff' then
    select jsonb_agg(jsonb_build_object('id', ps.id, 'endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth))
      into v_subs
    from lucana.push_subscriptions ps
    join lucana.staff s on s.id = ps.staff_id and s.is_active
    join lucana.roles r on r.id = s.role_id and r.level >= p_min_level
    where ps.kind = 'staff';
  else
    select jsonb_agg(jsonb_build_object('id', ps.id, 'endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth))
      into v_subs
    from lucana.push_subscriptions ps
    where ps.kind = 'customer' and ps.device_id = p_device;
  end if;

  if v_subs is null then return; end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'subs', v_subs,
      'notification', jsonb_build_object('title', p_title, 'body', left(p_body, 240), 'url', p_url, 'tag', p_tag)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 8000);
exception when others then
  null; -- bildirim hatası asla siparişi/çağrıyı bozmasın
end;
$$;

-- -------------------------------------------------------------
--  Abonelik RPC'leri
-- -------------------------------------------------------------
create or replace function lucana.staff_push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(0);
begin
  if not lucana._valid_push(p_endpoint, p_p256dh, p_auth) then raise exception 'Geçersiz abonelik'; end if;
  insert into lucana.push_subscriptions(endpoint, p256dh, auth, kind, staff_id)
  values (p_endpoint, p_p256dh, p_auth, 'staff', v_id)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, kind = 'staff', staff_id = v_id,
        device_id = null, table_id = null, last_seen = now();
  return json_build_object('ok', true);
end;
$$;

-- Çıkışta / kapatmada: yalnızca kendi aboneliğini silebilir
create or replace function lucana.push_unsubscribe(p_endpoint text)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
begin
  delete from lucana.push_subscriptions
  where endpoint = p_endpoint
    and (kind = 'customer' or staff_id = lucana._sid() or lucana._sid() is null);
  return json_build_object('ok', true);
end;
$$;

-- Müşteri: QR masa sayfasında "durum bildirimi al"
create or replace function lucana.pub_push_subscribe(p_code text, p_device text, p_endpoint text, p_p256dh text, p_auth text)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_table uuid;
begin
  if not lucana._valid_device(p_device) then raise exception 'Geçersiz cihaz'; end if;
  if not lucana._valid_push(p_endpoint, p_p256dh, p_auth) then raise exception 'Geçersiz abonelik'; end if;
  select id into v_table from lucana.tables where code = p_code and is_active;
  if v_table is null then raise exception 'Masa bulunamadı'; end if;
  -- personel cihazını müşteriye çevirme
  if exists (select 1 from lucana.push_subscriptions where endpoint = p_endpoint and kind = 'staff') then
    return json_build_object('ok', true, 'staff', true);
  end if;
  insert into lucana.push_subscriptions(endpoint, p256dh, auth, kind, device_id, table_id)
  values (p_endpoint, p_p256dh, p_auth, 'customer', p_device, v_table)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, device_id = p_device, table_id = v_table, last_seen = now();
  -- eski müşteri aboneliklerini temizle
  delete from lucana.push_subscriptions where kind = 'customer' and last_seen < now() - interval '30 days';
  return json_build_object('ok', true);
end;
$$;

-- Personel: "test bildirimi gönder"
create or replace function lucana.staff_push_test()
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(0); v_n int;
begin
  select count(*) into v_n from lucana.push_subscriptions where staff_id = v_id;
  if v_n = 0 then raise exception 'Bu hesapta kayıtlı bildirim aboneliği yok'; end if;
  if not exists (select 1 from lucana.app_config where key = 'push_url') then
    raise exception 'Bildirim sunucusu yapılandırılmamış';
  end if;
  perform net.http_post(
    url := (select value from lucana.app_config where key = 'push_url'),
    body := jsonb_build_object(
      'subs', (select jsonb_agg(jsonb_build_object('id', id, 'endpoint', endpoint, 'p256dh', p256dh, 'auth', auth))
               from lucana.push_subscriptions where staff_id = v_id),
      'notification', jsonb_build_object('title', 'Lucana 🔔', 'body', 'Bildirimler çalışıyor! Yeni sipariş ve çağrılar buraya gelecek.',
                                         'url', 'panel', 'tag', 'test')),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-push-secret', (select value from lucana.app_config where key = 'push_secret')),
    timeout_milliseconds := 8000);
  return json_build_object('ok', true, 'devices', v_n);
end;
$$;

-- -------------------------------------------------------------
--  Olay kancaları: mevcut fonksiyonların sonunda _push çağrılır
-- -------------------------------------------------------------

-- Yeni sipariş → personele
create or replace function lucana._notify_order_new(p_order uuid)
returns void language plpgsql volatile security definer
set search_path = lucana as $$
declare v_o lucana.orders%rowtype; v_items text;
begin
  select * into v_o from lucana.orders where id = p_order;
  if v_o.source <> 'qr' then return; end if; -- personelin girdiği siparişe bildirim gerekmez
  select string_agg(qty || '× ' || name, ', ' order by name) into v_items from lucana.order_items where order_id = p_order;
  perform lucana._push('staff', null,
    format('🛎️ Yeni sipariş #%s · %s', v_o.no, coalesce(v_o.table_label, 'Masa')),
    v_items || case when v_o.note is not null then ' — Not: ' || v_o.note else '' end,
    'panel/siparisler', 'order-' || v_o.id, 30);
end;
$$;

-- Çağrı → personele (garson ve üstü)
create or replace function lucana._notify_call(p_call uuid)
returns void language plpgsql volatile security definer
set search_path = lucana as $$
declare v_type text; v_table text;
begin
  select c.type, t.name into v_type, v_table
  from lucana.waiter_calls c join lucana.tables t on t.id = c.table_id where c.id = p_call;
  perform lucana._push('staff', null,
    case v_type when 'coal' then '🔥 Köz değişimi' when 'bill' then '🧾 Hesap isteniyor'
                when 'waiter' then '🙋 Garson çağrısı' else '💬 Çağrı' end || ' · ' || v_table,
    v_table || ' sizi bekliyor', 'panel/masalar', 'call-' || p_call, 40);
end;
$$;

-- Sipariş durumu → müşteriye
create or replace function lucana._notify_order_status(p_order uuid)
returns void language plpgsql volatile security definer
set search_path = lucana as $$
declare v_o lucana.orders%rowtype; v_code text;
begin
  select * into v_o from lucana.orders where id = p_order;
  if v_o.device_id is null or v_o.status not in ('preparing','served','cancelled') then return; end if;
  if v_o.status = 'cancelled' and v_o.cancel_reason = 'Müşteri iptal etti' then return; end if;
  select code into v_code from lucana.tables where id = v_o.table_id;
  perform lucana._push('device', v_o.device_id,
    case v_o.status when 'preparing' then '👨‍🍳 Siparişiniz hazırlanıyor'
                    when 'served' then '✨ Siparişiniz servis edildi'
                    else 'Siparişiniz iptal edildi' end,
    format('Sipariş #%s · %s', v_o.no, coalesce(v_o.table_label, '')) ||
      case when v_o.status = 'served' then ' — Afiyet olsun!' else '' end,
    'm/' || coalesce(v_code, ''), 'order-' || v_o.id);
end;
$$;

-- Tetikleyiciler: fonksiyonların içine dokunmadan olayları yakalar
create or replace function lucana._trg_orders_push()
returns trigger language plpgsql security definer
set search_path = lucana as $$
begin
  -- yeni QR sipariş: _order_insert toplamı yazdığında (kalemler eklenmiş olur)
  if tg_op = 'UPDATE' and old.total = 0 and new.total > 0 and old.status = 'new' and new.status = 'new' then
    perform lucana._notify_order_new(new.id);
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    perform lucana._notify_order_status(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists orders_push on lucana.orders;
create trigger orders_push after update on lucana.orders
for each row execute function lucana._trg_orders_push();

create or replace function lucana._trg_calls_push()
returns trigger language plpgsql security definer
set search_path = lucana as $$
begin
  perform lucana._notify_call(new.id);
  return null;
end;
$$;

drop trigger if exists calls_push on lucana.waiter_calls;
create trigger calls_push after insert on lucana.waiter_calls
for each row execute function lucana._trg_calls_push();
