import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ChevronsDown, ChevronLeft, ChevronRight, Pause, Play, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { useMember } from "@/features/member/MemberContext";
import { gameApi, memberApi } from "@/lib/api/member";
import { cn } from "@/lib/utils";
import { fmt, GamePage, useGameInfo, useSyncPoints } from "./shared";

/* ------------------------------------------------------------------ Tetris motoru */
const W = 10;
const H = 20;
type Grid = number[][];
const SHAPES: number[][][] = [
  [[1, 1, 1, 1]], // I
  [[2, 2], [2, 2]], // O
  [[0, 3, 0], [3, 3, 3]], // T
  [[0, 4, 4], [4, 4, 0]], // S
  [[5, 5, 0], [0, 5, 5]], // Z
  [[6, 0, 0], [6, 6, 6]], // J
  [[0, 0, 7], [7, 7, 7]], // L
];
// Lucana paleti: altın, köz, bordo, ahşap...
const COLORS = ["", "#e8c170", "#f26b1d", "#c0475a", "#7fb08a", "#a3293c", "#6b8fbf", "#c48f35"];
const LINE_SCORE = [0, 100, 300, 500, 800];

interface Piece {
  m: number[][];
  x: number;
  y: number;
}

const empty = (): Grid => Array.from({ length: H }, () => Array(W).fill(0));
const rotate = (m: number[][]) => m[0].map((_, i) => m.map((r) => r[i]).reverse());
const bag = () => {
  const b = [0, 1, 2, 3, 4, 5, 6];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
function collides(g: Grid, p: Piece) {
  for (let y = 0; y < p.m.length; y++)
    for (let x = 0; x < p.m[y].length; x++)
      if (p.m[y][x]) {
        const gx = p.x + x;
        const gy = p.y + y;
        if (gx < 0 || gx >= W || gy >= H || (gy >= 0 && g[gy][gx])) return true;
      }
  return false;
}

interface State {
  grid: Grid;
  piece: Piece;
  next: number;
  queue: number[];
  score: number;
  lines: number;
  level: number;
  over: boolean;
}

function spawn(s: State): State {
  const queue = s.queue.length ? s.queue : bag();
  const [id, ...rest] = queue;
  const m = SHAPES[s.next];
  const piece = { m, x: Math.floor((W - m[0].length) / 2), y: -1 };
  const ns = { ...s, piece, next: id, queue: rest.length ? rest : bag() };
  if (collides(s.grid, { ...piece, y: piece.y + 1 }) && collides(s.grid, piece)) ns.over = true;
  return ns;
}

function newGame(): State {
  const q = bag();
  const s: State = { grid: empty(), piece: { m: SHAPES[0], x: 3, y: 0 }, next: q[0], queue: q.slice(1), score: 0, lines: 0, level: 1, over: false };
  return spawn(s);
}

function lock(s: State): State {
  const g = s.grid.map((r) => [...r]);
  s.piece.m.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v && s.piece.y + y >= 0) g[s.piece.y + y][s.piece.x + x] = v;
    }),
  );
  if (s.piece.y < 0) return { ...s, grid: g, over: true };
  const kept = g.filter((r) => r.some((c) => !c));
  const cleared = H - kept.length;
  while (kept.length < H) kept.unshift(Array(W).fill(0));
  const lines = s.lines + cleared;
  const level = 1 + Math.floor(lines / 10);
  return spawn({ ...s, grid: kept, lines, level, score: s.score + LINE_SCORE[cleared] * s.level });
}

/* ------------------------------------------------------------------ Bileşen */
export default function BlokGame() {
  const { member } = useMember();
  const { info, reload } = useGameInfo();
  const sync = useSyncPoints();
  const canvas = useRef<HTMLCanvasElement>(null);
  const nextCanvas = useRef<HTMLCanvasElement>(null);
  const st = useRef<State | null>(null);
  const roundId = useRef<string | null>(null);
  const [, force] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ score: number; lines: number; reward: number; valid: boolean } | null>(null);
  const [board, setBoard] = useState<Awaited<ReturnType<typeof memberApi.blokBoard>>>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    memberApi.blokBoard().then(setBoard).catch(() => {});
  }, []);

  const draw = useCallback(() => {
    const c = canvas.current;
    const s = st.current;
    if (!c || !s) return;
    const ctx = c.getContext("2d")!;
    const cell = c.width / W;
    ctx.fillStyle = "#0c0907";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    for (let x = 0; x <= W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, c.height);
      ctx.stroke();
    }
    const block = (x: number, y: number, v: number, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS[v];
      ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, 3);
      ctx.globalAlpha = 1;
    };
    s.grid.forEach((r, y) => r.forEach((v, x) => v && block(x, y, v)));
    // hayalet
    let gy = s.piece.y;
    while (!collides(s.grid, { ...s.piece, y: gy + 1 })) gy++;
    s.piece.m.forEach((r, y) => r.forEach((v, x) => v && gy + y >= 0 && block(s.piece.x + x, gy + y, v, 0.18)));
    s.piece.m.forEach((r, y) => r.forEach((v, x) => v && s.piece.y + y >= 0 && block(s.piece.x + x, s.piece.y + y, v)));

    const n = nextCanvas.current;
    if (n) {
      const nc = n.getContext("2d")!;
      nc.clearRect(0, 0, n.width, n.height);
      const m = SHAPES[s.next];
      const sz = 14;
      const ox = (n.width - m[0].length * sz) / 2;
      const oy = (n.height - m.length * sz) / 2;
      m.forEach((r, y) =>
        r.forEach((v, x) => {
          if (!v) return;
          nc.fillStyle = COLORS[v];
          nc.fillRect(ox + x * sz + 1, oy + y * sz + 1, sz - 2, sz - 2);
        }),
      );
    }
  }, []);

  const finish = useCallback(async () => {
    const s = st.current;
    setRunning(false);
    if (!s || !roundId.current) return;
    const id = roundId.current;
    roundId.current = null;
    try {
      const r = await gameApi.blokFinish(id, s.score, s.lines);
      const reward = Number(r.public.reward ?? 0);
      setResult({ score: s.score, lines: s.lines, reward, valid: Boolean(r.public.valid) });
      sync(r.points);
      reload();
      memberApi.blokBoard().then(setBoard).catch(() => {});
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [reload, sync]);

  const act = useCallback(
    (a: "left" | "right" | "rot" | "down" | "drop") => {
      const s = st.current;
      if (!s || s.over || !running || paused) return;
      let p = s.piece;
      if (a === "left") p = { ...p, x: p.x - 1 };
      if (a === "right") p = { ...p, x: p.x + 1 };
      if (a === "rot") {
        const m = rotate(p.m);
        // basit duvar tekmesi
        for (const dx of [0, -1, 1, -2, 2]) {
          if (!collides(s.grid, { ...p, m, x: p.x + dx })) {
            p = { ...p, m, x: p.x + dx };
            break;
          }
        }
      }
      if (a === "down") {
        const d = { ...p, y: p.y + 1 };
        if (collides(s.grid, d)) {
          st.current = lock(s);
        } else st.current = { ...s, piece: d, score: s.score + 1 };
        if (st.current.over) finish();
        draw();
        force((x) => x + 1);
        return;
      }
      if (a === "drop") {
        let n = 0;
        while (!collides(s.grid, { ...p, y: p.y + 1 })) {
          p = { ...p, y: p.y + 1 };
          n++;
        }
        st.current = lock({ ...s, piece: p, score: s.score + n * 2 });
        if (st.current.over) finish();
        draw();
        force((x) => x + 1);
        navigator.vibrate?.(15);
        return;
      }
      if (!collides(s.grid, p)) st.current = { ...s, piece: p };
      draw();
    },
    [draw, finish, paused, running],
  );

  // yerçekimi
  useEffect(() => {
    if (!running || paused) return;
    const speed = Math.max(90, 750 - ((st.current?.level ?? 1) - 1) * 65);
    const id = window.setInterval(() => act("down"), speed);
    return () => window.clearInterval(id);
  }, [running, paused, act, st.current?.level]);

  // klavye
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Parameters<typeof act>[0]> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "rot",
        ArrowDown: "down",
        " ": "drop",
      };
      if (map[e.key] && running) {
        e.preventDefault();
        act(map[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, running]);

  // dokunmatik: kaydır / dokun
  const touch = useRef<{ x: number; y: number; t: number; moved: boolean } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now(), moved: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    const cell = (canvas.current?.getBoundingClientRect().width ?? 200) / W;
    if (Math.abs(dx) > cell) {
      act(dx > 0 ? "right" : "left");
      touch.current = { ...s, x: t.clientX, moved: true };
    } else if (dy > cell * 1.2) {
      act("down");
      touch.current = { ...s, y: t.clientY, moved: true };
    }
  };
  const onTouchEnd = () => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    if (!s.moved && Date.now() - s.t < 250) act("rot");
  };

  async function start() {
    setStarting(true);
    try {
      const r = await gameApi.blokStart();
      roundId.current = r.id;
      st.current = newGame();
      setResult(null);
      setPaused(false);
      setRunning(true);
      requestAnimationFrame(draw);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    draw();
  }, [draw]);

  const s = st.current;
  const capLeft = info ? Math.max(0, info.skill_cap - info.skill_today) : null;

  return (
    <GamePage
      title="Lucana Blok"
      emoji="🧱"
      rules={
        <>
          Klasik blok oyunu — <b>bahis yok, kaybetmek yok</b>. Temizlediğin her satır <b>2 puan</b> (oyun başına en çok 40). Günlük
          ödül tavanı {info ? fmt(info.skill_cap) : "…"} puan. Telefonda: sağa/sola kaydır, aşağı kaydır, dokun = döndür. Klavyede ok
          tuşları + boşluk.
        </>
      }
    >
      <div className="flex gap-3">
        <div className="relative flex-1" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <canvas
            ref={canvas}
            width={300}
            height={600}
            className="w-full touch-none rounded-2xl border border-gold-400/20 shadow-glow"
            style={{ aspectRatio: "1 / 2", maxHeight: "60vh", objectFit: "contain" }}
          />
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-night-950/80 p-4 text-center backdrop-blur-sm">
              {result ? (
                <>
                  <p className="font-display text-3xl font-semibold">Oyun bitti</p>
                  <p className="text-smoke-300">
                    {fmt(result.score)} skor · {result.lines} satır
                  </p>
                  <p className={cn("font-bold", result.reward ? "text-emerald-300" : "text-smoke-500")}>
                    {result.reward ? `+${result.reward} ⭐ kazandın` : result.valid ? "Bu turda puan yok" : "Skor doğrulanamadı"}
                  </p>
                </>
              ) : (
                <p className="font-display text-3xl font-semibold">Hazır mısın?</p>
              )}
              <Button size="lg" loading={starting} onClick={start} disabled={!member}>
                <Play className="h-5 w-5" /> {result ? "Tekrar oyna" : "Başla"}
              </Button>
              {capLeft !== null && <p className="text-xs text-smoke-500">Bugün kazanabileceğin: {fmt(capLeft)} ⭐</p>}
            </div>
          )}
          {running && paused && (
            <button onClick={() => setPaused(false)} className="absolute inset-0 flex items-center justify-center rounded-2xl bg-night-950/70 text-2xl font-display">
              ▶ Devam
            </button>
          )}
        </div>
        <div className="w-24 shrink-0 space-y-3">
          <div className="card p-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-smoke-500">Sıradaki</p>
            <canvas ref={nextCanvas} width={80} height={50} className="mx-auto mt-1" />
          </div>
          <Stat label="Skor" value={fmt(s?.score ?? 0)} />
          <Stat label="Satır" value={String(s?.lines ?? 0)} />
          <Stat label="Seviye" value={String(s?.level ?? 1)} />
          {running && (
            <button onClick={() => setPaused((p) => !p)} className="card flex w-full items-center justify-center gap-1 py-2 text-sm">
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {paused ? "Devam" : "Duraklat"}
            </button>
          )}
        </div>
      </div>

      {/* dokunmatik tuşlar */}
      <div className="mt-3 grid grid-cols-5 gap-2">
        {[
          { a: "left" as const, i: ChevronLeft },
          { a: "rot" as const, i: RotateCw },
          { a: "right" as const, i: ChevronRight },
          { a: "down" as const, i: ArrowDown },
          { a: "drop" as const, i: ChevronsDown },
        ].map((b) => (
          <button
            key={b.a}
            onPointerDown={(e) => {
              e.preventDefault();
              act(b.a);
            }}
            className="flex h-14 items-center justify-center rounded-2xl bg-night-700 text-gold-100 active:bg-gold-400/20"
            aria-label={b.a}
          >
            <b.i className="h-6 w-6" />
          </button>
        ))}
      </div>

      {board.length > 0 && (
        <section className="mt-6">
          <h2 className="eyebrow mb-2">Haftanın en iyileri</h2>
          <ol className="card divide-y divide-white/5">
            {board.slice(0, 10).map((b, i) => (
              <li key={i} className={cn("flex items-center gap-3 px-4 py-2.5 text-sm", b.me && "bg-gold-400/10")}>
                <span className="w-6 font-bold text-smoke-500">{i + 1}</span>
                <span>{b.avatar}</span>
                <span className="flex-1 truncate font-semibold">{b.nickname}</span>
                <span className="text-xs text-smoke-500">{b.lines} satır</span>
                <span className="w-16 text-right font-bold text-gold-200">{fmt(b.score)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </GamePage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-2 text-center">
      <p className="text-[10px] uppercase tracking-wider text-smoke-500">{label}</p>
      <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
