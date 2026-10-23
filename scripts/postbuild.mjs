// GitHub Pages SPA desteği: bilinmeyen yollar (/menu, /m/<kod>, /panel ...) 404.html'e düşer.
// 404.html = index.html olduğu için uygulama doğrudan açılır ve router yolu çözer.
import { copyFileSync, existsSync, writeFileSync } from "node:fs";

copyFileSync("dist/index.html", "dist/404.html");
// Jekyll'in _ ile başlayan dosyaları gizlemesini engelle
writeFileSync("dist/.nojekyll", "");
// Özel domain: CNAME dosyası public/ içinde varsa Vite zaten kopyalar
if (existsSync("dist/CNAME")) console.log("CNAME bulundu → özel domain");
console.log("postbuild: 404.html + .nojekyll hazır");
