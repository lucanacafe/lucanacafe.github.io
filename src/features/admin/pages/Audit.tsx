import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button, Empty, PageLoader } from "@/components/ui";
import { adminApi, type AuditRow } from "@/lib/api/admin";
import { cn, fmtDateTime } from "@/lib/utils";

const ACTION: Record<string, { label: string; cls: string }> = {
  login: { label: "Giriş", cls: "text-sky-300" },
  create: { label: "Ekleme", cls: "text-emerald-300" },
  update: { label: "Güncelleme", cls: "text-gold-200" },
  delete: { label: "Silme", cls: "text-wine-400" },
  paid: { label: "Ödeme", cls: "text-emerald-300" },
  cancelled: { label: "İptal", cls: "text-wine-400" },
  password: { label: "Şifre", cls: "text-ember-300" },
  kick: { label: "Oturum kapatma", cls: "text-ember-300" },
};

const PAGE = 100;

export default function Audit() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [more, setMore] = useState(true);

  useEffect(() => {
    setRows(null);
    adminApi.audit(PAGE, 0, query).then((r) => {
      setRows(r);
      setMore(r.length === PAGE);
    });
  }, [query]);

  return (
    <div className="space-y-4">
      <form
        className="relative max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-smoke-500" />
        <input className="input pl-10" placeholder="Personel veya işlem ara… (Enter)" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      {!rows ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <Empty title="Kayıt bulunamadı" />
      ) : (
        <>
          <div className="card divide-y divide-white/5">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-col gap-1 p-3.5 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-32 shrink-0 text-xs text-smoke-500">{fmtDateTime(r.at)}</span>
                <span className={cn("w-28 shrink-0 text-xs font-semibold uppercase tracking-wide", ACTION[r.action]?.cls ?? "text-smoke-300")}>
                  {ACTION[r.action]?.label ?? r.action}
                </span>
                <span className="flex-1 text-sm">{r.summary}</span>
                <span className="shrink-0 text-xs text-smoke-400">{r.staff_label}</span>
              </div>
            ))}
          </div>
          {more && (
            <Button
              variant="subtle"
              className="w-full"
              onClick={async () => {
                const next = await adminApi.audit(PAGE, rows.length, query);
                setRows([...rows, ...next]);
                setMore(next.length === PAGE);
              }}
            >
              Daha fazla yükle
            </Button>
          )}
        </>
      )}
    </div>
  );
}
