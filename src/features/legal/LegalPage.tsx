import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { SiteFooter, SiteNav } from "@/components/layout/SiteChrome";
import { LEGAL } from "@/lib/legal";
import { cn } from "@/lib/utils";

export default function LegalPage() {
  const { doc = "kvkk" } = useParams();
  const current = LEGAL.find((d) => d.id === doc) ?? LEGAL[0];
  useEffect(() => {
    document.title = `${current.title} · Lucana`;
  }, [current]);

  return (
    <div>
      <SiteNav solid />
      <main className="container max-w-3xl pb-20 pt-[calc(var(--safe-top)+6rem)]">
        <p className="eyebrow">Yasal</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">{current.title}</h1>
        <nav className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4">
          {LEGAL.map((d) => (
            <Link
              key={d.id}
              to={`/yasal/${d.id}`}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm",
                d.id === current.id ? "border-gold-300 bg-gold-300 text-night-950" : "border-white/10 text-smoke-300",
              )}
            >
              {d.title}
            </Link>
          ))}
        </nav>
        <article className="card mt-6 whitespace-pre-line p-6 text-[15px] leading-relaxed text-smoke-300">{current.body}</article>
      </main>
      <SiteFooter />
    </div>
  );
}
