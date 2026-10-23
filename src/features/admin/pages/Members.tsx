import { useEffect, useMemo, useState } from "react";
import { Ban, Gift, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Empty, Modal, PageLoader, Segmented } from "@/components/ui";
import { Stat } from "@/components/ui/charts";
import { useLive } from "@/hooks/useLive";
import { adminApi, type MemberRow } from "@/lib/api/admin";
import { LEVEL } from "@/lib/constants";
import { cn, fmtDateTime, money, normalize, timeAgo } from "@/lib/utils";
import { useAuth } from "../auth";

type Sort = "recent" | "points" | "spent";

export default function Members() {
  const { data, loading, reload } = useLive(() => adminApi.members(), { interval: 30000, topic: "lucana-staff" });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [sel, setSel] = useState<MemberRow | null>(null);

  const list = useMemo(() => {
    const n = normalize(q);
    const rows = (data ?? []).filter((m) => !n || normalize(`${m.nickname} ${m.username ?? ""}`).includes(n));
    if (sort === "points") rows.sort((a, b) => b.points - a.points);
    if (sort === "spent") rows.sort((a, b) => Number(b.spent) - Number(a.spent));
    return rows;
  }, [data, q, sort]);

  if (loading && !data) return <PageLoader />;
  const all = data ?? [];
  const here = all.filter((m) => m.at_table).length;
  const pointsOut = all.reduce((s, m) => s + m.points, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Üye" value={all.length} />
        <Stat label="Şu an masada" value={here} tone="emerald" />
        <Stat label="Dolaşımdaki puan" value={pointsOut.toLocaleString("tr-TR")} hint={`≈ ${money(pointsOut / 100)} indirim yükü`} tone="ember" />
        <Stat label="Kayıtlı hesap" value={all.filter((m) => m.username).length} hint="şifre belirlemiş" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-smoke-500" />
          <input className="input pl-10" placeholder="Takma ad / kullanıcı adı…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented value={sort} onChange={setSort} options={[{ value: "recent", label: "Son görülen" }, { value: "points", label: "Puan" }, { value: "spent", label: "Harcama" }]} />
      </div>

      {list.length === 0 ? (
        <Empty title="Üye yok" text="Müşteriler masadaki QR'ı okuttukça burada görünür." />
      ) : (
        <div className="card divide-y divide-white/5">
          {list.map((m) => (
            <button key={m.id} onClick={() => setSel(m)} className={cn("flex w-full items-center gap-3 p-3.5 text-left hover:bg-white/[0.02]", m.is_banned && "opacity-50")}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-night-700 text-xl">{m.avatar}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {m.nickname}
                  {m.username && <span className="text-xs font-normal text-smoke-500">@{m.username}</span>}
                  {m.at_table && <Badge className="border-emerald-400/30 text-emerald-300">{m.at_table}</Badge>}
                  {m.is_banned && <Badge className="border-wine-500/40 text-wine-400">Kısıtlı</Badge>}
                  {m.is_hidden && <Badge className="text-smoke-400">Gizli</Badge>}
                </span>
                <span className="text-xs text-smoke-500">
                  {m.orders_paid} sipariş · {money(m.spent)} · oyun {m.game_net > 0 ? "+" : ""}{m.game_net} · {timeAgo(m.last_seen_at)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-bold text-gold-200">⭐ {m.points.toLocaleString("tr-TR")}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {sel && <MemberModal member={sel} onClose={() => setSel(null)} onChanged={reload} />}
    </div>
  );
}

function MemberModal({ member, onClose, onChanged }: { member: MemberRow; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminApi.memberDetail>> | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => adminApi.memberDetail(member.id).then(setDetail);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id]);

  return (
    <Modal open onClose={onClose} title={`${member.avatar} ${member.nickname}`} size="lg">
      {!detail ? (
        <PageLoader />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/[0.04] p-3">
              <p className="font-display text-2xl font-semibold text-gold-200">{detail.member.points.toLocaleString("tr-TR")}</p>
              <p className="text-xs text-smoke-500">puan</p>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-3">
              <p className="font-display text-2xl font-semibold">{money(member.spent)}</p>
              <p className="text-xs text-smoke-500">{member.orders_paid} ödenmiş sipariş</p>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-3">
              <p className={cn("font-display text-2xl font-semibold", member.game_net >= 0 ? "text-emerald-300" : "text-wine-400")}>{member.game_net}</p>
              <p className="text-xs text-smoke-500">oyunlardan (net)</p>
            </div>
          </div>
          <p className="text-xs text-smoke-500">
            Kayıt: {fmtDateTime(member.created_at)} · Son görülme: {timeAgo(member.last_seen_at)} · Kampanya izni: {member.marketing_ok ? "var" : "yok"}
          </p>

          {can(LEVEL.MANAGER) && (
            <div className="rounded-2xl border hairline p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Gift className="h-4 w-4 text-gold-300" /> Puan ekle / düş
              </p>
              <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                <input className="input" placeholder="+500 / -200" inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} />
                <input className="input" placeholder="Açıklama (zorunlu)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button
                  loading={busy}
                  onClick={async () => {
                    const n = parseInt(delta, 10);
                    if (!n) return toast.error("Miktar girin");
                    setBusy(true);
                    try {
                      await adminApi.memberPoints(member.id, n, reason);
                      toast.success("Puan güncellendi");
                      setDelta("");
                      setReason("");
                      load();
                      onChanged();
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Uygula
                </Button>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant={member.is_banned ? "subtle" : "danger"}
                  onClick={async () => {
                    await adminApi.memberBan(member.id, !member.is_banned).catch((e) => toast.error(e.message));
                    toast(member.is_banned ? "Kısıtlama kaldırıldı" : "Üye kısıtlandı (oyun ve puan kullanımı kapalı)");
                    onChanged();
                    onClose();
                  }}
                >
                  {member.is_banned ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                  {member.is_banned ? "Kısıtlamayı kaldır" : "Kısıtla"}
                </Button>
              </div>
            </div>
          )}

          <div>
            <p className="label">Puan hareketleri</p>
            {detail.ledger.length === 0 ? (
              <p className="text-sm text-smoke-500">Hareket yok.</p>
            ) : (
              <ul className="divide-y divide-white/5 rounded-2xl border hairline">
                {detail.ledger.map((l, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{l.note ?? l.kind}</span>
                      <span className="text-xs text-smoke-500">{fmtDateTime(l.at)}{l.staff && ` · ${l.staff}`}</span>
                    </span>
                    <span className={cn("font-bold tabular-nums", l.delta > 0 ? "text-emerald-300" : "text-wine-400")}>
                      {l.delta > 0 ? "+" : ""}{l.delta}
                    </span>
                    <span className="w-16 text-right text-xs text-smoke-500">{l.balance_after}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

