import jwt from "jsonwebtoken";
import fetch from "node-fetch";

/* =====================================================
   Verify Google Credential  (From @react-oauth/google)
   ===================================================== */

export async function verifyGoogle(accessToken: string) {
  try {
    // Google credential เป็น JWT → decode header
    const googleData = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());

    return {
      email: googleData.email,
      name: googleData.name || googleData.given_name || "",
      picture: googleData.picture || "",
      provider: "google",
      provider_id: googleData.sub,
    };
  } catch (err) {
    console.error("[verifyGoogle] error", err);
    return null;
  }
}

/* =====================================================
   Verify Facebook Token
   ===================================================== */

export async function verifyFacebook(accessToken: string) {
  try {
    const FB_APP_ID     = process.env.FACEBOOK_APP_ID!;
    const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;
    
    // ตรวจสอบ token ว่าถูกต้องหรือไม่
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${FB_APP_ID}|${FB_APP_SECRET}`;
    const debugRes = await fetch(debugUrl).then(r => r.json());

    if (!debugRes?.data?.is_valid) {
      return null;
    }

    // ดึงข้อมูล user
    const meUrl = `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`;
    const me = await fetch(meUrl).then(r => r.json());

    return {
      email: me.email,                    // FB บางบัญชีไม่มี email
      name: me.name,
      picture: me.picture?.data?.url || "",
      provider: "facebook",
      provider_id: me.id
    };
  } catch (err) {
    console.error("[verifyFacebook] error", err);
    return null;
  }
}
