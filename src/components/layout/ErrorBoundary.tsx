import { Component, type ReactNode } from "react";

/** Beklenmeyen bir hatada beyaz ekran yerine yenileme seçeneği gösterir. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[Lucana]", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-script text-6xl text-gold">Lucana</p>
        <p className="font-display text-2xl">Bir şeyler ters gitti</p>
        <p className="max-w-sm text-sm text-smoke-400">Sayfayı yenilemek genellikle sorunu çözer.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-gold-sheen px-6 py-3 font-semibold text-night-950"
        >
          Sayfayı yenile
        </button>
      </div>
    );
  }
}
