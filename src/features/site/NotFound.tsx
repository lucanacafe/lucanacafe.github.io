import { Link } from "react-router-dom";
import { Button } from "@/components/ui";
import { Logo } from "@/components/ui/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo className="text-7xl" />
      <p className="font-display text-3xl italic text-smoke-200">Aradığınız sayfa dumanlar arasında kayboldu.</p>
      <Link to="/">
        <Button>Ana sayfaya dön</Button>
      </Link>
    </div>
  );
}
