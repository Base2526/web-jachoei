export async function publishToFacebookPage(message: string) {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error("Missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN");

  const url = `https://graph.facebook.com/v24.0/${pageId}/feed`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message, access_token: token })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`FB publish failed: ${JSON.stringify(json)}`);
  return json;
}
