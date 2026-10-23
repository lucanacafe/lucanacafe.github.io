/** Müşterinin en son okuttuğu masa — ana sayfadan / oyunlardan "Masana dön" için. */
const KEY = "lucana.table";
const TTL = 6 * 60 * 60 * 1000;

export interface LastTable {
  code: string;
  name: string;
  at: number;
}

export function saveLastTable(code: string, name: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, name, at: Date.now() }));
  } catch {
    /* yok say */
  }
}

export function getLastTable(): LastTable | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || "null") as LastTable | null;
    return t && Date.now() - t.at < TTL ? t : null;
  } catch {
    return null;
  }
}

export function clearLastTable() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* yok say */
  }
}
