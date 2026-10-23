-- =============================================================
--  Lucana — 9999 Yetkiler (her zaman en son çalışır)
--  Bu dosya her migration sonrası tekrar çalıştırılabilir (idempotent).
--  Kural: tablolara SIFIR erişim; yalnızca adı "_" ile başlamayan
--  RPC'ler anon'a açılır. "_" ile başlayanlar iç yardımcıdır.
-- =============================================================

grant usage on schema lucana to anon, authenticated, service_role;

revoke all on all tables    in schema lucana from public, anon, authenticated;
revoke all on all sequences in schema lucana from public, anon, authenticated;
revoke all on all functions in schema lucana from public, anon, authenticated;

grant all on all tables    in schema lucana to service_role;
grant all on all sequences in schema lucana to service_role;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'lucana' and p.proname not like '\_%'
  loop
    execute format('grant execute on function %s to anon, authenticated', f.sig);
  end loop;
end $$;

-- PostgREST şema önbelleğini yenile
notify pgrst, 'reload schema';
