-- =============================================================
--  Lucana — 0002 Herkese açık RPC'ler (site, menü, QR masa)
--  Müşteri tarafı hiçbir zaman tabloya doğrudan erişmez.
-- =============================================================

-- Kamuya açık ayarlar (wifi bilgisi hariç — o yalnızca QR ile gelene verilir)
create or replace function lucana.pub_settings()
returns json language sql stable security definer
set search_path = lucana as $$
  select (data - 'wifi_name' - 'wifi_pass')::json from lucana.settings where id = 1;
$$;

create or replace function lucana.pub_menu()
returns json language sql stable security definer
set search_path = lucana as $$
  select json_build_object(
    'categories', coalesce((
      select json_agg(c order by c.sort, c.name)
      from (select id, name, description, icon, image_url, sort
            from lucana.menu_categories where is_active) c), '[]'::json),
    'items', coalesce((
      select json_agg(i order by i.sort, i.name)
      from (select mi.id, mi.category_id, mi.name, mi.description, mi.price, mi.image_url,
                   mi.tags, mi.is_featured, mi.sort,
                   (not mi.track_stock or mi.stock > 0) as available
            from lucana.menu_items mi
            join lucana.menu_categories c on c.id = mi.category_id and c.is_active
            where mi.is_active) i), '[]'::json));
$$;

-- QR kodundan masa bilgisi
create or replace function lucana.pub_table(p_code text)
returns json language sql stable security definer
set search_path = lucana as $$
  select json_build_object(
    'id', t.id, 'name', t.name, 'area', t.area,
    'ordering_enabled', coalesce((s.data->>'ordering_enabled')::boolean, true),
    'calls_enabled', coalesce((s.data->>'calls_enabled')::boolean, true),
    'wifi_name', s.data->>'wifi_name', 'wifi_pass', s.data->>'wifi_pass')
  from lucana.tables t
  left join lucana.settings s on s.id = 1
  where t.code = p_code and t.is_active;
$$;

-- -------------------------------------------------------------
--  Sipariş oluşturma çekirdeği (müşteri + personel ortak)
--  Fiyatlar her zaman sunucuda hesaplanır, stok satır kilidiyle düşülür.
-- -------------------------------------------------------------
create or replace function lucana._order_insert(
  p_table uuid, p_device text, p_items jsonb, p_note text, p_staff uuid, p_source text)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare
  v_order uuid;
  v_no    int;
  v_day   date := lucana._biz_day(now());
  v_total numeric(12,2) := 0;
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

  insert into lucana.orders(no, biz_day, table_id, table_label, device_id, source, note, created_by)
  values (v_no, v_day, p_table, v_label, p_device, p_source, nullif(left(trim(p_note), 300), ''), p_staff)
  returning id into v_order;

  for r in
    select (e->>'id')::uuid as id,
           sum(coalesce((e->>'qty')::int, 0))::int as qty,
           string_agg(nullif(left(trim(e->>'note'), 150), ''), ' / ') as note
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    if r.qty < 1 or r.qty > 50 then
      raise exception 'Geçersiz adet';
    end if;

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

    v_total := v_total + v_item.price * r.qty;
  end loop;

  update lucana.orders set total = v_total where id = v_order;

  perform lucana._ping('lucana-staff');
  if p_table is not null then
    perform lucana._ping('lucana-t-' || p_table);
  end if;

  return json_build_object('id', v_order, 'no', v_no, 'total', v_total);
end;
$$;

-- Müşteri: QR masadan sipariş
create or replace function lucana.order_place(p_code text, p_device text, p_items jsonb, p_note text default null)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_table lucana.tables%rowtype; v_enabled boolean;
begin
  if not lucana._valid_device(p_device) then
    raise exception 'Geçersiz cihaz';
  end if;

  select * into v_table from lucana.tables where code = p_code and is_active;
  if v_table.id is null then
    raise exception 'Masa bulunamadı. Lütfen masadaki QR kodu tekrar okutun.';
  end if;

  select coalesce((data->>'ordering_enabled')::boolean, true) into v_enabled from lucana.settings where id = 1;
  if not coalesce(v_enabled, true) then
    raise exception 'Şu anda QR ile sipariş alınmıyor, lütfen garsonu çağırın.';
  end if;

  -- Hız sınırları (kötüye kullanım / spam)
  if exists (select 1 from lucana.orders
             where device_id = p_device and created_at > now() - interval '15 seconds') then
    raise exception 'Lütfen birkaç saniye bekleyip tekrar deneyin';
  end if;
  if (select count(*) from lucana.orders
      where device_id = p_device and created_at > now() - interval '1 hour') >= 12 then
    raise exception 'Çok fazla sipariş denemesi. Lütfen garsonu çağırın.';
  end if;
  if (select count(*) from lucana.orders
      where table_id = v_table.id and status = 'new') >= 10 then
    raise exception 'Masanızda onay bekleyen çok sipariş var, lütfen garsonu çağırın.';
  end if;

  return lucana._order_insert(v_table.id, p_device, p_items, p_note, null, 'qr');
end;
$$;

-- Müşteri: bu cihazın bu masadaki siparişleri + açık çağrıları
create or replace function lucana.order_track(p_code text, p_device text)
returns json language sql stable security definer
set search_path = lucana as $$
  with t as (select id from lucana.tables where code = p_code and is_active)
  select json_build_object(
    'orders', coalesce((
      select json_agg(json_build_object(
        'id', o.id, 'no', o.no, 'status', o.status, 'total', o.total, 'note', o.note,
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

-- Müşteri: henüz onaylanmamış siparişini 2 dk içinde iptal edebilir
create or replace function lucana.order_cancel_own(p_code text, p_device text, p_order uuid)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_o lucana.orders%rowtype;
begin
  select o.* into v_o from lucana.orders o join lucana.tables t on t.id = o.table_id
  where o.id = p_order and t.code = p_code and o.device_id = p_device
  for update of o;
  if v_o.id is null then raise exception 'Sipariş bulunamadı'; end if;
  if v_o.status <> 'new' then raise exception 'Sipariş hazırlanmaya başladı, iptal için garsona danışın'; end if;
  if v_o.created_at < now() - interval '2 minutes' then
    raise exception 'İptal süresi doldu, lütfen garsona danışın';
  end if;
  perform lucana._order_restock(v_o.id, null);
  update lucana.orders set status = 'cancelled', cancel_reason = 'Müşteri iptal etti', updated_at = now()
  where id = v_o.id;
  perform lucana._ping('lucana-staff');
  perform lucana._ping('lucana-t-' || v_o.table_id);
  return json_build_object('ok', true);
end;
$$;

-- İptal edilen siparişin stoklarını geri yükler
create or replace function lucana._order_restock(p_order uuid, p_staff uuid)
returns void language plpgsql volatile security definer
set search_path = lucana as $$
declare r record; v_no int;
begin
  select no into v_no from lucana.orders where id = p_order;
  for r in
    select oi.menu_item_id, oi.name, sum(oi.qty)::int as qty
    from lucana.order_items oi
    join lucana.menu_items mi on mi.id = oi.menu_item_id and mi.track_stock
    where oi.order_id = p_order
    group by 1, 2
  loop
    update lucana.menu_items set stock = stock + r.qty, updated_at = now() where id = r.menu_item_id;
    insert into lucana.stock_moves(kind, ref_id, ref_name, delta, reason, order_id, staff_id)
    values ('menu', r.menu_item_id, r.name, r.qty, 'İptal iadesi #' || v_no, p_order, p_staff);
  end loop;
end;
$$;

-- Müşteri: garson / hesap / köz çağır
create or replace function lucana.call_create(p_code text, p_device text, p_type text, p_note text default null)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_table lucana.tables%rowtype; v_id uuid; v_enabled boolean;
begin
  if not lucana._valid_device(p_device) then raise exception 'Geçersiz cihaz'; end if;
  if p_type not in ('waiter','bill','coal','other') then raise exception 'Geçersiz çağrı türü'; end if;

  select * into v_table from lucana.tables where code = p_code and is_active;
  if v_table.id is null then raise exception 'Masa bulunamadı'; end if;

  select coalesce((data->>'calls_enabled')::boolean, true) into v_enabled from lucana.settings where id = 1;
  if not coalesce(v_enabled, true) then raise exception 'Çağrı sistemi şu anda kapalı'; end if;

  -- Aynı masa + aynı tür açık çağrı varsa yenisini açma
  select id into v_id from lucana.waiter_calls
  where table_id = v_table.id and type = p_type and status = 'open'
    and created_at > now() - interval '3 hours';
  if v_id is not null then
    return json_build_object('id', v_id, 'duplicate', true);
  end if;

  if (select count(*) from lucana.waiter_calls
      where device_id = p_device and created_at > now() - interval '10 minutes') >= 6 then
    raise exception 'Çok fazla çağrı yaptınız, lütfen biraz bekleyin';
  end if;

  insert into lucana.waiter_calls(table_id, device_id, type, note)
  values (v_table.id, p_device, p_type, nullif(left(trim(p_note), 200), ''))
  returning id into v_id;

  perform lucana._ping('lucana-staff');
  perform lucana._ping('lucana-t-' || v_table.id);
  return json_build_object('id', v_id, 'duplicate', false);
end;
$$;
