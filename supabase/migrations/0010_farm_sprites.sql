-- =============================================================
--  Lucana — 0010 Bahçe ürünleri gerçek sprite'larla eşleşir
--  Görseller: public/game/crops.png (josehzz, CC0) — sprite_row = atlas satırı.
--  Ekonomi aynı mantık: sabit maliyet, sabit süre, sabit verim (şans yok).
-- =============================================================
alter table lucana.farm_crops add column if not exists sprite_row int;

-- Kaldırılan ürünlerle ekili tarlalar boşaltılır, tohum bedeli iade edilir (havuzdan)
do $$
declare r record;
begin
  for r in select p.member_id, p.idx, p.seed_id, p.cost from lucana.farm_plots p
           where p.crop in ('nane','elma','cay') loop
    if r.cost > 0 then
      perform lucana._pool_add(-r.cost, 'Ürün değişimi iadesi', r.seed_id);
      perform lucana._points_add(r.member_id, r.cost, 'farm_harvest', r.seed_id, 'Ürün değişimi: tohum iadesi');
    end if;
    update lucana.farm_plots set crop = null, seed_id = null, cost = null, yield = null, grow_secs = null,
           planted_at = null, ready_at = null, waters = 0
     where member_id = r.member_id and idx = r.idx;
  end loop;
end $$;
delete from lucana.farm_crops where key in ('nane','elma','cay');

insert into lucana.farm_crops(key, name, emoji, cost, yield, grow_secs, min_level, sort, sprite_row) values
  ('bugday',   'Buğday',   '🌾',   0,    4,   120, 1, 10, 0),
  ('cilek',    'Çilek',    '🍓',  25,   38,   600, 1, 20, 1),
  ('domates',  'Domates',  '🍅',  40,   64,  1200, 2, 30, 2),
  ('limon',    'Limon',    '🍋',  50,   80,  1800, 2, 40, 3),
  ('kavun',    'Kavun',    '🍈', 100,  170,  3600, 3, 50, 4),
  ('uzum',     'Üzüm',     '🍇', 150,  270,  7200, 4, 60, 5),
  ('portakal', 'Portakal', '🍊', 250,  480, 14400, 5, 70, 6),
  ('kahve',    'Kahve',    '☕', 400,  820, 28800, 6, 80, 7)
on conflict (key) do update set
  name = excluded.name, emoji = excluded.emoji, cost = excluded.cost, yield = excluded.yield,
  grow_secs = excluded.grow_secs, min_level = excluded.min_level, sort = excluded.sort, sprite_row = excluded.sprite_row;

create or replace function lucana.farm_crops()
returns json language sql stable security definer set search_path = lucana as $$
  select coalesce(json_agg(c order by c.sort), '[]'::json)
  from (select key, name, emoji, cost, yield, grow_secs, min_level, sort, sprite_row from lucana.farm_crops) c;
$$;
