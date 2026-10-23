-- =============================================================
--  Lucana — 0009 Lucana Bahçesi (FarmVille tarzı, ŞANS UNSURU YOK)
--
--  Mekanik tamamen belirlidir (deterministik):
--    * Tohum ek → sabit süre bekle → sabit miktarda hasat et.
--    * Ürünün maliyeti, süresi ve verimi önceden bellidir; rastgelelik yoktur,
--      bahis yoktur, talihe bağlı kazanma/kaybetme yoktur.
--    * Komşunun büyüyen ürününü sula → onun ürünü hızlanır, sana teşekkür puanı.
--  Ekonomi:
--    * Tohum bedeli ödül havuzuna girer; hasat havuzdan ödenir.
--    * Kâr kısmı günlük tavanla (farm_daily_cap) ve havuz bakiyesiyle sınırlı;
--      havuz boşalsa bile en az tohum bedeli geri döner.
--  Ayrıca: eski şans oyunlarının (yazı-tura, çark, roket, mayın) tüm
--  fonksiyonları ve verileri kaldırılır.
-- =============================================================

-- -------------------------------------------------------------
--  Eski şans oyunlarını tamamen kaldır
-- -------------------------------------------------------------
drop function if exists lucana.game_coin(int, text);
drop function if exists lucana.game_wheel(int);
drop function if exists lucana.game_crash_start(int);
drop function if exists lucana.game_crash_peek(uuid);
drop function if exists lucana.game_crash_cashout(uuid);
drop function if exists lucana.game_mines_start(int, int);
drop function if exists lucana.game_mines_reveal(uuid, int);
drop function if exists lucana.game_mines_cashout(uuid);
drop function if exists lucana.game_open_round(text);
drop function if exists lucana.game_my_rounds(int);
drop function if exists lucana._game_open(uuid, text, int, numeric, jsonb, jsonb);
drop function if exists lucana._game_settle(uuid, int, jsonb);
drop function if exists lucana._game_settle_stale(uuid);
drop function if exists lucana._crash_mult(timestamptz);
drop function if exists lucana._mines_mult(int, int);
drop function if exists lucana._wheel_segments();
drop function if exists lucana._rand();
delete from lucana.game_rounds where game <> 'blok';
delete from lucana.points_ledger where kind in ('game_bet', 'game_win', 'game_refund');

alter table lucana.points_ledger drop constraint if exists points_ledger_kind_check;
alter table lucana.points_ledger add constraint points_ledger_kind_check
  check (kind in ('earn','redeem','refund','admin','skill_reward','farm_seed','farm_harvest','farm_help','farm_plot'));

update lucana.settings
   set data = (data - 'game_min_bet' - 'game_max_bet' - 'game_daily_loss_limit')
              || jsonb_build_object('farm_daily_cap', coalesce((data->>'farm_daily_cap')::int, 300),
                                    'help_daily_cap', coalesce((data->>'help_daily_cap')::int, 30))
 where id = 1;

-- -------------------------------------------------------------
--  TABLOLAR
-- -------------------------------------------------------------
alter table lucana.members add column if not exists farm_xp int not null default 0;
alter table lucana.members add column if not exists farm_plots int not null default 4 check (farm_plots between 4 and 12);

create table if not exists lucana.farm_crops (
  key        text primary key,
  name       text not null,
  emoji      text not null,
  cost       int  not null check (cost >= 0),
  yield      int  not null check (yield >= 0),
  grow_secs  int  not null check (grow_secs > 0),
  min_level  int  not null default 1,
  sort       int  not null default 0
);
insert into lucana.farm_crops(key, name, emoji, cost, yield, grow_secs, min_level, sort) values
  ('nane',  'Nane',   '🌿',   0,    4,   120, 1, 10),
  ('cilek', 'Çilek',  '🍓',  25,   38,   600, 1, 20),
  ('limon', 'Limon',  '🍋',  50,   80,  1800, 2, 30),
  ('elma',  'Elma',   '🍎', 100,  170,  3600, 3, 40),
  ('kavun', 'Kavun',  '🍈', 150,  270,  7200, 4, 50),
  ('kahve', 'Kahve',  '☕', 250,  480, 14400, 5, 60),
  ('cay',   'Çay',    '🫖', 400,  820, 28800, 6, 70)
on conflict (key) do nothing;

create table if not exists lucana.farm_plots (
  member_id  uuid not null references lucana.members(id) on delete cascade,
  idx        int  not null check (idx between 0 and 11),
  crop       text references lucana.farm_crops(key),
  seed_id    uuid,
  cost       int,
  yield      int,
  grow_secs  int,
  planted_at timestamptz,
  ready_at   timestamptz,
  waters     int not null default 0,
  primary key (member_id, idx)
);
create index if not exists farm_plots_ready_idx on lucana.farm_plots(ready_at) where crop is not null;

create table if not exists lucana.farm_waters (
  id         uuid primary key default gen_random_uuid(),
  seed_id    uuid not null,
  owner_id   uuid not null references lucana.members(id) on delete cascade,
  waterer_id uuid not null references lucana.members(id) on delete cascade,
  at         timestamptz not null default clock_timestamp(),
  unique (seed_id, waterer_id)
);
create index if not exists farm_waters_waterer_idx on lucana.farm_waters(waterer_id, at desc);

alter table lucana.farm_crops enable row level security;
alter table lucana.farm_plots enable row level security;
alter table lucana.farm_waters enable row level security;

-- -------------------------------------------------------------
--  YARDIMCILAR
-- -------------------------------------------------------------
create or replace function lucana._farm_level(p_xp int)
returns int language sql immutable as $$
  select 1 + floor(sqrt(greatest(p_xp, 0) / 100.0))::int;
$$;

create or replace function lucana._farm_plot_price(p_plots int)
returns int language sql immutable as $$
  select (300 * power(2, greatest(p_plots - 4, 0)))::int;
$$;

create or replace function lucana._farm_ensure(p_member uuid)
returns void language sql volatile security definer set search_path = lucana as $$
  insert into lucana.farm_plots(member_id, idx)
  select p_member, i from generate_series(0, (select farm_plots from lucana.members where id = p_member) - 1) i
  on conflict do nothing;
$$;

create or replace function lucana._farm_json(p_owner uuid, p_viewer uuid)
returns json language sql stable security definer set search_path = lucana as $$
  select json_build_object(
    'owner', json_build_object('id', m.id, 'nickname', m.nickname, 'avatar', m.avatar, 'xp', m.farm_xp,
                               'level', lucana._farm_level(m.farm_xp),
                               'next_level_xp', (power(lucana._farm_level(m.farm_xp), 2) * 100)::int,
                               'plots', m.farm_plots, 'me', m.id = p_viewer),
    'server_now', clock_timestamp(),
    'plot_price', case when m.farm_plots < 12 then lucana._farm_plot_price(m.farm_plots) end,
    'plots', coalesce((
      select json_agg(json_build_object(
        'idx', p.idx, 'crop', p.crop, 'planted_at', p.planted_at, 'ready_at', p.ready_at,
        'grow_secs', p.grow_secs, 'waters', p.waters, 'yield', p.yield,
        'watered_by_me', exists (select 1 from lucana.farm_waters w where w.seed_id = p.seed_id and w.waterer_id = p_viewer))
        order by p.idx)
      from lucana.farm_plots p where p.member_id = m.id and p.idx < m.farm_plots), '[]'::json))
  from lucana.members m where m.id = p_owner;
$$;

-- -------------------------------------------------------------
--  OYUNCU RPC'LERİ
-- -------------------------------------------------------------
create or replace function lucana.farm_crops()
returns json language sql stable security definer set search_path = lucana as $$
  select coalesce(json_agg(c order by c.sort), '[]'::json)
  from (select key, name, emoji, cost, yield, grow_secs, min_level, sort from lucana.farm_crops) c;
$$;

-- Kendi bahçen (p_owner boş) ya da bir komşunun bahçesi
create or replace function lucana.farm_state(p_owner uuid default null)
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_me uuid := lucana._require_member(); v_owner uuid := coalesce(p_owner, v_me);
begin
  if not exists (select 1 from lucana.members where id = v_owner) then raise exception 'Bahçe bulunamadı'; end if;
  if v_owner <> v_me and (select is_hidden from lucana.members where id = v_owner) then
    raise exception 'Bu bahçe gizli';
  end if;
  perform lucana._farm_ensure(v_owner);
  return lucana._farm_json(v_owner, v_me);
end;
$$;

create or replace function lucana.farm_plant(p_idx int, p_crop text)
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare
  v_me uuid := lucana._require_member(false);
  v_c lucana.farm_crops%rowtype;
  v_p lucana.farm_plots%rowtype;
  v_seed uuid := gen_random_uuid();
begin
  if not lucana._setting_bool('games_enabled', true) then raise exception 'Oyunlar şu an kapalı'; end if;
  select * into v_c from lucana.farm_crops where key = p_crop;
  if v_c.key is null then raise exception 'Ürün bulunamadı'; end if;
  if lucana._farm_level((select farm_xp from lucana.members where id = v_me)) < v_c.min_level then
    raise exception '% için bahçe seviyen en az % olmalı', v_c.name, v_c.min_level;
  end if;
  perform lucana._farm_ensure(v_me);
  select * into v_p from lucana.farm_plots where member_id = v_me and idx = p_idx for update;
  if v_p.member_id is null or p_idx >= (select farm_plots from lucana.members where id = v_me) then raise exception 'Geçersiz tarla'; end if;
  if v_p.crop is not null then raise exception 'Bu tarlada zaten ürün var'; end if;

  if v_c.cost > 0 then
    perform lucana._points_add(v_me, -v_c.cost, 'farm_seed', v_seed, 'Tohum: ' || v_c.name || ' ' || v_c.emoji);
    perform lucana._pool_add(v_c.cost, 'Tohum ' || v_c.name, v_seed);
  end if;

  update lucana.farm_plots
     set crop = v_c.key, seed_id = v_seed, cost = v_c.cost, yield = v_c.yield, grow_secs = v_c.grow_secs,
         planted_at = clock_timestamp(), ready_at = clock_timestamp() + make_interval(secs => v_c.grow_secs), waters = 0
   where member_id = v_me and idx = p_idx;
  return lucana._farm_json(v_me, v_me);
end;
$$;

-- Hasat: hazır olan ürünü topla. Ödeme = tohum bedeli + kâr (günlük tavan + havuz sınırı)
create or replace function lucana._farm_harvest_one(p_me uuid, p_idx int)
returns int language plpgsql volatile security definer set search_path = lucana as $$
declare
  v_p lucana.farm_plots%rowtype;
  v_cap int := lucana._setting_num('farm_daily_cap', 300)::int;
  v_today int; v_pool bigint; v_profit int; v_pay int; v_name text; v_emoji text;
begin
  select * into v_p from lucana.farm_plots where member_id = p_me and idx = p_idx for update;
  if v_p.crop is null then return null; end if;
  if v_p.ready_at > clock_timestamp() then return null; end if;

  -- son 24 saatte hasattan elde edilen KÂR (ödeme − tohum bedeli)
  select coalesce(sum(l.delta), 0) - coalesce((select sum(-s.delta) from lucana.points_ledger s
           where s.member_id = p_me and s.kind = 'farm_seed' and s.ref_id in (
             select h.ref_id from lucana.points_ledger h where h.member_id = p_me and h.kind = 'farm_harvest' and h.at > now() - interval '24 hours')), 0)
    into v_today
  from lucana.points_ledger l where l.member_id = p_me and l.kind = 'farm_harvest' and l.at > now() - interval '24 hours';

  select balance into v_pool from lucana.game_pool where id = 1 for update;
  v_profit := greatest(0, least(v_p.yield - v_p.cost, v_cap - v_today, v_pool - v_p.cost));
  v_pay := least(v_p.cost + v_profit, v_pool)::int;

  select name, emoji into v_name, v_emoji from lucana.farm_crops where key = v_p.crop;
  if v_pay > 0 then
    perform lucana._pool_add(-v_pay, 'Hasat ' || v_name, v_p.seed_id);
    perform lucana._points_add(p_me, v_pay, 'farm_harvest', v_p.seed_id, 'Hasat: ' || v_name || ' ' || v_emoji);
  end if;
  update lucana.members set farm_xp = farm_xp + v_p.yield where id = p_me;
  update lucana.farm_plots
     set crop = null, seed_id = null, cost = null, yield = null, grow_secs = null, planted_at = null, ready_at = null, waters = 0
   where member_id = p_me and idx = p_idx;
  return v_pay;
end;
$$;

create or replace function lucana.farm_harvest(p_idx int default null)
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_me uuid := lucana._require_member(false); v_total int := 0; v_n int := 0; v_pay int; r record; v_lvl0 int; v_lvl1 int;
begin
  v_lvl0 := lucana._farm_level((select farm_xp from lucana.members where id = v_me));
  for r in select idx from lucana.farm_plots
           where member_id = v_me and crop is not null and ready_at <= clock_timestamp()
             and (p_idx is null or idx = p_idx)
           order by idx
  loop
    v_pay := lucana._farm_harvest_one(v_me, r.idx);
    if v_pay is not null then v_total := v_total + v_pay; v_n := v_n + 1; end if;
  end loop;
  if v_n = 0 then raise exception 'Hasada hazır ürün yok'; end if;
  v_lvl1 := lucana._farm_level((select farm_xp from lucana.members where id = v_me));
  return json_build_object('harvested', v_n, 'points_gained', v_total, 'level_up', v_lvl1 > v_lvl0, 'level', v_lvl1,
                           'farm', lucana._farm_json(v_me, v_me),
                           'points', (select points from lucana.members where id = v_me));
end;
$$;

-- Komşunun büyüyen ürününü sula: süresi %15 kısalır, sulayana teşekkür puanı
create or replace function lucana.farm_water(p_owner uuid, p_idx int)
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare
  v_me uuid := lucana._require_member(false);
  v_p lucana.farm_plots%rowtype;
  v_cut interval; v_reward int := 0; v_today int; v_wid uuid;
  v_cap int := lucana._setting_num('help_daily_cap', 30)::int;
begin
  if p_owner = v_me then raise exception 'Kendi bahçeni sulayamazsın — komşularına yardım et!'; end if;
  if exists (select 1 from lucana.farm_waters where waterer_id = v_me and at > clock_timestamp() - interval '1500 milliseconds') then
    raise exception 'Biraz yavaş 🙂';
  end if;
  select * into v_p from lucana.farm_plots where member_id = p_owner and idx = p_idx for update;
  if v_p.crop is null then raise exception 'Bu tarlada büyüyen ürün yok'; end if;
  if v_p.ready_at <= clock_timestamp() then raise exception 'Bu ürün zaten hasada hazır'; end if;
  if v_p.waters >= 5 then raise exception 'Bu ürün yeterince sulandı'; end if;

  insert into lucana.farm_waters(seed_id, owner_id, waterer_id) values (v_p.seed_id, p_owner, v_me)
  on conflict (seed_id, waterer_id) do nothing returning id into v_wid;
  if v_wid is null then raise exception 'Bu ürünü zaten suladın'; end if;

  v_cut := make_interval(secs => v_p.grow_secs * 0.15);
  update lucana.farm_plots
     set ready_at = greatest(clock_timestamp(), ready_at - v_cut), waters = waters + 1
   where member_id = p_owner and idx = p_idx;

  select coalesce(sum(delta), 0) into v_today from lucana.points_ledger
   where member_id = v_me and kind = 'farm_help' and at > now() - interval '24 hours';
  v_reward := greatest(0, least(2, v_cap - v_today));
  if v_reward > 0 then
    begin
      perform lucana._pool_add(-v_reward, 'Sulama teşekkürü', v_wid);
      perform lucana._points_add(v_me, v_reward, 'farm_help', v_wid,
        'Sulama: ' || (select nickname from lucana.members where id = p_owner));
    exception when others then v_reward := 0;
    end;
  end if;
  return json_build_object('reward', v_reward, 'farm', lucana._farm_json(p_owner, v_me),
                           'points', (select points from lucana.members where id = v_me));
end;
$$;

create or replace function lucana.farm_buy_plot()
returns json language plpgsql volatile security definer set search_path = lucana as $$
declare v_me uuid := lucana._require_member(false); v_n int; v_price int;
begin
  select farm_plots into v_n from lucana.members where id = v_me for update;
  if v_n >= 12 then raise exception 'En fazla 12 tarla'; end if;
  v_price := lucana._farm_plot_price(v_n);
  -- ref: üye + tarla numarası → aynı tarla iki kez satın alınamaz
  perform lucana._points_add(v_me, -v_price, 'farm_plot',
            md5(v_me::text || ':plot:' || (v_n + 1))::uuid, 'Yeni tarla #' || (v_n + 1));
  perform lucana._pool_add(v_price, 'Tarla satışı', null);
  update lucana.members set farm_plots = v_n + 1 where id = v_me;
  perform lucana._farm_ensure(v_me);
  return lucana._farm_json(v_me, v_me);
end;
$$;

-- Ziyaret edilecek bahçeler: şu an Lucana'dakiler önce, sonra en aktif çiftçiler
create or replace function lucana.farm_neighbors()
returns json language plpgsql stable security definer set search_path = lucana as $$
declare v_me uuid := lucana._require_member();
begin
  return coalesce((select json_agg(x) from (
    select m.id, m.nickname, m.avatar, lucana._farm_level(m.farm_xp) as level,
           (select t.name from lucana.table_presence p join lucana.tables t on t.id = p.table_id
             where p.member_id = m.id and p.left_at is null and p.last_seen > now() - interval '4 hours' limit 1) as at_table,
           (select count(*) from lucana.farm_plots fp
             where fp.member_id = m.id and fp.crop is not null and fp.ready_at > clock_timestamp() and fp.waters < 5
               and not exists (select 1 from lucana.farm_waters w where w.seed_id = fp.seed_id and w.waterer_id = v_me)) as waterable
    from lucana.members m
    where m.id <> v_me and not m.is_hidden and not m.is_banned
      and exists (select 1 from lucana.farm_plots fp where fp.member_id = m.id and fp.crop is not null)
    order by (exists (select 1 from lucana.table_presence p where p.member_id = m.id and p.left_at is null
                       and p.last_seen > now() - interval '4 hours')) desc,
             waterable desc, m.last_seen_at desc
    limit 30) x), '[]'::json);
end;
$$;

-- -------------------------------------------------------------
--  Oyun bilgisi, akış, liderlik, panel — yeniden tanım
-- -------------------------------------------------------------
create or replace function lucana.game_info()
returns json language plpgsql stable security definer set search_path = lucana as $$
declare v_me uuid := lucana._mid(); v_skill int := 0; v_help int := 0;
begin
  if v_me is not null then
    select coalesce(sum(delta) filter (where kind = 'skill_reward'), 0),
           coalesce(sum(delta) filter (where kind = 'farm_help'), 0)
      into v_skill, v_help
    from lucana.points_ledger where member_id = v_me and at > now() - interval '24 hours';
  end if;
  return json_build_object(
    'enabled', lucana._setting_bool('games_enabled', true),
    'pool', (select balance from lucana.game_pool where id = 1),
    'skill_cap', lucana._setting_num('skill_daily_cap', 150),
    'skill_today', v_skill,
    'farm_cap', lucana._setting_num('farm_daily_cap', 300),
    'help_cap', lucana._setting_num('help_daily_cap', 30),
    'help_today', v_help);
end;
$$;

create or replace function lucana.pub_feed(p_limit int default 20)
returns json language plpgsql stable security definer set search_path = lucana as $$
begin
  if not lucana._setting_bool('social_feed_enabled', true) then return '[]'::json; end if;
  return coalesce((select json_agg(x order by x.at desc) from (
    (select 'order'::text as type, m.nickname, m.avatar, o.table_label as place, o.created_at as at,
            (select oi.name from lucana.order_items oi where oi.order_id = o.id order by oi.unit_price * oi.qty desc limit 1) as detail,
            (select sum(qty)::int from lucana.order_items oi where oi.order_id = o.id) as amount
     from lucana.orders o join lucana.members m on m.id = o.member_id
     where o.created_at > now() - interval '6 hours' and o.status <> 'cancelled'
       and not m.is_hidden and not m.is_banned
     order by o.created_at desc limit 15)
    union all
    (select 'join'::text, m.nickname, m.avatar, t.name, p.since, null::text, null::int
     from lucana.table_presence p join lucana.members m on m.id = p.member_id join lucana.tables t on t.id = p.table_id
     where p.since > now() - interval '3 hours' and not m.is_hidden and not m.is_banned
     order by p.since desc limit 8)
    union all
    (select 'harvest'::text, m.nickname, m.avatar, null::text, l.at, replace(l.note, 'Hasat: ', ''), l.delta
     from lucana.points_ledger l join lucana.members m on m.id = l.member_id
     where l.kind = 'farm_harvest' and l.delta >= 100 and l.at > now() - interval '6 hours'
       and not m.is_hidden and not m.is_banned
     order by l.at desc limit 8)
    order by at desc limit least(greatest(p_limit, 1), 40)) x), '[]'::json);
end;
$$;

create or replace function lucana.pub_leaderboard(p_board text default 'week')
returns json language plpgsql stable security definer set search_path = lucana as $$
declare v_me uuid := lucana._mid(); v_rows json; v_my json;
begin
  if p_board = 'all' then
    with r as (
      select m.id, m.nickname, m.avatar, m.lifetime_earned as score, rank() over (order by m.lifetime_earned desc) as rk
      from lucana.members m where not m.is_hidden and not m.is_banned and m.lifetime_earned > 0)
    select (select coalesce(json_agg(json_build_object('rank', rk, 'nickname', nickname, 'avatar', avatar, 'score', score, 'me', id = v_me) order by rk), '[]'::json) from (select * from r order by rk limit 25) t),
           (select json_build_object('rank', rk, 'score', score) from r where id = v_me)
      into v_rows, v_my;
  elsif p_board = 'farm' then
    with r as (
      select m.id, m.nickname, m.avatar, m.farm_xp as score, rank() over (order by m.farm_xp desc) as rk
      from lucana.members m where not m.is_hidden and not m.is_banned and m.farm_xp > 0)
    select (select coalesce(json_agg(json_build_object('rank', rk, 'nickname', nickname, 'avatar', avatar, 'score', score,
                                                       'level', lucana._farm_level(score), 'me', id = v_me) order by rk), '[]'::json)
              from (select * from r order by rk limit 25) t),
           (select json_build_object('rank', rk, 'score', score) from r where id = v_me)
      into v_rows, v_my;
  else
    with r as (
      select m.id, m.nickname, m.avatar, sum(l.delta)::int as score, rank() over (order by sum(l.delta) desc) as rk
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

create or replace function lucana.adm_pool()
returns json language plpgsql stable security definer set search_path = lucana as $$
declare v_id uuid := lucana._require(60);
begin
  return json_build_object(
    'balance', (select balance from lucana.game_pool where id = 1),
    'today', (select json_build_object(
                'seeds',    coalesce(sum(-delta) filter (where kind = 'farm_seed'), 0),
                'harvest',  coalesce(sum(delta) filter (where kind = 'farm_harvest'), 0),
                'help',     coalesce(sum(delta) filter (where kind = 'farm_help'), 0),
                'blok',     coalesce(sum(delta) filter (where kind = 'skill_reward'), 0),
                'plots',    coalesce(sum(-delta) filter (where kind = 'farm_plot'), 0),
                'players',  count(distinct member_id))
              from lucana.points_ledger
              where at > now() - interval '24 hours' and kind in ('farm_seed','farm_harvest','farm_help','skill_reward','farm_plot')),
    'week', (select json_build_object(
                'seeds',    coalesce(sum(-delta) filter (where kind = 'farm_seed'), 0),
                'harvest',  coalesce(sum(delta) filter (where kind = 'farm_harvest'), 0),
                'help',     coalesce(sum(delta) filter (where kind = 'farm_help'), 0),
                'blok',     coalesce(sum(delta) filter (where kind = 'skill_reward'), 0),
                'plots',    coalesce(sum(-delta) filter (where kind = 'farm_plot'), 0),
                'players',  count(distinct member_id))
              from lucana.points_ledger
              where at > now() - interval '7 days' and kind in ('farm_seed','farm_harvest','farm_help','skill_reward','farm_plot')),
    'growing', (select count(*) from lucana.farm_plots where crop is not null),
    'farmers', (select count(distinct member_id) from lucana.farm_plots where crop is not null),
    'ledger', coalesce((select json_agg(x) from (
       select l.delta, l.reason, l.balance_after, l.at, (select full_name from lucana.staff s where s.id = l.staff_id) staff
       from lucana.pool_ledger l where l.staff_id is not null order by l.at desc limit 30) x), '[]'::json),
    'recent', coalesce((select json_agg(x) from (
       select l.kind, l.delta, l.note, l.at, m.nickname, m.avatar
       from lucana.points_ledger l join lucana.members m on m.id = l.member_id
       where l.kind in ('farm_harvest','farm_help','skill_reward','farm_plot')
       order by l.at desc limit 40) x), '[]'::json));
end;
$$;

create or replace function lucana.adm_members(p_q text default null, p_limit int default 100)
returns json language plpgsql stable security definer set search_path = lucana as $$
declare v_id uuid := lucana._require(60);
begin
  return coalesce((select json_agg(x) from (
    select m.id, m.nickname, m.avatar, m.username, m.points, m.lifetime_earned, m.is_hidden, m.is_banned,
           m.marketing_ok, m.created_at, m.last_seen_at, lucana._farm_level(m.farm_xp) as farm_level,
           (select count(*) from lucana.orders o where o.member_id = m.id and o.status = 'paid') as orders_paid,
           (select coalesce(sum(total), 0) from lucana.orders o where o.member_id = m.id and o.status = 'paid') as spent,
           (select coalesce(sum(delta), 0) from lucana.points_ledger l
             where l.member_id = m.id and l.kind in ('farm_seed','farm_harvest','farm_help','skill_reward','farm_plot')) as game_net,
           (select t.name from lucana.table_presence p join lucana.tables t on t.id = p.table_id
             where p.member_id = m.id and p.left_at is null and p.last_seen > now() - interval '4 hours' limit 1) as at_table
    from lucana.members m
    where p_q is null or p_q = '' or m.nickname ilike '%' || p_q || '%' or m.username ilike '%' || p_q || '%'
    order by m.last_seen_at desc limit least(greatest(p_limit, 1), 500)) x), '[]'::json);
end;
$$;

create or replace function lucana.adm_settings_save(p jsonb)
returns json language plpgsql volatile security definer
set search_path = lucana as $$
declare
  v_id   uuid := lucana._require(80);
  v_keys text[] := array['name','tagline','phone','address','hours','instagram','maps_url','maps_embed',
                         'announcement','ordering_enabled','calls_enabled','wifi_name','wifi_pass',
                         'about','currency',
                         'points_per_tl','redeem_points_per_tl','max_discount_pct','social_feed_enabled',
                         'games_enabled','skill_daily_cap','farm_daily_cap','help_daily_cap'];
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
  if (v_clean ? 'skill_daily_cap' and (v_clean->>'skill_daily_cap')::numeric < 0)
     or (v_clean ? 'farm_daily_cap' and (v_clean->>'farm_daily_cap')::numeric < 0)
     or (v_clean ? 'help_daily_cap' and (v_clean->>'help_daily_cap')::numeric < 0) then
    raise exception 'Günlük tavanlar eksi olamaz'; end if;

  update lucana.settings set data = data || v_clean, updated_at = now() where id = 1;
  perform lucana._audit(v_id, 'update', 'settings', 'Ayarlar güncellendi: ' ||
    (select string_agg(k, ', ') from jsonb_object_keys(v_clean) k));
  return (select data::json from lucana.settings where id = 1);
end;
$$;
