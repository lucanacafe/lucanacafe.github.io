import { KeyRound } from "lucide-react";
import { Logo } from "@/components/ui/brand";
import { useAuth } from "../auth";
import { PasswordForm } from "./Account";

/** İlk girişte / şifre sıfırlandığında zorunlu şifre değişimi */
export default function ForcePassword() {
  const { user, refresh, logout } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="text-center">
          <Logo className="text-5xl" sub={false} />
          <KeyRound className="mx-auto mt-6 h-8 w-8 text-gold-300" />
          <h1 className="mt-3 font-display text-2xl font-semibold">Yeni şifre belirleyin</h1>
          <p className="mt-1 text-sm text-smoke-400">
            Merhaba {user?.full_name}. Güvenliğiniz için geçici şifrenizi değiştirmeniz gerekiyor.
          </p>
        </div>
        <div className="mt-6">
          <PasswordForm onDone={refresh} />
        </div>
        <button onClick={logout} className="mt-4 w-full text-center text-xs text-smoke-500 hover:text-smoke-300">
          Çıkış yap
        </button>
      </div>
    </div>
  );
}
