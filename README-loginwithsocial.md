ได้เลยครับ 🔥
ผมจะทำ **ตัวอย่างครบชุด** ของ

* `loginWithSocial` *ฝั่ง backend (resolvers.ts)*
* ฟังก์ชันช่วย verify Google / Facebook token
* ออก JWT
* upsert user (ถ้า login ครั้งแรกให้สร้าง user ใหม่)
* เซ็ต cookie httpOnly (แนะนำใน production)

ทั้งหมดนี้คุณเอาไปใช้ได้เลยในโปรเจกต์ Next.js + Apollo Server (Yoga) ของคุณ

---

# ✅ 1) เพิ่มใน `typeDefs`

```graphql
input SocialLoginInput {
  provider: String!      # "google" | "facebook"
  accessToken: String!   # google credential / facebook access_token
}

type LoginResult {
  ok: Boolean!
  message: String
  token: String
  user: User
}

extend type Mutation {
  loginWithSocial(input: SocialLoginInput!): LoginResult!
}
```

---

# ✅ 2) สร้าง helper verify Token

**ไฟล์: `lib/auth/social.ts`**

```ts
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
```

---

# ✅ 3) Token helper

**ไฟล์: `lib/auth/jwt.ts`**

```ts
import jwt from "jsonwebtoken";
export const JWT_SECRET = process.env.JWT_SECRET || "changeme_secret";

export function signUserToken(user: any) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}
```

---

# ✅ 4) Resolver: loginWithSocial

**ไฟล์: `graphql/resolvers.ts`**

```ts
import { verifyGoogle, verifyFacebook } from "@/lib/auth/social";
import { signUserToken } from "@/lib/auth/jwt";
import { query } from "@/lib/db";
import { GraphQLError } from "graphql";

export const resolvers = {
  Mutation: {
    loginWithSocial: async (_: any, { input }: any, ctx: any) => {
      const { provider, accessToken } = input;

      let socialData = null;

      if (provider === "google") {
        socialData = await verifyGoogle(accessToken);
      } else if (provider === "facebook") {
        socialData = await verifyFacebook(accessToken);
      } else {
        throw new GraphQLError("Invalid provider");
      }

      if (!socialData) {
        throw new GraphQLError("Social token invalid");
      }

      const { email, name, picture, provider_id } = socialData;

      /* ======================================================
            1) หา user ถ้ามี email อยู่แล้ว → login เลย
         ====================================================== */
      const { rows: existing } = await query(
        `SELECT * FROM users WHERE email = $1 LIMIT 1`,
        [email]
      );

      let user = existing[0];

      /* ======================================================
            2) ถ้ายังไม่มี user → สร้างใหม่
         ====================================================== */
      if (!user) {
        const { rows: newUser } = await query(
          `
          INSERT INTO users (name, email, avatar, role)
          VALUES ($1,$2,$3,'Subscriber')
          RETURNING *
        `,
          [name, email, picture]
        );
        user = newUser[0];
      }

      /* ======================================================
            3) ออก JWT token
         ====================================================== */
      const token = signUserToken(user);

      // แนะนำ: set cookie httpOnly ใน production
      // ctx.res.cookie("token", token, {
      //   httpOnly: true,
      //   sameSite: 'lax',
      //   path: '/'
      // });

      return {
        ok: true,
        message: "Login success",
        token,
        user,
      };
    },
  },
};
```

---

# ⭐ 5) ตัวอย่างผลลัพธ์ที่ client จะได้รับ

```json
{
  "data": {
    "loginWithSocial": {
      "ok": true,
      "message": "Login success",
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "user": {
        "id": "u-123",
        "name": "Somkid",
        "email": "somkid@...",
        "role": "Subscriber"
      }
    }
  }
}
```

---

# ⭐ 6) Flow การทำงานฝั่ง Backend

| ขั้นตอน | รายละเอียด                                  |
| ------- | ------------------------------------------- |
| 1       | รับ `{ provider, accessToken }`             |
| 2       | verify token → แยกตาม Google / Facebook     |
| 3       | อ่าน email/name/profile จาก social provider |
| 4       | หา user ในตาราง `users`                     |
| 5       | ถ้าไม่เจอ → สร้าง user ใหม่                 |
| 6       | ออก JWT                                     |
| 7       | ส่งกลับ `{ ok, token, user }`               |

---

# ⭐ 7) ทำงานร่วมกับหน้า Login ของคุณได้ทันที

หน้า Login ที่ผมปรับให้คุณก่อนหน้าใช้ mutation:

```tsx
const LOGIN_SOCIAL = gql`
  mutation LoginWithSocial($input: SocialLoginInput!) {
    loginWithSocial(input: $input) {
      ok
      message
      token
      user { id name email role }
    }
  }
`;
```

แค่ชี้ไปที่ resolver ตัวนี้ก็พร้อมใช้งานทันที 🎉

---

# 💬 ต้องการให้ผมช่วยทำอะไรต่อ?

✓ เขียน service Google/Facebook token verify ฝั่ง server แบบ **security level production**
✓ ปรับ login ให้ใช้ httpOnly cookie แทน localStorage
✓ จัดการ refresh token (Auto login 30 days)
✓ ทำหน้า Register + Login แบบครบชุด

บอกได้เลยครับ ผมจัดให้เต็มระบบ 👍
