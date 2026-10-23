-- =============================================================
--  Lucana — 0007 Ödül havuzu + Lucana Blok (beceri oyunu)
--
--  YASAL ÇERÇEVE: Lucana'da şans oyunu / bahis YOKTUR. Hiçbir oyunda
--  puan "yatırılıp" talihe bağlı olarak kaybedilmez veya katlanmaz.
--  Oyunlar beceri (Blok) ya da süreye bağlı, sonucu önceden belli
--  (Bahçe, 0009) mekaniklerdir.
--
--  ÖDÜL HAVUZU: Admin panelden havuza puan koyar. Oyunların dağıttığı
--  tüm ödüller bu havuzdan çıkar → işletme, oyunlarla dağıtılan toplam
--  puanı tam olarak kontrol eder. Havuz asla eksiye düşemez.
-- =============================================================

create table if not exists lucana.game_pool (
  id         int primary key default 1 check (id = 1),
  balance    bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
insert into lucana.game_pool(id, balance) values (1, 0) on conflict do nothing;

create table if not exists lucana.pool_ledger (
  id            bigserial primary key,
  delta         bigint not null,
  reason        text not null,
  ref_id        uuid,
  staff_id      uuid references lucana.staff(id) on delete set null,
  balance_after bigint,
  at            timestamptz not null default now()
);
create index if not exists pool_ledger_at_idx on lucana.pool_ledger(at desc);

-- Blok oturumları (sunucu zaman damgası + tek seferlik bitiş)
create table if not exists lucana.game_rounds (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references lucana.members(id) on delete cascade,
  game        text not null,
  bet         int  not null default 0,
  reserve     int  not null default 0,
  payout      int  not null default 0,
  status      text not null default 'open' check (status in ('open','won','lost')),
  secret      jsonb not null default '{}'::jsonb,
  public      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default clock_timestamp(),
  finished_at timestamptz
);
create index if not exists game_rounds_member_idx on lucana.game_rounds(member_id, created_at desc);
create index if not exists game_rounds_at_idx on lucana.game_rounds(created_at desc);

alter table lucana.game_pool enable row level security;
alter table lucana.pool_ledger enable row level security;
alter table lucana.game_rounds enable row level security;

create or replace function lucana._pool_add(p_delta bigint, p_reason text, p_ref uuid, p_staff uuid default null)
returns bigint language plpgsql volatile security definer set search_path = lucana as $$
declare v_bal bigint;
begin
  update lucana.game_pool set balance = balance + p_delta, updated_at = now()
   where id = 1 and balance + p_delta >= 0
  returning balance into v_bal;
  if v_bal is null then raise exception 'Ödül havuzu şu an boş, ödül verilemiyor'; end if;
  insert into lucana.pool_ledger(delta, reason, ref_id, staff_id, balance_after) values (p_delta, p_reason, p_ref, p_staff, v_bal);
  return v_bal;
end;
$$;

create or replace function lucana._round_json(r lucana.game_rounds)
returns json language sql stable security definer set search_path = lucana as $$
  select json_build_object('id', r.id, 'game', r.game, 'payout', r.payout, 'status', r.status,
                           'public', r.public, 'created_at', r.created_at,
                           'points', (select points from lucana.members where id = r.member_id));
$$;

-- -------------------------------------------------------------
--  LUCANA BLOK (tetris) — beceri oyunu, bahis yok
--  Skor istemcide oluşur → güvenilmez kabul edilir:
--    * tur sunucuda başlar (zaman damgası), tek sefer bitirilir
--    * en az 20 sn, saniyede ~1 satır, skor oyunun puan formülüyle tutarlı
--    * ödül = satır × 2, oyun başına en çok 40, günlük tavan (ayar)
--    * ödül havuzdan ödenir; havuz boşsa ödül yok
--  Hile yapılsa bile kazanç günlük tavanla sınırlıdır.
-- -------------------------------------------------------------
create or replace function lucana.game_blok_start()
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_me uuid := lucana._require_member(false); v_round uuid;
begin
  if not lucana._setting_bool('games_enabled', true) then raise exception 'Oyunlar şu an kapalı'; end if;
  if (select count(*) from lucana.game_rounds where member_id = v_me and game = 'blok' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Saatte en fazla 30 oyun';
  end if;
  update lucana.game_rounds set status = 'lost', finished_at = now()
   where member_id = v_me and game = 'blok' and status = 'open';
  insert into lucana.game_rounds(member_id, game) values (v_me, 'blok') returning id into v_round;
  return json_build_object('id', v_round);
end;
$$;

create or replace function lucana.game_blok_finish(p_round uuid, p_score int, p_lines int)
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare
  v_me uuid := lucana._require_member(); r lucana.game_rounds; v_secs numeric; v_reward int := 0;
  v_cap int := lucana._setting_num('skill_daily_cap', 150)::int; v_today int; v_valid boolean;
begin
  select * into r from lucana.game_rounds where id = p_round and member_id = v_me and game = 'blok' for update;
  if r.id is null then raise exception 'Tur bulunamadı'; end if;
  if r.status <> 'open' then return lucana._round_json(r); end if;
  v_secs := extract(epoch from clock_timestamp() - r.created_at);
  -- Oyun formülü: satır puanı ≤ 200 × seviye (seviye = 1 + satır/10), düşürme ≤ 2/kare
  v_valid := p_lines >= 0 and p_score >= 0 and v_secs >= 20
             and p_lines <= floor(v_secs * 1.0) + 2
             and p_score <= p_lines * 200 * (1 + p_lines / 10.0) + p_lines * 100 + 2400 + v_secs * 20;

  if v_valid and p_lines > 0 then
    select coalesce(sum(delta), 0) into v_today from lucana.points_ledger
     where member_id = v_me and kind = 'skill_reward' and at > now() - interval '24 hours';
    v_reward := greatest(0, least(p_lines * 2, 40, v_cap - v_today));
    if v_reward > 0 then
      begin
        perform lucana._pool_add(-v_reward, 'Blok ödülü', r.id);
        perform lucana._points_add(v_me, v_reward, 'skill_reward', r.id, 'Lucana Blok: ' || p_lines || ' satır');
      exception when others then
        v_reward := 0; -- havuz boşsa ödül yok, skor yine kaydedilir
      end;
    end if;
  end if;

  update lucana.game_rounds
     set status = case when v_reward > 0 then 'won' else 'lost' end, payout = v_reward, finished_at = clock_timestamp(),
         public = jsonb_build_object('score', case when v_valid then p_score else 0 end, 'lines', case when v_valid then p_lines else 0 end,
                                     'valid', v_valid, 'reward', v_reward)
   where id = r.id returning * into r;
  return lucana._round_json(r);
end;
$$;

-- Haftanın en yüksek Blok skorları
create or replace function lucana.pub_blok_board()
returns json language sql stable security definer set search_path = lucana as $$
  select coalesce(json_agg(x order by x.score desc), '[]'::json) from (select * from (
    select distinct on (m.id) m.nickname, m.avatar, (g.public->>'score')::int as score, (g.public->>'lines')::int as lines,
           m.id = lucana._mid() as me
    from lucana.game_rounds g join lucana.members m on m.id = g.member_id
    where g.game = 'blok' and g.status <> 'open' and (g.public->>'valid')::boolean
      and g.created_at > now() - interval '7 days' and not m.is_hidden and not m.is_banned
    order by m.id, (g.public->>'score')::int desc) y
  where y.score > 0 order by y.score desc limit 20) x;
$$;

create or replace function lucana.adm_pool_adjust(p_delta bigint, p_reason text)
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_id uuid := lucana._require(80); v_bal bigint;
begin
  if p_delta = 0 or abs(p_delta) > 100000000 then raise exception 'Geçersiz miktar'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Açıklama yazın'; end if;
  v_bal := lucana._pool_add(p_delta, trim(p_reason), null, v_id);
  perform lucana._audit(v_id, 'update', 'game_pool', format('Ödül havuzu %s%s puan (%s) → %s', case when p_delta > 0 then '+' else '' end, p_delta, p_reason, v_bal));
  return json_build_object('balance', v_bal);
end;
$$;
