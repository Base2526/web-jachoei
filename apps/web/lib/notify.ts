export async function ensureNotifyPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const p = await Notification.requestPermission();
    return p === "granted";
  }
  return false;
}

export async function notify(title: string, opts?: NotificationOptions) {
  try {
    const ok = await ensureNotifyPermission();
    if (!ok) return;
    const n = new Notification(title, opts);
    // auto-close to avoid clutter
    setTimeout(() => n.close(), 5000);
    return n;
  } catch {}
}
