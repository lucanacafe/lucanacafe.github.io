/* Lucana — Web Push işleyicisi (Workbox service worker'ı tarafından importScripts ile yüklenir) */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const scope = self.registration.scope;
  const target = new URL(data.url || "", scope).href;

  event.waitUntil(
    self.registration.showNotification(data.title || "Lucana", {
      body: data.body || "",
      icon: scope + "icons/icon-192.png",
      badge: scope + "icons/icon-192.png",
      tag: data.tag || "lucana",
      renotify: true,
      vibrate: [160, 80, 160],
      data: { url: target },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (client.url.startsWith(self.registration.scope) && "focus" in client) {
          await client.focus();
          try {
            await client.navigate(target);
          } catch (e) {
            /* farklı origin vb. */
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
