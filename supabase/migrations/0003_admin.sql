-- =============================================================
--  Lucana — 0003 Yönetim paneli RPC'leri
--
--  Yetki seviyeleri:
--    100 Kurucu   → her şey
--     80 Müdür    → menü, stok tanımları, masalar, ayarlar, personel (alt seviyeler)
--     60 Kasiyer  → ödeme alma, iptal, ciro raporu
--     40 Garson   → sipariş girme, çağrılar, stok hareketi, ürünü "tükendi" yapma
--     30 Mutfak/Bar → sipariş durumunu ilerletme
-- =============================================================

-- -------------------------------------------------------------
--  DASHBOARD
-- -------------------------------------------------------------
create or replace function lucana.adm_overview()
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare
  v_id    uuid := lucana._require(30);
  v_money boolean := lucana._level(v_id) >= 60;
  v_today date := lucana._biz_day(now());
begin
  return json_build_object(
    'biz_day', v_today,
    'today', (
      select json_build_object(
        'orders',    count(*) filter (where status <> 'cancelled'),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'revenue',   case when v_money then coalesce(sum(total) filter (where status = 'paid'), 0) end,
        'open_total',case when v_money then coalesce(sum(total) filter (where status in ('new','preparing','served')), 0) end,
        'avg_ticket',case when v_money then coalesce(round(avg(total) filter (where status = 'paid'), 2), 0) end)
      from lucana.orders where biz_day = v_today),
    'active', (
      select json_build_object(
        'new',       count(*) filter (where status = 'new'),
        'preparing', count(*) filter (where status = 'preparing'),
        'served',    count(*) filter (where status = 'served'))
      from lucana.orders where status in ('new','preparing','served')),
    'calls_open', (select count(*) from lucana.waiter_calls where status = 'open'),
    'tables_busy', (select count(distinct table_id) from lucana.orders
                    where status in ('new','preparing','served') and table_id is not null),
    'tables_total', (select count(*) from lucana.tables where is_active),
    'low_stock', coalesce((
      select json_agg(x order by x.ratio) from (
        select 'menu' as kind, id, name, stock::numeric as qty, low_stock::numeric as critical, 'adet' as unit,
               case when low_stock > 0 then stock::numeric / low_stock else 0 end as ratio
        from lucana.menu_items where track_stock and is_active and stock <= low_stock
        union all
        select 'inventory', id, name, qty, critical, unit,
               case when critical > 0 then qty / critical else 0 end
        from lucana.inventory_items where qty <= critical
        limit 30) x), '[]'::json),
    'week', case when v_money then (
      select json_agg(json_build_object('day', d::date, 'revenue', coalesce(s.revenue, 0), 'orders', coalesce(s.orders, 0)) order by d)
      from generate_series(v_today - 6, v_today, interval '1 day') d
      left join (select biz_day, sum(total) filter (where status = 'paid') as revenue,
                        count(*) filter (where status <> 'cancelled') as orders
                 from lucana.orders where biz_day >= v_today - 6 group by biz_day) s on s.biz_day = d::date) end,
    'top_today', coalesce((
      select json_agg(t) from (
        select oi.name, sum(oi.qty)::int as qty
        from lucana.order_items oi join lucana.orders o on o.id = oi.order_id
        where o.biz_day = v_today and o.status <> 'cancelled'
        group by oi.name order by 2 desc limit 6) t), '[]'::json));
end;
$$;

-- -------------------------------------------------------------
--  SİPARİŞLER
-- -------------------------------------------------------------
create or replace function lucana._order_json(o lucana.orders)
returns json language sql stable security definer
set search_path = lucana as $$
  select json_build_object(
    'id', o.id, 'no', o.no, 'biz_day', o.biz_day, 'status', o.status, 'source', o.source,
    'table_id', o.table_id, 'table_label', coalesce(t.name, o.table_label), 'area', t.area,
    'note', o.note, 'total', o.total, 'payment_method', o.payment_method,
    'cancel_reason', o.cancel_reason, 'created_at', o.created_at, 'updated_at', o.updated_at,
    'paid_at', o.paid_at,
    'created_by', (select full_name from lucana.staff where id = o.created_by),
    'handled_by', (select full_name from lucana.staff where id = o.handled_by),
    'items', coalesce((select json_agg(json_build_object(
                 'id', oi.id, 'name', oi.name, 'qty', oi.qty, 'unit_price', oi.unit_price, 'note', oi.note)
               order by oi.name) from lucana.order_items oi where oi.order_id = o.id), '[]'::json))
  from (select 1) _ left join lucana.tables t on t.id = o.table_id;
$$;

create or replace function lucana.adm_orders(p_scope text default 'active', p_day date default null)
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(30); v_day date := coalesce(p_day, lucana._biz_day(now()));
begin
  if p_scope = 'active' then
    return coalesce((select json_agg(lucana._order_json(o) order by o.created_at)
                     from lucana.orders o where o.status in ('new','preparing','served')), '[]'::json);
  end if;
  return coalesce((select json_agg(lucana._order_json(o) order by o.created_at desc)
                   from lucana.orders o where o.biz_day = v_day), '[]'::json);
end;
$$;

create or replace function lucana.adm_order_status(
  p_id uuid, p_status text, p_payment text default null, p_reason text default null)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare
  v_id  uuid := lucana._require(30);
  v_lv  int  := lucana._level(v_id);
  v_o   lucana.orders%rowtype;
begin
  select * into v_o from lucana.orders where id = p_id for update;
  if v_o.id is null then raise exception 'Sipariş bulunamadı'; end if;
  if v_o.status = p_status then return json_build_object('ok', true); end if;
  if v_o.status in ('paid','cancelled') then
    raise exception 'Kapanmış sipariş değiştirilemez';
  end if;

  if p_status in ('new','preparing','served') then
    null; -- seviye 30+ yeterli
  elsif p_status = 'paid' then
    if v_lv < 60 then raise exception 'Ödeme almak için kasiyer yetkisi gerekir'; end if;
    if coalesce(p_payment, '') not in ('cash','card','other') then raise exception 'Ödeme yöntemi seçin'; end if;
  elsif p_status = 'cancelled' then
    if v_lv < 60 then raise exception 'İptal için kasiyer yetkisi gerekir'; end if;
    if length(trim(coalesce(p_reason, ''))) < 2 then raise exception 'İptal nedeni yazın'; end if;
    perform lucana._order_restock(v_o.id, v_id);
  else
    raise exception 'Geçersiz durum';
  end if;

  update lucana.orders set
    status = p_status,
    payment_method = case when p_status = 'paid' then p_payment else payment_method end,
    paid_at = case when p_status = 'paid' then now() else paid_at end,
    cancel_reason = case when p_status = 'cancelled' then left(trim(p_reason), 200) else cancel_reason end,
    handled_by = v_id,
    updated_at = now()
  where id = v_o.id;

  if p_status in ('paid','cancelled') then
    perform lucana._audit(v_id, p_status, 'order',
      format('Sipariş #%s (%s) → %s%s', v_o.no, coalesce(v_o.table_label, '-'),
             case p_status when 'paid' then 'ödendi (' || p_payment || ', ' || v_o.total || '₺)'
                           else 'iptal: ' || p_reason end, ''));
  end if;

  perform lucana._ping('lucana-staff');
  if v_o.table_id is not null then perform lucana._ping('lucana-t-' || v_o.table_id); end if;
  return json_build_object('ok', true);
end;
$$;

-- Garson panelden sipariş girer (hız sınırı yok)
create or replace function lucana.adm_order_create(p_table uuid, p_items jsonb, p_note text default null)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(40); v_res json;
begin
  if p_table is not null and not exists (select 1 from lucana.tables where id = p_table) then
    raise exception 'Masa bulunamadı';
  end if;
  v_res := lucana._order_insert(p_table, null, p_items, p_note, v_id, 'staff');
  return v_res;
end;
$$;

-- -------------------------------------------------------------
--  MASALAR (canlı durum) + HESAP KAPATMA
-- -------------------------------------------------------------
create or replace function lucana.adm_tables_live()
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(30);
begin
  return coalesce((
    select json_agg(json_build_object(
      'id', t.id, 'name', t.name, 'area', t.area, 'is_active', t.is_active,
      'open_orders', coalesce(o.cnt, 0), 'open_total', coalesce(o.total, 0),
      'since', o.since, 'calls', coalesce(c.cnt, 0)) order by t.sort, t.name)
    from lucana.tables t
    left join (select table_id, count(*) cnt, sum(total) total, min(created_at) since
               from lucana.orders where status in ('new','preparing','served') group by table_id) o
      on o.table_id = t.id
    left join (select table_id, count(*) cnt from lucana.waiter_calls where status = 'open' group by table_id) c
      on c.table_id = t.id
    where t.is_active), '[]'::json);
end;
$$;

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
  if v_n > 0 then
    perform lucana._audit(v_id, 'paid', 'table', format('%s hesabı kapatıldı: %s sipariş, %s₺ (%s)', v_name, v_n, v_sum, p_payment));
  end if;
  perform lucana._ping('lucana-staff');
  perform lucana._ping('lucana-t-' || p_table);
  return json_build_object('orders', v_n, 'total', v_sum);
end;
$$;

-- -------------------------------------------------------------
--  ÇAĞRILAR
-- -------------------------------------------------------------
create or replace function lucana.adm_calls()
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(30);
begin
  return coalesce((
    select json_agg(json_build_object(
      'id', c.id, 'type', c.type, 'note', c.note, 'created_at', c.created_at,
      'table_id', t.id, 'table_name', t.name, 'area', t.area) order by c.created_at)
    from lucana.waiter_calls c join lucana.tables t on t.id = c.table_id
    where c.status = 'open'), '[]'::json);
end;
$$;

create or replace function lucana.adm_call_done(p_id uuid)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(30); v_table uuid;
begin
  update lucana.waiter_calls set status = 'done', done_at = now(), done_by = v_id
  where id = p_id and status = 'open' returning table_id into v_table;
  perform lucana._ping('lucana-staff');
  if v_table is not null then perform lucana._ping('lucana-t-' || v_table); end if;
  return json_build_object('ok', true);
end;
$$;

-- -------------------------------------------------------------
--  MENÜ YÖNETİMİ
-- -------------------------------------------------------------
create or replace function lucana.adm_menu()
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(30);
begin
  return json_build_object(
    'categories', coalesce((select json_agg(c order by c.sort, c.name) from lucana.menu_categories c), '[]'::json),
    'items', coalesce((select json_agg(i order by i.sort, i.name) from lucana.menu_items i), '[]'::json));
end;
$$;

create or replace function lucana.adm_category_save(p jsonb)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80); v_cat uuid := nullif(p->>'id', '')::uuid; v_name text := trim(p->>'name');
begin
  if coalesce(v_name, '') = '' then raise exception 'Kategori adı gerekli'; end if;
  if v_cat is null then
    insert into lucana.menu_categories(name, description, icon, image_url, sort, is_active)
    values (v_name, nullif(trim(p->>'description'), ''), nullif(p->>'icon', ''), nullif(p->>'image_url', ''),
            coalesce((p->>'sort')::int, (select coalesce(max(sort), 0) + 10 from lucana.menu_categories)),
            coalesce((p->>'is_active')::boolean, true))
    returning id into v_cat;
    perform lucana._audit(v_id, 'create', 'menu_category', 'Kategori eklendi: ' || v_name);
  else
    update lucana.menu_categories set
      name = v_name,
      description = nullif(trim(p->>'description'), ''),
      icon = nullif(p->>'icon', ''),
      image_url = nullif(p->>'image_url', ''),
      sort = coalesce((p->>'sort')::int, sort),
      is_active = coalesce((p->>'is_active')::boolean, is_active)
    where id = v_cat;
    perform lucana._audit(v_id, 'update', 'menu_category', 'Kategori güncellendi: ' || v_name);
  end if;
  return json_build_object('id', v_cat);
end;
$$;

create or replace function lucana.adm_category_delete(p_id uuid)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80); v_name text;
begin
  if exists (select 1 from lucana.menu_items where category_id = p_id) then
    raise exception 'Kategoride ürün var. Önce ürünleri silin veya başka kategoriye taşıyın.';
  end if;
  delete from lucana.menu_categories where id = p_id returning name into v_name;
  perform lucana._audit(v_id, 'delete', 'menu_category', 'Kategori silindi: ' || coalesce(v_name, '?'));
  return json_build_object('ok', true);
end;
$$;

create or replace function lucana.adm_item_save(p jsonb)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare
  v_id    uuid := lucana._require(80);
  v_item  uuid := nullif(p->>'id', '')::uuid;
  v_name  text := trim(p->>'name');
  v_price numeric := (p->>'price')::numeric;
  v_tags  text[] := coalesce((select array_agg(trim(x)) from jsonb_array_elements_text(coalesce(p->'tags', '[]'::jsonb)) x
                              where trim(x) <> ''), '{}');
begin
  if coalesce(v_name, '') = '' then raise exception 'Ürün adı gerekli'; end if;
  if v_price is null or v_price < 0 then raise exception 'Geçerli bir fiyat girin'; end if;
  if not exists (select 1 from lucana.menu_categories where id = (p->>'category_id')::uuid) then
    raise exception 'Kategori seçin';
  end if;

  if v_item is null then
    insert into lucana.menu_items(category_id, name, description, price, image_url, tags, is_active,
                                  is_featured, track_stock, stock, low_stock, sort)
    values ((p->>'category_id')::uuid, v_name, nullif(trim(p->>'description'), ''), v_price,
            nullif(p->>'image_url', ''), v_tags,
            coalesce((p->>'is_active')::boolean, true), coalesce((p->>'is_featured')::boolean, false),
            coalesce((p->>'track_stock')::boolean, false), greatest(coalesce((p->>'stock')::int, 0), 0),
            greatest(coalesce((p->>'low_stock')::int, 5), 0),
            coalesce((p->>'sort')::int, (select coalesce(max(sort), 0) + 10 from lucana.menu_items
                                         where category_id = (p->>'category_id')::uuid)))
    returning id into v_item;
    perform lucana._audit(v_id, 'create', 'menu_item', format('Ürün eklendi: %s (%s₺)', v_name, v_price));
  else
    update lucana.menu_items set
      category_id = (p->>'category_id')::uuid,
      name = v_name,
      description = nullif(trim(p->>'description'), ''),
      price = v_price,
      image_url = nullif(p->>'image_url', ''),
      tags = v_tags,
      is_active = coalesce((p->>'is_active')::boolean, is_active),
      is_featured = coalesce((p->>'is_featured')::boolean, is_featured),
      track_stock = coalesce((p->>'track_stock')::boolean, track_stock),
      low_stock = greatest(coalesce((p->>'low_stock')::int, low_stock), 0),
      sort = coalesce((p->>'sort')::int, sort),
      updated_at = now()
    where id = v_item;
    perform lucana._audit(v_id, 'update', 'menu_item', format('Ürün güncellendi: %s (%s₺)', v_name, v_price));
  end if;
  return json_build_object('id', v_item);
end;
$$;

create or replace function lucana.adm_item_delete(p_id uuid)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80); v_name text;
begin
  delete from lucana.menu_items where id = p_id returning name into v_name;
  perform lucana._audit(v_id, 'delete', 'menu_item', 'Ürün silindi: ' || coalesce(v_name, '?'));
  return json_build_object('ok', true);
end;
$$;

-- Hızlı aç/kapa: garson ürünü "tükendi" yapabilir, öne çıkarma müdür ister
create or replace function lucana.adm_item_toggle(p_id uuid, p_field text, p_value boolean)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(40); v_name text;
begin
  if p_field = 'is_active' then
    update lucana.menu_items set is_active = p_value, updated_at = now() where id = p_id returning name into v_name;
  elsif p_field = 'is_featured' then
    perform lucana._require(80);
    update lucana.menu_items set is_featured = p_value, updated_at = now() where id = p_id returning name into v_name;
  else
    raise exception 'Geçersiz alan';
  end if;
  perform lucana._audit(v_id, 'update', 'menu_item',
    format('%s → %s: %s', v_name, p_field, case when p_value then 'açık' else 'kapalı' end));
  return json_build_object('ok', true);
end;
$$;

create or replace function lucana.adm_item_stock(p_id uuid, p_mode text, p_value int, p_reason text default null)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(40); v_item lucana.menu_items%rowtype; v_delta int;
begin
  select * into v_item from lucana.menu_items where id = p_id for update;
  if v_item.id is null then raise exception 'Ürün bulunamadı'; end if;
  if p_mode = 'set' then
    if p_value < 0 then raise exception 'Stok negatif olamaz'; end if;
    v_delta := p_value - v_item.stock;
  elsif p_mode = 'add' then
    v_delta := p_value;
    if v_item.stock + v_delta < 0 then raise exception 'Stok negatif olamaz'; end if;
  else
    raise exception 'Geçersiz işlem';
  end if;
  if v_delta = 0 then return json_build_object('stock', v_item.stock); end if;
  update lucana.menu_items set stock = stock + v_delta, track_stock = true, updated_at = now() where id = p_id;
  insert into lucana.stock_moves(kind, ref_id, ref_name, delta, reason, staff_id)
  values ('menu', p_id, v_item.name, v_delta, coalesce(nullif(trim(p_reason), ''), 'Manuel düzeltme'), v_id);
  return json_build_object('stock', v_item.stock + v_delta);
end;
$$;

create or replace function lucana.adm_menu_reorder(p_kind text, p_ids uuid[])
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80);
begin
  if p_kind = 'category' then
    update lucana.menu_categories c set sort = x.ord * 10
    from unnest(p_ids) with ordinality x(id, ord) where c.id = x.id;
  elsif p_kind = 'item' then
    update lucana.menu_items i set sort = x.ord * 10
    from unnest(p_ids) with ordinality x(id, ord) where i.id = x.id;
  end if;
  return json_build_object('ok', true);
end;
$$;

-- -------------------------------------------------------------
--  DEPO STOĞU
-- -------------------------------------------------------------
create or replace function lucana.adm_inventory()
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(30);
begin
  return coalesce((
    select json_agg(json_build_object(
      'id', i.id, 'name', i.name, 'category', i.category, 'unit', i.unit, 'qty', i.qty,
      'critical', i.critical, 'note', i.note, 'updated_at', i.updated_at,
      'updated_by', (select full_name from lucana.staff where id = i.updated_by))
      order by i.category, i.name)
    from lucana.inventory_items i), '[]'::json);
end;
$$;

create or replace function lucana.adm_inventory_save(p jsonb)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80); v_inv uuid := nullif(p->>'id', '')::uuid; v_name text := trim(p->>'name');
begin
  if coalesce(v_name, '') = '' then raise exception 'Malzeme adı gerekli'; end if;
  if v_inv is null then
    insert into lucana.inventory_items(name, category, unit, qty, critical, note, updated_by)
    values (v_name, coalesce(nullif(trim(p->>'category'), ''), 'Genel'), coalesce(nullif(trim(p->>'unit'), ''), 'adet'),
            greatest(coalesce((p->>'qty')::numeric, 0), 0), greatest(coalesce((p->>'critical')::numeric, 0), 0),
            nullif(trim(p->>'note'), ''), v_id)
    returning id into v_inv;
    perform lucana._audit(v_id, 'create', 'inventory', 'Depo kalemi eklendi: ' || v_name);
  else
    update lucana.inventory_items set
      name = v_name,
      category = coalesce(nullif(trim(p->>'category'), ''), category),
      unit = coalesce(nullif(trim(p->>'unit'), ''), unit),
      critical = greatest(coalesce((p->>'critical')::numeric, critical), 0),
      note = nullif(trim(p->>'note'), ''),
      updated_by = v_id, updated_at = now()
    where id = v_inv;
    perform lucana._audit(v_id, 'update', 'inventory', 'Depo kalemi güncellendi: ' || v_name);
  end if;
  return json_build_object('id', v_inv);
end;
$$;

create or replace function lucana.adm_inventory_delete(p_id uuid)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80); v_name text;
begin
  delete from lucana.inventory_items where id = p_id returning name into v_name;
  perform lucana._audit(v_id, 'delete', 'inventory', 'Depo kalemi silindi: ' || coalesce(v_name, '?'));
  return json_build_object('ok', true);
end;
$$;

create or replace function lucana.adm_inventory_move(p_id uuid, p_delta numeric, p_reason text default null)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(40); v_inv lucana.inventory_items%rowtype;
begin
  select * into v_inv from lucana.inventory_items where id = p_id for update;
  if v_inv.id is null then raise exception 'Kalem bulunamadı'; end if;
  if p_delta = 0 then return json_build_object('qty', v_inv.qty); end if;
  if v_inv.qty + p_delta < 0 then raise exception 'Stok negatif olamaz (mevcut: % %)', v_inv.qty, v_inv.unit; end if;
  update lucana.inventory_items set qty = qty + p_delta, updated_by = v_id, updated_at = now() where id = p_id;
  insert into lucana.stock_moves(kind, ref_id, ref_name, delta, reason, staff_id)
  values ('inventory', p_id, v_inv.name, p_delta,
          coalesce(nullif(trim(p_reason), ''), case when p_delta > 0 then 'Giriş' else 'Çıkış' end), v_id);
  return json_build_object('qty', v_inv.qty + p_delta);
end;
$$;

create or replace function lucana.adm_stock_moves(p_ref uuid default null, p_limit int default 100)
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(40);
begin
  return coalesce((
    select json_agg(x) from (
      select m.id, m.kind, m.ref_id, m.ref_name, m.delta, m.reason, m.at,
             (select full_name from lucana.staff where id = m.staff_id) as staff
      from lucana.stock_moves m
      where p_ref is null or m.ref_id = p_ref
      order by m.at desc limit least(greatest(p_limit, 1), 500)) x), '[]'::json);
end;
$$;

-- -------------------------------------------------------------
--  MASALAR & QR
-- -------------------------------------------------------------
create or replace function lucana.adm_tables()
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80);
begin
  return coalesce((select json_agg(t order by t.sort, t.name) from lucana.tables t), '[]'::json);
end;
$$;

create or replace function lucana.adm_table_save(p jsonb)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80); v_t uuid := nullif(p->>'id', '')::uuid; v_name text := trim(p->>'name');
begin
  if coalesce(v_name, '') = '' then raise exception 'Masa adı gerekli'; end if;
  if v_t is null then
    insert into lucana.tables(name, area, code, is_active, sort)
    values (v_name, coalesce(nullif(trim(p->>'area'), ''), 'Salon'), lucana._new_table_code(),
            coalesce((p->>'is_active')::boolean, true),
            coalesce((p->>'sort')::int, (select coalesce(max(sort), 0) + 10 from lucana.tables)))
    returning id into v_t;
    perform lucana._audit(v_id, 'create', 'table', 'Masa eklendi: ' || v_name);
  else
    update lucana.tables set name = v_name, area = coalesce(nullif(trim(p->>'area'), ''), area),
           is_active = coalesce((p->>'is_active')::boolean, is_active), sort = coalesce((p->>'sort')::int, sort)
    where id = v_t;
    perform lucana._audit(v_id, 'update', 'table', 'Masa güncellendi: ' || v_name);
  end if;
  return json_build_object('id', v_t);
end;
$$;

create or replace function lucana.adm_tables_bulk(p_area text, p_prefix text, p_from int, p_to int)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80); i int; v_base int;
begin
  if p_to < p_from or p_to - p_from > 99 then raise exception 'En fazla 100 masa eklenebilir'; end if;
  select coalesce(max(sort), 0) into v_base from lucana.tables;
  for i in p_from..p_to loop
    insert into lucana.tables(name, area, code, sort)
    values (trim(coalesce(p_prefix, 'Masa')) || ' ' || i, coalesce(nullif(trim(p_area), ''), 'Salon'),
            lucana._new_table_code(), v_base + (i - p_from + 1) * 10);
  end loop;
  perform lucana._audit(v_id, 'create', 'table', format('%s masa eklendi (%s)', p_to - p_from + 1, p_area));
  return json_build_object('ok', true);
end;
$$;

create or replace function lucana.adm_table_delete(p_id uuid)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80); v_name text;
begin
  if exists (select 1 from lucana.orders where table_id = p_id and status in ('new','preparing','served')) then
    raise exception 'Masada açık hesap var, önce hesabı kapatın';
  end if;
  delete from lucana.tables where id = p_id returning name into v_name;
  perform lucana._audit(v_id, 'delete', 'table', 'Masa silindi: ' || coalesce(v_name, '?'));
  return json_build_object('ok', true);
end;
$$;

-- QR kodunu yenile (eski QR'lar anında geçersiz olur)
create or replace function lucana.adm_table_regen(p_id uuid)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80); v_code text := lucana._new_table_code(); v_name text;
begin
  update lucana.tables set code = v_code where id = p_id returning name into v_name;
  perform lucana._audit(v_id, 'update', 'table', 'QR kodu yenilendi: ' || coalesce(v_name, '?'));
  return json_build_object('code', v_code);
end;
$$;

-- -------------------------------------------------------------
--  AYARLAR
-- -------------------------------------------------------------
create or replace function lucana.adm_settings()
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(60);
begin
  return (select data::json from lucana.settings where id = 1);
end;
$$;

create or replace function lucana.adm_settings_save(p jsonb)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare
  v_id   uuid := lucana._require(80);
  v_keys text[] := array['name','tagline','phone','address','hours','instagram','maps_url','maps_embed',
                         'announcement','ordering_enabled','calls_enabled','wifi_name','wifi_pass',
                         'about','currency'];
  v_clean jsonb;
begin
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_clean
  from jsonb_each(coalesce(p, '{}'::jsonb)) where key = any(v_keys);
  update lucana.settings set data = data || v_clean, updated_at = now() where id = 1;
  perform lucana._audit(v_id, 'update', 'settings', 'Ayarlar güncellendi: ' ||
    (select string_agg(k, ', ') from jsonb_object_keys(v_clean) k));
  return (select data::json from lucana.settings where id = 1);
end;
$$;

-- -------------------------------------------------------------
--  RAPORLAR (ciro)
-- -------------------------------------------------------------
create or replace function lucana.adm_report(p_from date, p_to date)
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(60);
begin
  if p_to < p_from or p_to - p_from > 366 then raise exception 'Geçersiz tarih aralığı'; end if;
  return json_build_object(
    'totals', (
      select json_build_object(
        'revenue',   coalesce(sum(total) filter (where status = 'paid'), 0),
        'paid',      count(*) filter (where status = 'paid'),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'cancelled_total', coalesce(sum(total) filter (where status = 'cancelled'), 0),
        'open',      count(*) filter (where status in ('new','preparing','served')),
        'avg_ticket',coalesce(round(avg(total) filter (where status = 'paid'), 2), 0),
        'qr_share',  case when count(*) filter (where status <> 'cancelled') = 0 then 0 else
                       round(100.0 * count(*) filter (where source = 'qr' and status <> 'cancelled')
                             / count(*) filter (where status <> 'cancelled'), 1) end)
      from lucana.orders where biz_day between p_from and p_to),
    'by_day', coalesce((
      select json_agg(json_build_object('day', d::date, 'revenue', coalesce(s.revenue, 0), 'orders', coalesce(s.orders, 0)) order by d)
      from generate_series(p_from, p_to, interval '1 day') d
      left join (select biz_day, sum(total) filter (where status = 'paid') revenue, count(*) filter (where status = 'paid') orders
                 from lucana.orders where biz_day between p_from and p_to group by biz_day) s on s.biz_day = d::date), '[]'::json),
    'by_method', coalesce((
      select json_agg(json_build_object('method', payment_method, 'revenue', revenue, 'orders', n))
      from (select payment_method, sum(total) revenue, count(*) n from lucana.orders
            where biz_day between p_from and p_to and status = 'paid' group by 1) m), '[]'::json),
    'by_hour', coalesce((
      select json_agg(json_build_object('hour', h, 'orders', n, 'revenue', revenue) order by h)
      from (select extract(hour from created_at at time zone 'Europe/Istanbul')::int h, count(*) n,
                   sum(total) filter (where status = 'paid') revenue
            from lucana.orders where biz_day between p_from and p_to and status <> 'cancelled' group by 1) x), '[]'::json),
    'top_items', coalesce((
      select json_agg(x) from (
        select oi.name, sum(oi.qty)::int qty, sum(oi.qty * oi.unit_price) revenue
        from lucana.order_items oi join lucana.orders o on o.id = oi.order_id
        where o.biz_day between p_from and p_to and o.status = 'paid'
        group by oi.name order by revenue desc limit 15) x), '[]'::json),
    'by_category', coalesce((
      select json_agg(x) from (
        select coalesce(c.name, 'Diğer') as name, sum(oi.qty)::int qty, sum(oi.qty * oi.unit_price) revenue
        from lucana.order_items oi join lucana.orders o on o.id = oi.order_id
        left join lucana.menu_categories c on c.id = oi.category_id
        where o.biz_day between p_from and p_to and o.status = 'paid'
        group by 1 order by revenue desc) x), '[]'::json));
end;
$$;

-- -------------------------------------------------------------
--  PERSONEL & YETKİLER
-- -------------------------------------------------------------
create or replace function lucana.adm_roles()
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80);
begin
  return (select json_agg(r order by r.level desc) from lucana.roles r);
end;
$$;

create or replace function lucana.adm_staff_list()
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80);
begin
  return coalesce((
    select json_agg(json_build_object(
      'id', u.id, 'username', u.username, 'full_name', u.full_name, 'role_id', u.role_id,
      'role_name', r.name, 'role_key', r.key, 'level', r.level, 'color', r.color,
      'is_active', u.is_active, 'must_change_pw', u.must_change_pw,
      'last_login_at', u.last_login_at, 'created_at', u.created_at) order by r.level desc, u.full_name)
    from lucana.staff u join lucana.roles r on r.id = u.role_id), '[]'::json);
end;
$$;

-- Kural: kendinden düşük seviyedekileri yönetebilirsin (Kurucu herkesi).
create or replace function lucana.adm_staff_save(p jsonb)
returns json language plpgsql volatile security definer
set search_path = lucana, extensions as $$
declare
  v_id       uuid := lucana._require(80);
  v_my_lv    int  := lucana._level(v_id);
  v_target   uuid := nullif(p->>'id', '')::uuid;
  v_role     lucana.roles%rowtype;
  v_old_lv   int;
  v_username text := lower(trim(p->>'username'));
  v_name     text := trim(p->>'full_name');
  v_pw       text := p->>'password';
  v_active   boolean := coalesce((p->>'is_active')::boolean, true);
begin
  select * into v_role from lucana.roles where id = (p->>'role_id')::uuid;
  if v_role.id is null then raise exception 'Rol seçin'; end if;
  if v_role.level >= v_my_lv and v_my_lv < 100 then
    raise exception 'Kendi seviyenizde veya üstünde rol atayamazsınız';
  end if;
  if coalesce(v_name, '') = '' then raise exception 'Ad soyad gerekli'; end if;
  if v_username !~ '^[a-z0-9._-]{3,32}$' then
    raise exception 'Kullanıcı adı 3-32 karakter; küçük harf, rakam, nokta, tire içerebilir';
  end if;

  if v_target is null then
    if length(coalesce(v_pw, '')) < 8 then raise exception 'Şifre en az 8 karakter olmalı'; end if;
    insert into lucana.staff(username, password_hash, full_name, role_id, is_active, must_change_pw)
    values (v_username, extensions.crypt(v_pw, extensions.gen_salt('bf', 10)), v_name, v_role.id, v_active, true)
    returning id into v_target;
    perform lucana._audit(v_id, 'create', 'staff', format('Personel eklendi: %s (%s)', v_name, v_role.name));
    return json_build_object('id', v_target);
  end if;

  v_old_lv := lucana._level(v_target);
  if v_target = v_id then
    if (select role_id from lucana.staff where id = v_id) <> v_role.id or not v_active then
      raise exception 'Kendi rolünüzü veya aktifliğinizi değiştiremezsiniz';
    end if;
  elsif v_old_lv >= v_my_lv and v_my_lv < 100 then
    raise exception 'Bu personeli düzenleme yetkiniz yok';
  end if;

  -- Son aktif kurucuyu koru
  if v_old_lv >= 100 and (v_role.level < 100 or not v_active)
     and (select count(*) from lucana.staff s join lucana.roles r on r.id = s.role_id
          where r.level >= 100 and s.is_active) <= 1 then
    raise exception 'Sistemde en az bir aktif kurucu kalmalı';
  end if;

  update lucana.staff set username = v_username, full_name = v_name, role_id = v_role.id,
         is_active = v_active, updated_at = now()
  where id = v_target;
  if not v_active then delete from lucana.sessions where staff_id = v_target; end if;

  if length(coalesce(v_pw, '')) > 0 then
    if length(v_pw) < 8 then raise exception 'Şifre en az 8 karakter olmalı'; end if;
    update lucana.staff set password_hash = extensions.crypt(v_pw, extensions.gen_salt('bf', 10)),
           must_change_pw = (v_target <> v_id)
    where id = v_target;
    delete from lucana.sessions where staff_id = v_target
      and token_hash <> lucana._hash_token(coalesce(lucana._header('x-session-token'), '-'));
  end if;

  perform lucana._audit(v_id, 'update', 'staff', format('Personel güncellendi: %s (%s%s)', v_name, v_role.name,
    case when length(coalesce(v_pw, '')) > 0 then ', şifre sıfırlandı' else '' end));
  return json_build_object('id', v_target);
exception when unique_violation then
  raise exception 'Bu kullanıcı adı zaten kullanımda';
end;
$$;

-- Personelin tüm oturumlarını kapat (telefon kaybı vb.)
create or replace function lucana.adm_staff_kick(p_id uuid)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80);
begin
  if p_id <> v_id and lucana._level(p_id) >= lucana._level(v_id) and lucana._level(v_id) < 100 then
    raise exception 'Bu personel üzerinde yetkiniz yok';
  end if;
  delete from lucana.sessions where staff_id = p_id;
  perform lucana._audit(v_id, 'kick', 'staff', 'Oturumlar kapatıldı: ' || (select full_name from lucana.staff where id = p_id));
  return json_build_object('ok', true);
end;
$$;

-- -------------------------------------------------------------
--  İŞLEM GEÇMİŞİ
-- -------------------------------------------------------------
create or replace function lucana.adm_audit(p_limit int default 100, p_offset int default 0, p_q text default null)
returns json language plpgsql stable security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require(80);
begin
  return coalesce((
    select json_agg(x) from (
      select id, staff_label, action, entity, summary, at from lucana.audit_logs
      where p_q is null or p_q = '' or summary ilike '%' || p_q || '%' or staff_label ilike '%' || p_q || '%'
      order by at desc limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0)) x), '[]'::json);
end;
$$;
