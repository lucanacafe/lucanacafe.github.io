import { memberToken, rpc } from "@/lib/supabase";

export interface Member {
  id: string;
  nickname: string;
  avatar: string;
  username: string | null;
  points: number;
  lifetime_earned: number;
  is_hidden: boolean;
  marketing_ok: boolean;
  is_banned: boolean;
  has_password: boolean;
  created_at: string;
  /** Bakiyenin ₺ indirim karşılığı */
  discount_value: number;
  rates: { earn: number; redeem: number; max_discount_pct: number };
}

export interface LedgerRow {
  id: number;
  delta: number;
  kind: "earn" | "redeem" | "refund" | "admin" | "skill_reward" | "farm_seed" | "farm_harvest" | "farm_help" | "farm_plot";
  note: string | null;
  balance_after: number | null;
  at: string;
}

export interface TableState {
  people: { nickname: string | null; avatar: string; me: boolean }[];
  orders: { no: number; status: string; created_at: string; nickname: string; avatar: string; me: boolean; items: string }[];
}

export interface FeedItem {
  type: "order" | "join" | "harvest";
  nickname: string;
  avatar: string;
  place: string | null;
  at: string;
  detail: string | null;
  amount: number | null;
}

export interface BoardRow {
  rank: number;
  nickname: string;
  avatar: string;
  score: number;
  me: boolean;
}

export interface GameInfo {
  enabled: boolean;
  pool: number;
  skill_cap: number;
  skill_today: number;
  farm_cap: number;
  help_cap: number;
  help_today: number;
}

export interface Round {
  id: string;
  game: string;
  payout: number;
  status: "open" | "won" | "lost";
  public: { score?: number; lines?: number; reward?: number; valid?: boolean };
  created_at: string;
  points: number;
}

export interface Crop {
  key: string;
  name: string;
  emoji: string;
  cost: number;
  yield: number;
  grow_secs: number;
  min_level: number;
  /** public/game/crops.png satırı */
  sprite_row: number;
}

export interface Plot {
  idx: number;
  crop: string | null;
  planted_at: string | null;
  ready_at: string | null;
  grow_secs: number | null;
  waters: number;
  yield: number | null;
  watered_by_me: boolean;
}

export interface Farm {
  owner: { id: string; nickname: string; avatar: string; xp: number; level: number; next_level_xp: number; plots: number; me: boolean };
  server_now: string;
  plot_price: number | null;
  plots: Plot[];
}

export interface Neighbor {
  id: string;
  nickname: string;
  avatar: string;
  level: number;
  at_table: string | null;
  waterable: number;
}

export const CONSENT_VERSION = "2026-10";

export const memberApi = {
  async start(adult: boolean, marketing: boolean) {
    const r = await rpc<{ token: string | null; member: Member; existing: boolean }>("mem_start", {
      p_consent_version: CONSENT_VERSION,
      p_adult: adult,
      p_marketing: marketing,
    });
    if (r.token) memberToken.set(r.token);
    return r.member;
  },
  me: () => rpc<Member | null>("mem_me"),
  update: (p: Partial<Pick<Member, "nickname" | "avatar" | "is_hidden" | "marketing_ok">>) => rpc<Member>("mem_update", { p }),
  saveAccount: (username: string, password: string) =>
    rpc<Member>("mem_save_account", { p_username: username, p_password: password }),
  async login(username: string, password: string) {
    const r = await rpc<{ token: string; member: Member }>("mem_login", { p_username: username, p_password: password });
    memberToken.set(r.token);
    return r.member;
  },
  async logout() {
    await rpc("mem_logout").catch(() => {});
    memberToken.set(null);
  },
  async deleteAccount() {
    await rpc("mem_delete");
    memberToken.set(null);
  },
  history: (limit = 50) => rpc<LedgerRow[]>("mem_history", { p_limit: limit }),
  checkin: (code: string) => rpc("mem_checkin", { p_code: code }),
  tableState: (code: string) => rpc<TableState>("mem_table_state", { p_code: code }),

  leaderboard: (board: "week" | "all" | "farm") =>
    rpc<{ rows: (BoardRow & { level?: number })[]; me: { rank: number; score: number } | null }>("pub_leaderboard", { p_board: board }),
  blokBoard: () => rpc<{ nickname: string; avatar: string; score: number; lines: number; me: boolean }[]>("pub_blok_board"),
  feed: (limit = 20) => rpc<FeedItem[]>("pub_feed", { p_limit: limit }),
  stats: () => rpc<{ members: number; here_now: number; orders_today: number; points_given: number }>("pub_stats"),
};

export const gameApi = {
  info: () => rpc<GameInfo>("game_info"),
  blokStart: () => rpc<{ id: string }>("game_blok_start"),
  blokFinish: (id: string, score: number, lines: number) =>
    rpc<Round>("game_blok_finish", { p_round: id, p_score: score, p_lines: lines }),
};

/** Lucana Bahçesi — süreye bağlı, sonucu önceden belli; şans unsuru yok */
export const farmApi = {
  crops: () => rpc<Crop[]>("farm_crops"),
  state: (owner?: string) => rpc<Farm>("farm_state", { p_owner: owner ?? null }),
  plant: (idx: number, crop: string) => rpc<Farm>("farm_plant", { p_idx: idx, p_crop: crop }),
  harvest: (idx?: number) =>
    rpc<{ harvested: number; points_gained: number; level_up: boolean; level: number; farm: Farm; points: number }>("farm_harvest", {
      p_idx: idx ?? null,
    }),
  water: (owner: string, idx: number) => rpc<{ reward: number; farm: Farm; points: number }>("farm_water", { p_owner: owner, p_idx: idx }),
  buyPlot: () => rpc<Farm>("farm_buy_plot"),
  neighbors: () => rpc<Neighbor[]>("farm_neighbors"),
};
