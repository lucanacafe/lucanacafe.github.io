-- =============================================================
--  Lucana — 0004 Başlangıç verisi
--  Fiyatlar örnektir; panelden güncellenmelidir.
--  Kurucu hesabı burada OLUŞTURULMAZ (şifre repoya girmesin diye):
--  scripts/db.mjs bootstrap komutu rastgele şifreyle oluşturur.
-- =============================================================

insert into lucana.roles(key, name, level, color) values
  ('founder', 'Kurucu',     100, '#e8c170'),
  ('manager', 'Müdür',       80, '#d4a24c'),
  ('cashier', 'Kasiyer',     60, '#c2703d'),
  ('waiter',  'Garson',      40, '#8e3b46'),
  ('kitchen', 'Mutfak/Bar',  30, '#6b7a8f')
on conflict (key) do nothing;

insert into lucana.settings(id, data) values (1, jsonb_build_object(
  'name', 'Lucana Cafe & Lounge',
  'tagline', 'Her Fincanda Bir Hikaye, Her Köşede Bir Huzur Var',
  'about', 'Çağlayan''ın kalbinde; demli çay, köpüklü kahve, özenle hazırlanmış nargile ve okey masalarıyla sıcacık bir aile ortamı. Gün boyu sakin bir mola, gece boyu keyifli bir sohbet için kapımız açık.',
  'phone', '+90 532 699 70 62',
  'address', 'Çağlayan, Vatan Caddesi No:57, Kağıthane / İstanbul',
  'hours', '10:00 – 04:00',
  'instagram', 'lucana.cafe',
  'maps_url', 'https://www.google.com/maps/search/?api=1&query=Lucana+Cafe+%26+Lounge+%C3%87a%C4%9Flayan+Vatan+Caddesi+No%3A57+K%C3%A2%C4%9F%C4%B1thane',
  'announcement', '',
  'ordering_enabled', true,
  'calls_enabled', true,
  'currency', '₺',
  'wifi_name', '',
  'wifi_pass', ''))
on conflict (id) do nothing;

do $$
declare
  c_hot uuid; c_cold uuid; c_shake uuid; c_nargile uuid; c_dessert uuid; c_snack uuid;
begin
  if exists (select 1 from lucana.menu_categories) then return; end if;

  insert into lucana.menu_categories(name, description, icon, sort) values
    ('Nargile', 'Tüm çeşitler tek fiyat — premium tütün, yoğun duman', 'Flame', 10) returning id into c_nargile;
  insert into lucana.menu_categories(name, description, icon, sort) values
    ('Sıcak İçecekler', 'Demli çaydan köpüklü Türk kahvesine', 'Coffee', 20) returning id into c_hot;
  insert into lucana.menu_categories(name, description, icon, sort) values
    ('Soğuk İçecekler', 'Serinleten klasikler', 'GlassWater', 30) returning id into c_cold;
  insert into lucana.menu_categories(name, description, icon, sort) values
    ('Milkshake & Frozen', 'Bol köpüklü, bol keyifli', 'CupSoda', 40) returning id into c_shake;
  insert into lucana.menu_categories(name, description, icon, sort) values
    ('Tatlılar', 'Kahvenin yanına tatlı bir eşlik', 'CakeSlice', 50) returning id into c_dessert;
  insert into lucana.menu_categories(name, description, icon, sort) values
    ('Atıştırmalıklar', 'Okey masasının vazgeçilmezleri', 'Sandwich', 60) returning id into c_snack;

  insert into lucana.menu_items(category_id, name, description, price, image_url, tags, is_featured, sort) values
    (c_nargile, 'Lucana Special', 'Evin imza karışımı; meyvemsi, ferah ve yoğun duman', 250, 'images/nargile-gece.webp', '{imza,popüler}', true, 10),
    (c_nargile, 'Çift Elma', 'Anason notalı klasik çift elma', 250, 'images/nargile-masa.webp', '{klasik}', true, 20),
    (c_nargile, 'Nane Limon', 'Serin ve ferah', 250, null, '{}', false, 30),
    (c_nargile, 'Kavun Nane', 'Tatlı kavun, serin nane', 250, null, '{}', false, 40),
    (c_nargile, 'Böğürtlen', 'Hafif ekşi, meyvemsi', 250, null, '{}', false, 50),
    (c_nargile, 'Saf Tütün', 'Aromasız, sert içim sevenlere', 250, 'images/nargile-pirinc.webp', '{sert}', false, 60),

    (c_hot, 'Çay', 'İnce belli bardakta demli çay', 25, null, '{popüler}', true, 10),
    (c_hot, 'Fincan Çay', null, 40, null, '{}', false, 20),
    (c_hot, 'Türk Kahvesi', 'Lokum eşliğinde, bol köpüklü', 90, null, '{}', true, 30),
    (c_hot, 'Double Türk Kahvesi', null, 130, null, '{}', false, 40),
    (c_hot, 'Espresso', null, 90, null, '{}', false, 50),
    (c_hot, 'Americano', null, 110, null, '{}', false, 60),
    (c_hot, 'Latte', null, 130, null, '{}', false, 70),
    (c_hot, 'Cappuccino', null, 130, null, '{}', false, 80),
    (c_hot, 'Sıcak Çikolata', null, 130, null, '{}', false, 90),
    (c_hot, 'Salep', 'Tarçınlı, kış klasiği', 140, null, '{}', false, 100),
    (c_hot, 'Bitki Çayı', 'Ihlamur, kuşburnu, yeşil çay', 90, null, '{}', false, 110),

    (c_cold, 'Su', null, 20, null, '{}', false, 10),
    (c_cold, 'Maden Suyu', null, 40, null, '{}', false, 20),
    (c_cold, 'Ayran', null, 45, null, '{}', false, 30),
    (c_cold, 'Kola', '330 ml', 70, null, '{}', false, 40),
    (c_cold, 'Churchill', 'Maden suyu, limon, tuz', 80, null, '{}', false, 50),
    (c_cold, 'Ev Yapımı Limonata', null, 110, null, '{}', false, 60),
    (c_cold, 'Ice Latte', null, 140, null, '{}', false, 70),
    (c_cold, 'Ice Americano', null, 120, null, '{}', false, 80),
    (c_cold, 'Enerji İçeceği', null, 120, null, '{}', false, 90),

    (c_shake, 'Çilekli Milkshake', 'Çilek sosu ve krema ile', 160, 'images/milkshake.webp', '{popüler}', true, 10),
    (c_shake, 'Çikolatalı Milkshake', null, 160, null, '{}', false, 20),
    (c_shake, 'Muzlu Milkshake', null, 160, null, '{}', false, 30),
    (c_shake, 'Frozen (Çilek / Mango)', null, 150, null, '{}', false, 40),
    (c_shake, 'Mojito (Alkolsüz)', null, 150, null, '{}', false, 50),

    (c_dessert, 'Frambuazlı Cheesecake', null, 170, null, '{}', true, 10),
    (c_dessert, 'Brownie', 'Dondurma ile', 160, null, '{}', false, 20),
    (c_dessert, 'Sufle', null, 170, null, '{}', false, 30),
    (c_dessert, 'Waffle', 'Meyve ve çikolata sos', 220, null, '{}', false, 40),
    (c_dessert, 'Magnolia', null, 150, null, '{}', false, 50),

    (c_snack, 'Kaşarlı Tost', null, 130, null, '{}', false, 10),
    (c_snack, 'Karışık Tost', 'Sucuk, kaşar', 160, null, '{}', false, 20),
    (c_snack, 'Patates Kızartması', null, 140, null, '{}', false, 30),
    (c_snack, 'Çerez Tabağı', 'Okey masasına özel', 120, null, '{}', false, 40);
end $$;

insert into lucana.tables(name, area, code, sort)
select 'Masa ' || i, 'Salon', lucana._new_table_code(), i * 10
from generate_series(1, 10) i
where not exists (select 1 from lucana.tables);

insert into lucana.inventory_items(name, category, unit, qty, critical)
select * from (values
  ('Nargile kömürü', 'Nargile', 'kg', 20, 5),
  ('Nargile tütünü (karışık)', 'Nargile', 'paket', 12, 4),
  ('Nargile hortumu (tek kullanımlık)', 'Nargile', 'adet', 80, 20),
  ('Alüminyum folyo', 'Nargile', 'rulo', 6, 2),
  ('Çay', 'Bar', 'kg', 6, 2),
  ('Türk kahvesi', 'Bar', 'kg', 3, 1),
  ('Espresso çekirdeği', 'Bar', 'kg', 4, 1),
  ('Süt', 'Bar', 'lt', 15, 5),
  ('Şeker', 'Bar', 'kg', 5, 2),
  ('Peçete', 'Sarf', 'paket', 30, 10)
) v(name, category, unit, qty, critical)
where not exists (select 1 from lucana.inventory_items);
