-- Test verisini temizler (menü, masalar, personel, ayarlar KORUNUR).
-- Kullanım: node scripts/db.mjs sql "$(cat scripts/reset-test-data.sql)"
delete from lucana.game_rounds;
delete from lucana.pool_ledger;
update lucana.game_pool set balance = 0 where id = 1;
delete from lucana.orders;
delete from lucana.waiter_calls;
delete from lucana.stock_moves;
delete from lucana.day_counters;
delete from lucana.members;
delete from lucana.farm_plots;
delete from lucana.push_subscriptions;
delete from lucana.login_attempts;
select 'temizlendi' as durum;
