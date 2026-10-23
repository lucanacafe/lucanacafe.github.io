import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PageLoader } from "@/components/ui";
import { LEVEL } from "@/lib/constants";
import { AuthProvider, useAuth } from "./auth";
import { AdminLayout } from "./AdminLayout";
import Login from "./pages/Login";
import ForcePassword from "./pages/ForcePassword";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Orders = lazy(() => import("./pages/Orders"));
const Tables = lazy(() => import("./pages/Tables"));
const MenuAdmin = lazy(() => import("./pages/MenuAdmin"));
const Stock = lazy(() => import("./pages/Stock"));
const TablesQr = lazy(() => import("./pages/TablesQr"));
const Reports = lazy(() => import("./pages/Reports"));
const Staff = lazy(() => import("./pages/Staff"));
const Audit = lazy(() => import("./pages/Audit"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const Account = lazy(() => import("./pages/Account"));

function Guard({ min, children }: { min: number; children: JSX.Element }) {
  const { can } = useAuth();
  return can(min) ? children : <Navigate to="/panel" replace />;
}

function Shell() {
  const { user, ready } = useAuth();
  useEffect(() => {
    document.title = "Yönetim · Lucana";
    // Panel arama motorlarında görünmesin
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex,nofollow";
    document.head.appendChild(m);
    return () => m.remove();
  }, []);

  if (!ready) return <PageLoader />;
  if (!user) return <Login />;
  if (user.must_change_pw) return <ForcePassword />;

  return (
    <AdminLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="siparisler" element={<Orders />} />
          <Route path="masalar" element={<Tables />} />
          <Route path="menu" element={<MenuAdmin />} />
          <Route path="stok" element={<Guard min={LEVEL.WAITER}><Stock /></Guard>} />
          <Route path="qr" element={<Guard min={LEVEL.MANAGER}><TablesQr /></Guard>} />
          <Route path="rapor" element={<Guard min={LEVEL.CASHIER}><Reports /></Guard>} />
          <Route path="personel" element={<Guard min={LEVEL.MANAGER}><Staff /></Guard>} />
          <Route path="gecmis" element={<Guard min={LEVEL.MANAGER}><Audit /></Guard>} />
          <Route path="ayarlar" element={<Guard min={LEVEL.CASHIER}><SettingsPage /></Guard>} />
          <Route path="hesap" element={<Account />} />
          <Route path="*" element={<Navigate to="/panel" replace />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
