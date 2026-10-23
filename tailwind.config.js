/** Lucana teması — Instagram görsellerinden: gece siyahı, pirinç/altın,
 *  koyu ceviz ahşap, bordo sandalyeler, köz turuncusu ve duman kreması. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1240px" } },
    extend: {
      colors: {
        night: {
          950: "#070504",
          900: "#0c0907",
          850: "#120d0a",
          800: "#18120e",
          700: "#221a14",
          600: "#2e241c",
          500: "#3d3026",
        },
        gold: {
          50: "#fbf5e6",
          100: "#f6e7c1",
          200: "#efd592",
          300: "#e8c170",
          400: "#d9a94f",
          500: "#c48f35",
          600: "#a4722a",
          700: "#7d5623",
        },
        wine: { 400: "#c0475a", 500: "#a3293c", 600: "#8e1b2c", 700: "#6a1421" },
        ember: { 300: "#ffb070", 400: "#ff8a3d", 500: "#f26b1d", 600: "#c9520f" },
        smoke: { 50: "#faf6ef", 100: "#f1e9dc", 200: "#ddd1bf", 300: "#bfb19c", 400: "#9c8f7c", 500: "#7a6f60" },
      },
      fontFamily: {
        script: ['"Lobster"', "cursive"],
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ['"Manrope Variable"', "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gold-sheen": "linear-gradient(135deg, #f6e7c1 0%, #e8c170 30%, #c48f35 60%, #f0d48e 100%)",
        "night-fade": "linear-gradient(180deg, rgba(7,5,4,0) 0%, rgba(7,5,4,.85) 70%, #070504 100%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(232,193,112,.15), 0 10px 40px -10px rgba(232,193,112,.25)",
        ember: "0 0 30px -5px rgba(242,107,29,.55)",
        card: "0 1px 0 0 rgba(255,255,255,.04) inset, 0 20px 40px -24px rgba(0,0,0,.8)",
      },
      keyframes: {
        smoke: {
          "0%": { transform: "translateY(0) scale(1)", opacity: "0" },
          "15%": { opacity: ".5" },
          "100%": { transform: "translateY(-120px) scale(2.2)", opacity: "0" },
        },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(242,107,29,.6)" },
          "100%": { boxShadow: "0 0 0 14px rgba(242,107,29,0)" },
        },
      },
      animation: {
        smoke: "smoke 7s ease-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "pulse-ring": "pulseRing 1.6s ease-out infinite",
      },
    },
  },
  plugins: [],
};
