import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { MenuBrowser } from "@/components/menu/MenuBrowser";
import { AnnouncementBar, SiteFooter, SiteNav } from "@/components/layout/SiteChrome";
import { PageLoader } from "@/components/ui";
import { publicApi } from "@/lib/api/public";
import type { MenuData } from "@/types";

export default function MenuPage() {
  const [menu, setMenu] = useState<MenuData | null>(publicApi.cachedMenu());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Menü · Lucana Cafe & Lounge";
    publicApi
      .menu()
      .then(setMenu)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <AnnouncementBar />
      <SiteNav solid />
      <main className="container min-h-screen pb-24 pt-24">
        <header className="py-8 text-center">
          <p className="eyebrow">Lucana</p>
          <h1 className="mt-2 font-script text-7xl text-gold md:text-8xl">Menü</h1>
          <p className="mx-auto mt-4 flex max-w-md items-center justify-center gap-2 text-sm text-smoke-400">
            <QrCode className="h-4 w-4 shrink-0 text-gold-300" />
            Sipariş vermek için masanızdaki QR kodu okutun.
          </p>
        </header>
        {menu ? (
          <MenuBrowser menu={menu} stickyTop={56} />
        ) : error ? (
          <p className="py-20 text-center text-smoke-400">Menü yüklenemedi: {error}</p>
        ) : (
          <PageLoader />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
