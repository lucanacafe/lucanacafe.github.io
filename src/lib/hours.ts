/** "10:00 – 04:00" biçimindeki çalışma saatinden şu an açık mı hesaplar (İstanbul saati). */
export function openState(hours: string, now = new Date()) {
  const m = hours.match(/(\d{1,2})[:.](\d{2})\D+(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const open = +m[1] * 60 + +m[2];
  const close = +m[3] * 60 + +m[4];
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const cur = ist.getHours() * 60 + ist.getMinutes();
  const isOpen = close > open ? cur >= open && cur < close : cur >= open || cur < close;
  const fmt = (x: number) => `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  return { isOpen, opensAt: fmt(open), closesAt: fmt(close) };
}
