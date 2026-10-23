import { useEffect, useState } from "react";
import { LogOut, Pencil, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Field, Modal, PageLoader, Switch } from "@/components/ui";
import { useLive } from "@/hooks/useLive";
import { adminApi, type Role, type StaffRow } from "@/lib/api/admin";
import { LEVEL } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
import { useAuth } from "../auth";

const ROLE_INFO: Record<string, string> = {
  founder: "Her şey: personel, ayarlar, raporlar",
  manager: "Menü, fiyat, stok, masa/QR, ayarlar, alt personel",
  cashier: "Ödeme alma, iptal, ciro raporları",
  waiter: "Sipariş girme, çağrılar, stok hareketi, ürünü gizleme",
  kitchen: "Siparişleri hazırlama / servis durumu",
};

export default function Staff() {
  const { user } = useAuth();
  const { data, loading, reload } = useLive(adminApi.staff, { interval: 60000 });
  const [roles, setRoles] = useState<Role[]>([]);
  const [edit, setEdit] = useState<(Partial<StaffRow> & { password?: string }) | null>(null);

  useEffect(() => {
    adminApi.roles().then(setRoles);
  }, []);

  if (loading && !data) return <PageLoader />;
  const myLevel = user!.level;
  const canEdit = (s: StaffRow) => s.id === user!.id || myLevel >= LEVEL.FOUNDER || s.level < myLevel;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-auto max-w-xl text-sm text-smoke-400">
          Personel hesaplarını yalnızca yetkililer açar (kayıt yok). Yeni personel ilk girişte şifresini değiştirmek zorundadır.
        </p>
        <Button onClick={() => setEdit({ is_active: true, role_id: roles.find((r) => r.key === "waiter")?.id })}>
          <UserPlus className="h-4 w-4" /> Personel ekle
        </Button>
      </div>

      <div className="card divide-y divide-white/5">
        {(data ?? []).map((s) => (
          <div key={s.id} className={cn("flex items-center gap-4 p-4", !s.is_active && "opacity-50")}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold" style={{ background: s.color + "26", color: s.color }}>
              {s.full_name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {s.full_name}
                {s.id === user!.id && <Badge className="text-smoke-400">Siz</Badge>}
                {!s.is_active && <Badge className="border-wine-500/40 text-wine-400">Pasif</Badge>}
                {s.must_change_pw && s.is_active && <Badge className="border-ember-500/40 text-ember-300">Şifre bekleniyor</Badge>}
              </p>
              <p className="text-xs text-smoke-500">
                @{s.username} · {s.last_login_at ? `son giriş ${timeAgo(s.last_login_at)}` : "hiç giriş yapmadı"}
              </p>
            </div>
            <Badge className="hidden sm:inline-flex" >
              <span style={{ color: s.color }}>{s.role_name}</span>
            </Badge>
            {canEdit(s) && (
              <div className="flex shrink-0">
                {s.id !== user!.id && (
                  <button
                    className="rounded-lg p-2 text-smoke-500 hover:text-ember-300"
                    title="Tüm oturumlarını kapat"
                    onClick={async () => {
                      if (!confirm(`${s.full_name} tüm cihazlardan çıkarılsın mı?`)) return;
                      await adminApi.kickStaff(s.id).catch((e) => toast.error(e.message));
                      toast.success("Oturumlar kapatıldı");
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
                <button className="rounded-lg p-2 text-smoke-500 hover:text-gold-200" title="Düzenle" onClick={() => setEdit(s)}>
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <section>
        <h2 className="eyebrow mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Yetki seviyeleri</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {roles.map((r) => (
            <div key={r.id} className="card p-4">
              <p className="font-semibold" style={{ color: r.color }}>{r.name}</p>
              <p className="text-xs text-smoke-500">Seviye {r.level}</p>
              <p className="mt-2 text-sm text-smoke-300">{ROLE_INFO[r.key]}</p>
            </div>
          ))}
        </div>
      </section>

      <StaffModal
        staff={edit}
        roles={roles.filter((r) => myLevel >= LEVEL.FOUNDER || r.level < myLevel)}
        isSelf={edit?.id === user!.id}
        onClose={() => setEdit(null)}
        onSaved={reload}
      />
    </div>
  );
}

function StaffModal({
  staff,
  roles,
  isSelf,
  onClose,
  onSaved,
}: {
  staff: (Partial<StaffRow> & { password?: string }) | null;
  roles: Role[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<Partial<StaffRow> & { password?: string }>({});
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (staff && key !== (staff.id ?? "new")) {
    setF({ ...staff, password: "" });
    setKey(staff.id ?? "new");
  }
  if (!staff && key !== null) setKey(null);
  const isNew = !staff?.id;

  return (
    <Modal
      open={!!staff}
      onClose={onClose}
      title={isNew ? "Yeni personel" : "Personeli düzenle"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="subtle" onClick={onClose}>Vazgeç</Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await adminApi.saveStaff(f);
                toast.success(isNew ? "Personel eklendi" : "Kaydedildi");
                onSaved();
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
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad soyad" className="sm:col-span-2">
          <input className="input" value={f.full_name ?? ""} onChange={(e) => setF({ ...f, full_name: e.target.value })} autoFocus />
        </Field>
        <Field label="Kullanıcı adı" hint="küçük harf, rakam, . _ -">
          <input
            className="input"
            autoCapitalize="none"
            value={f.username ?? ""}
            onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
          />
        </Field>
        <Field label="Rol">
          <select className="input" value={f.role_id ?? ""} disabled={isSelf} onChange={(e) => setF({ ...f, role_id: e.target.value })}>
            {isSelf && <option value={f.role_id}>{f.role_name}</option>}
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name} (seviye {r.level})</option>)}
          </select>
        </Field>
        <Field
          label={isNew ? "Geçici şifre" : "Şifreyi sıfırla"}
          hint={isNew ? "En az 8 karakter; ilk girişte değiştirilecek" : "Boş bırakırsanız değişmez. Sıfırlanırsa personel yeniden değiştirmek zorunda kalır."}
          className="sm:col-span-2"
        >
          <input className="input" type="text" autoComplete="new-password" value={f.password ?? ""} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        {!isSelf && (
          <label className="flex items-center justify-between rounded-2xl border hairline p-4 sm:col-span-2">
            <span>
              <span className="block font-medium">Aktif</span>
              <span className="text-xs text-smoke-500">Pasif personel giriş yapamaz, oturumları kapanır</span>
            </span>
            <Switch checked={f.is_active !== false} onChange={(v) => setF({ ...f, is_active: v })} />
          </label>
        )}
      </div>
    </Modal>
  );
}
