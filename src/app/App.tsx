import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { PageLoader } from "@/components/ui";
import Landing from "@/features/site/Landing";
import { PwaUpdater } from "@/components/layout/PwaUpdater";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";

// Menü/masa sayfaları ve panel ayrı paketlerde yüklenir → ana sayfa hızlı açılır
const MenuPage = lazy(() => import("@/features/site/MenuPage"));
const TablePage = lazy(() => import("@/features/table/TablePage"));
const AdminApp = lazy(() => import("@/features/admin/AdminApp"));
const NotFound = lazy(() => import("@/features/site/NotFound"));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!pathname.startsWith("/panel")) window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ScrollTop />
      <PwaUpdater />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/m/:code" element={<TablePage />} />
          <Route path="/panel/*" element={<AdminApp />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
