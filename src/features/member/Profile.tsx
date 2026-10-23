import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, EyeOff, KeyRound, LogOut, Megaphone, Pencil, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CustomerShell } from "@/components/customer/CustomerChrome";
import { Button, Field, Modal, PageLoader, Switch } from "@/components/ui";
import { memberApi, type LedgerRow } from "@/lib/api/member";
import { pushState, subscribeMember, unsubscribe, type PushState } from "@/lib/push";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { cn, deviceId, fmtDateTime, money } from "@/lib/utils";
import { useMember, useRequireMember } from "./MemberContext";

const AVATARS = ["🔥", "☕", "🍹", "🎲", "🃏", "👑", "🌙", "⭐", "🍓", "🍋", "💨", "🎯", "🦁", "🐺", "🦊", "🐉", "🎸", "⚽", "🏀", "🎮", "💎", "🚀", "🌶️", "🍀"];
const KIND: Record<LedgerRow["kind"], string> = {
  earn: "Sipariş puanı",
  redeem: "İndirim",
  refund: "İade",
  admin: "Lucana hediyesi",
  skill_reward: "Blok ödülü",
  farm_seed: "Tohum",
  farm_harvest: "Hasat",
  farm_help: "Sulama teşekkürü",
  farm_plot: "Yeni tarla",
};

export default function Profile() {
  useRequireMember();
  const { member, setMember, logout } = useMember();
  const [history, setHistory] = useState<LedgerRow[] | null>(null);
  const [editNick, setEditNick] = useState(false);
  const [nick, setNick] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [push, setPush] = useState<PushState | null>(null);
  const pwa = usePwaInstall();

  useEffect(() => {
    document.title = "Profil · Lucana";
    pushState().then(setPush);
  }, []);
  useEffect(() => {
    if (member) memberApi.history(60).then(setHistory).catch(() => {});
  }, [member?.id, member?.points]);

  if (!member) return <CustomerShell><PageLoader /></CustomerShell>;

  async function patch(p: Parameters<typeof memberApi.update>[0]) {
    try {
      setMember(await memberApi.update(p));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <CustomerShell>
      <main className="container max-w-lg space-y-5 pt-5">
        {/* kimlik */}
        <section className="card overflow-hidden">
          <div className="bg-[radial-gradient(400px_200px_at_50%_0%,rgba(232,193,112,.2),transparent)] p-5 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold-300 bg-night-800 text-5xl shadow-glow">
              {member.avatar}
            </div>
            {editNick ? (
              <form
                className="mx-auto mt-3 flex max-w-xs gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await patch({ nickname: nick });
                  setEditNick(false);
                }}
              >
                <input className="input h-10" value={nick} maxLength={24} onChange={(e) => setNick(e.target.value)} autoFocus />
                <Button size="sm" type="submit">Kaydet</Button>
              </form>
            ) : (
              <button
                className="mt-3 inline-flex items-center gap-2 font-display text-2xl font-semibold"
                onClick={() => {
                  setNick(member.nickname);
                  setEditNick(true);
                }}
              >
                {member.nickname} <Pencil className="h-4 w-4 text-smoke-500" />
              </button>
            )}
            {member.username && <p className="text-sm text-smoke-500">@{member.username}</p>}
            <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => patch({ avatar: a })}
                  className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl", a === member.avatar ? "bg-gold-400/25 ring-2 ring-gold-300" : "bg-white/5")}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* puan */}
        <section className="card p-5">
          <p className="eyebrow">Puanların</p>
          <p className="mt-2 font-display text-5xl font-semibold text-gold">⭐ {member.points.toLocaleString("tr-TR")}</p>
          <p className="mt-1 text-sm text-smoke-400">
            = <b className="text-emerald-300">{money(member.discount_value)}</b> indirim değerinde
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-white/[0.04] p-2.5">
              <p className="font-bold text-gold-100">1 ₺ = {member.rates.earn}</p>
              <p className="text-smoke-500">puan kazanırsın</p>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-2.5">
              <p className="font-bold text-gold-100">{member.rates.redeem} puan</p>
              <p className="text-smoke-500">= 1 ₺ indirim</p>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-2.5">
              <p className="font-bold text-gold-100">%{member.rates.max_discount_pct}</p>
              <p className="text-smoke-500">sepete kadar</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-smoke-500">Toplam kazandığın: {member.lifetime_earned.toLocaleString("tr-TR")} puan</p>
        </section>

        {/* hesabı koru */}
        {!member.has_password && (
          <section className="rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4">
            <p className="flex items-center gap-2 font-semibold text-ember-200">
              <KeyRound className="h-4 w-4" /> Puanlarını kaybetme
            </p>
            <p className="mt-1 text-sm text-smoke-300">
              Hesabın şu an yalnızca bu telefonda. Kullanıcı adı + şifre belirle, başka cihazdan da gir.
            </p>
            <Button size="sm" className="mt-3" onClick={() => setSaveOpen(true)}>Hesabımı kaydet</Button>
          </section>
        )}

        {/* ayarlar */}
        <section className="card divide-y divide-white/5">
          <Row icon={<EyeOff className="h-5 w-5" />} title="Görünmez mod" text="Canlı akışta ve liderlikte görünme">
            <Switch checked={member.is_hidden} onChange={(v) => patch({ is_hidden: v })} />
          </Row>
          <Row icon={<Megaphone className="h-5 w-5" />} title="Kampanya bildirimleri" text="Açık rıza — istediğin an kapat">
            <Switch checked={member.marketing_ok} onChange={(v) => patch({ marketing_ok: v })} />
          </Row>
          <Row
            icon={<BellRing className="h-5 w-5" />}
            title="Bildirimler"
            text={
              push === "on" ? "Açık — sipariş ve puan bildirimleri" :
              push === "denied" ? "Tarayıcı ayarlarından izin ver" :
              push === "needs-install" ? "iPhone: önce Ana Ekrana Ekle" :
              push === "unsupported" ? "Bu tarayıcı desteklemiyor" : "Sipariş hazır, puan kazandın…"
            }
          >
            {(push === "on" || push === "off") && (
              <Switch
                checked={push === "on"}
                onChange={async (v) => {
                  try {
                    if (v) await subscribeMember(deviceId());
                    else await unsubscribe();
                    setPush(v ? "on" : "off");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            )}
          </Row>
          {pwa.canInstall && (
            <Row icon={<Smartphone className="h-5 w-5" />} title="Uygulamayı yükle" text={pwa.isIos ? "Paylaş → Ana Ekrana Ekle" : "Ana ekranına ekle"}>
              {!pwa.isIos && <Button size="sm" variant="subtle" onClick={() => pwa.install()}>Yükle</Button>}
            </Row>
          )}
          {member.has_password && (
            <Row icon={<KeyRound className="h-5 w-5" />} title="Şifre / kullanıcı adı" text={`@${member.username}`}>
              <Button size="sm" variant="subtle" onClick={() => setSaveOpen(true)}>Değiştir</Button>
            </Row>
          )}
        </section>

        {/* geçmiş */}
        <section>
          <h2 className="eyebrow mb-2">Puan geçmişi</h2>
          {!history ? (
            <PageLoader />
          ) : history.length === 0 ? (
            <p className="card p-5 text-center text-sm text-smoke-500">Henüz hareket yok. İlk siparişinle puan kazan!</p>
          ) : (
            <ul className="card divide-y divide-white/5">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{KIND[h.kind]}</span>
                    <span className="block truncate text-xs text-smoke-500">{h.note} · {fmtDateTime(h.at)}</span>
                  </span>
                  <span className={cn("font-bold tabular-nums", h.delta > 0 ? "text-emerald-300" : "text-wine-400")}>
                    {h.delta > 0 ? "+" : ""}
                    {h.delta.toLocaleString("tr-TR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* yasal + çıkış */}
        <section className="space-y-2 pb-4 text-sm">
          <Link to="/yasal/kvkk" className="flex items-center gap-2 text-smoke-400 hover:text-smoke-200">
            <ShieldCheck className="h-4 w-4" /> KVKK, koşullar ve puan/oyun kuralları
          </Link>
          <button
            className="flex items-center gap-2 text-smoke-400 hover:text-smoke-200"
            onClick={async () => {
              if (!member.has_password && !confirm("Hesabını kaydetmedin. Çıkış yaparsan bu puanlara bir daha erişemezsin. Yine de çıkılsın mı?")) return;
              await logout();
              toast("Çıkış yapıldı");
            }}
          >
            <LogOut className="h-4 w-4" /> Çıkış yap
          </button>
          <button
            className="flex items-center gap-2 text-wine-400"
            onClick={async () => {
              if (!confirm("Hesabın, puanların ve tüm kişisel verilerin kalıcı olarak silinecek. Emin misin?")) return;
              try {
                await memberApi.deleteAccount();
                setMember(null);
                toast("Hesabın silindi");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> Hesabımı ve verilerimi sil (KVKK)
          </button>
        </section>
      </main>

      <SaveAccountModal open={saveOpen} onClose={() => setSaveOpen(false)} />
    </CustomerShell>
  );
}

function Row({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-gold-300">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-smoke-500">{text}</span>
      </span>
      {children}
    </div>
  );
}

function SaveAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { member, setMember } = useMember();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setU(member?.username ?? "");
      setP("");
    }
  }, [open, member?.username]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hesabımı kaydet"
      size="sm"
      footer={
        <Button
          className="w-full"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setMember(await memberApi.saveAccount(u.trim().toLowerCase(), p));
              toast.success("Hesabın kaydedildi 🔐");
              onClose();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Kaydet
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-smoke-400">Başka bir cihazdan “Zaten hesabın var mı? Giriş yap” ile bu bilgilerle girebilirsin.</p>
        <Field label="Kullanıcı adı" hint="3-24 karakter: küçük harf, rakam, . _ -">
          <input className="input" autoCapitalize="none" autoComplete="username" value={u} onChange={(e) => setU(e.target.value.toLowerCase().replace(/\s/g, ""))} />
        </Field>
        <Field label="Şifre" hint="En az 6 karakter">
          <input className="input" type="password" autoComplete="new-password" value={p} onChange={(e) => setP(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
