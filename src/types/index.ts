export type OrderStatus = "new" | "preparing" | "served" | "paid" | "cancelled";
export type PaymentMethod = "cash" | "card" | "other";
export type CallType = "waiter" | "bill" | "coal" | "other";

export interface Settings {
  name: string;
  tagline: string;
  about: string;
  phone: string;
  address: string;
  hours: string;
  instagram: string;
  maps_url: string;
  announcement: string;
  ordering_enabled: boolean;
  calls_enabled: boolean;
  currency: string;
  wifi_name?: string;
  wifi_pass?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  sort: number;
  is_active?: boolean;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  tags: string[];
  is_featured: boolean;
  sort: number;
  available?: boolean;
  // yalnızca panel
  is_active?: boolean;
  track_stock?: boolean;
  stock?: number;
  low_stock?: number;
}

export interface MenuData {
  categories: Category[];
  items: MenuItem[];
}

export interface TableInfo {
  id: string;
  name: string;
  area: string;
  ordering_enabled: boolean;
  calls_enabled: boolean;
  wifi_name: string | null;
  wifi_pass: string | null;
}

export interface OrderLine {
  id?: string;
  name: string;
  qty: number;
  unit_price: number;
  note: string | null;
}

export interface Order {
  id: string;
  no: number;
  status: OrderStatus;
  total: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  items: OrderLine[];
  // panel
  biz_day?: string;
  source?: "qr" | "staff";
  table_id?: string | null;
  table_label?: string | null;
  area?: string | null;
  payment_method?: PaymentMethod | null;
  cancel_reason?: string | null;
  paid_at?: string | null;
  created_by?: string | null;
  handled_by?: string | null;
}

export interface Call {
  id: string;
  type: CallType;
  created_at: string;
  note?: string | null;
  table_id?: string;
  table_name?: string;
  area?: string;
}

export interface StaffUser {
  id: string;
  username: string;
  full_name: string;
  role_key: string;
  role_name: string;
  level: number;
  must_change_pw: boolean;
}

export interface CartLine {
  id: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
  image_url?: string | null;
}
