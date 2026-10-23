-- =============================================================
--  Lucana — 0008 Üye bildirim aboneliği (masa kodu gerektirmez)
--  Profil / oyun sayfalarından da "bildirimleri aç" yapılabilsin.
-- =============================================================
create or replace function lucana.mem_push_subscribe(p_device text, p_endpoint text, p_p256dh text, p_auth text)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_id uuid := lucana._require_member();
begin
  if not lucana._valid_device(p_device) then raise exception 'Geçersiz cihaz'; end if;
  if not lucana._valid_push(p_endpoint, p_p256dh, p_auth) then raise exception 'Geçersiz abonelik'; end if;
  if exists (select 1 from lucana.push_subscriptions where endpoint = p_endpoint and kind = 'staff') then
    return json_build_object('ok', true, 'staff', true);
  end if;
  insert into lucana.push_subscriptions(endpoint, p256dh, auth, kind, device_id, member_id)
  values (p_endpoint, p_p256dh, p_auth, 'customer', p_device, v_id)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, device_id = p_device, member_id = v_id, last_seen = now();
  return json_build_object('ok', true);
end;
$$;

-- QR sayfasından açılan abonelik de üyeye bağlansın
create or replace function lucana.pub_push_subscribe(p_code text, p_device text, p_endpoint text, p_p256dh text, p_auth text)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare v_table uuid; v_member uuid := lucana._mid();
begin
  if not lucana._valid_device(p_device) then raise exception 'Geçersiz cihaz'; end if;
  if not lucana._valid_push(p_endpoint, p_p256dh, p_auth) then raise exception 'Geçersiz abonelik'; end if;
  select id into v_table from lucana.tables where code = p_code and is_active;
  if v_table is null then raise exception 'Masa bulunamadı'; end if;
  if exists (select 1 from lucana.push_subscriptions where endpoint = p_endpoint and kind = 'staff') then
    return json_build_object('ok', true, 'staff', true);
  end if;
  insert into lucana.push_subscriptions(endpoint, p256dh, auth, kind, device_id, table_id, member_id)
  values (p_endpoint, p_p256dh, p_auth, 'customer', p_device, v_table, v_member)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, device_id = p_device, table_id = v_table,
        member_id = coalesce(v_member, lucana.push_subscriptions.member_id), last_seen = now();
  delete from lucana.push_subscriptions where kind = 'customer' and last_seen < now() - interval '30 days';
  return json_build_object('ok', true);
end;
$$;
