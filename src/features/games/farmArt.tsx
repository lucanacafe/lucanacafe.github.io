import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Lucana Bahçesi piksel sanatı (public/game/, kaynak: josehzz — CC0).
 * crops.png: satır = ürün (farm_crops.sprite_row), sütun 0 = ürün simgesi, 1-5 = tohum → olgun.
 */
const BASE = import.meta.env.BASE_URL + "game/";
const COLS = 6;
const ROWS = 8;

const pixel: CSSProperties = { imageRendering: "pixelated" };

export function CropSprite({ row, col, className, style }: { row: number; col: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block", className)}
      style={{
        ...pixel,
        backgroundImage: `url(${BASE}crops.png)`,
        backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
        backgroundPosition: `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`,
        backgroundRepeat: "no-repeat",
        ...style,
      }}
    />
  );
}

/** Büyüme yüzdesine göre aşama sütunu: 1 tohum … 5 olgun */
export function stageCol(progress: number, ready: boolean) {
  if (ready) return 5;
  if (progress < 0.2) return 1;
  if (progress < 0.45) return 2;
  if (progress < 0.75) return 3;
  return 4;
}

/** Karo arka planları (16 px karo, büyütülmüş + keskin) */
export const tileBg = (name: "soil" | "soil-wet" | "grass", size = 48): CSSProperties => ({
  ...pixel,
  backgroundImage: `url(${BASE}${name}.png)`,
  backgroundSize: `${size}px ${size}px`,
});
