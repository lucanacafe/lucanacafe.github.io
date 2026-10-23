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
const GamesHub = lazy(() => import("@/features/games/GamesHub"));
const FarmGame = lazy(() => import("@/features/games/FarmGame"));
const BlokGame = lazy(() => import("@/features/games/BlokGame"));
const Leaderboard = lazy(() => import("@/features/social/Leaderboard"));
const Profile = lazy(() => import("@/features/member/Profile"));
const LegalPage = lazy(() => import("@/features/legal/LegalPage"));

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
          <Route path="/oyun" element={<GamesHub />} />
          <Route path="/oyun/bahce" element={<FarmGame />} />
          <Route path="/oyun/bahce/:owner" element={<FarmGame />} />
          <Route path="/oyun/blok" element={<BlokGame />} />
          <Route path="/liderler" element={<Leaderboard />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="/yasal" element={<LegalPage />} />
          <Route path="/yasal/:doc" element={<LegalPage />} />
          <Route path="/panel/*" element={<AdminApp />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
