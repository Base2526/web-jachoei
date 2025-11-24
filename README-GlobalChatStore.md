ไอเดียหลักคือ

> “ไม่ว่าคุณอยู่หน้าไหน ขอให้มีตัวที่ฟัง **ทุก message ที่เข้ามา** แล้วไปอัปเดต `myChats` + แสดง notification ให้เอง”

ตอนนี้หน้า `/chat` ฟังเฉพาะ `SUB (messageAdded(chat_id))` → ถ้าเราออกจากหน้านี้ hook จะถูก unmount แล้ว WS ไม่ฟังแล้ว

ต้องแยกออกเป็น 2 ชั้นแบบนี้ 👇

---

## 1) เพิ่ม subscription แบบ “ต่อ user” ฝั่ง GraphQL

ตอนนี้มี

```graphql
subscription ($chat_id: ID!) {
  messageAdded(chat_id: $chat_id) { ... }
}
```

เพิ่มอีกตัว (หรือ reuse ตัวเดิมแต่ให้ `chat_id` เป็น optional ก็ได้) เช่น

```graphql
type Subscription {
  # ยิงให้ user ทุกคนที่อยู่ในห้องนั้น
  incomingMessage(user_id: ID!): Message!
}
```

resolver (แนวคิด) :

```ts
// เวลาส่งข้อความเสร็จ
pubsub.publish("INCOMING_MESSAGE", {
  incomingMessage: savedMessage,
});

// subscription
Subscription: {
  incomingMessage: {
    subscribe: withFilter(
      () => pubsub.asyncIterator("INCOMING_MESSAGE"),
      (payload, vars, ctx) => {
        // ให้เฉพาะคนที่เป็น member หรือ to_user_ids มี user นี้
        const uId = vars.user_id;
        const msg = payload.incomingMessage;
        return msg.to_user_ids.includes(uId) || msg.sender_id === uId;
      }
    ),
  },
},
```

ตัวนี้จะยิงทุกครั้งที่มี message ใหม่ ไม่ว่าเราอยู่หน้าไหน

---

## 2) ทำ “Global listener” ฝั่ง Next.js (อยู่ทุกหน้า)

สร้าง component เล็ก ๆ ที่ไปไว้ใน layout หลัก เช่น
`apps/web/app/GlobalChatListener.tsx`

```tsx
"use client";

import { gql, useQuery, useSubscription, ApolloClient } from "@apollo/client";

const Q_ME = gql`query { me { id name } }`;

const Q_CHATS = gql`
  query {
    myChats {
      id
      name
      is_group
      last_message_at
      last_message {
        id
        text
        created_at
        sender { id name avatar }
        images { id url file_id mime }
      }
      # ถ้าจะมี unread_count ก็เพิ่ม field นี้ด้วย
      # unread_count
    }
  }
`;

const SUB_INCOMING = gql`
  subscription ($user_id: ID!) {
    incomingMessage(user_id: $user_id) {
      id
      chat_id
      text
      created_at
      sender { id name avatar }
      images { id url file_id mime }
    }
  }
`;

export function GlobalChatListener() {
  const { data: meData } = useQuery(Q_ME);
  const meId = meData?.me?.id;
  useSubscription(SUB_INCOMING, {
    skip: !meId,
    variables: { user_id: meId },
    onData: ({ data, client }) => {
      const m = data.data?.incomingMessage;
      if (!m) return;

      // 1) อัปเดต cache ของ myChats → last_message / last_message_at
      client.cache.updateQuery<{ myChats: any[] }>({ query: Q_CHATS }, old => {
        if (!old) return old;
        return {
          myChats: old.myChats.map(chat => {
            if (chat.id !== m.chat_id) return chat;
            return {
              ...chat,
              last_message: {
                id: m.id,
                text: m.text,
                created_at: m.created_at,
                sender: m.sender,
                images: m.images ?? [],
              },
              last_message_at: m.created_at,
              // unread_count: (chat.unread_count ?? 0) + 1, // ถ้ามี field นี้
            };
          }),
        };
      });

      // 2) แสดง Notification / badge
      //    (ตัวอย่างแบบง่าย ใช้ browser notification)
      if (Notification.permission === "granted") {
        new Notification(m.sender?.name || "New message", {
          body: m.text || "ส่งรูปภาพมา",
        });
      }

      // หรือ update global state ให้ icon chat ที่ header แสดง badge แดง
      // setGlobalUnread(prev => prev + 1);
    },
  });

  // component นี้ไม่ต้อง render อะไร แค่นั่งฟังก็พอ
  return null;
}
```

แล้วเอาไปใส่ใน layout หลัก เช่น `app/layout.tsx`:

```tsx
import { GlobalChatListener } from "@/GlobalChatListener";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {/* ส่วน header/menu ... */}
        <GlobalChatListener />
        {children}
      </body>
    </html>
  );
}
```

ตอนนี้ต่อให้เราอยู่หน้าอื่น (`/`, `/posts`, `/settings` ฯลฯ)
ถ้ามี message ใหม่เข้าห้องไหน:

* Apollo WS จะรับผ่าน `incomingMessage`
* `GlobalChatListener` จะอัปเดต cache ของ `Q_CHATS`
* หน้าใดก็ตามที่ใช้ `useQuery(Q_CHATS)` (เช่น sidebar chat, notification center) จะรีเฟรชทันที
* เราสามารถโชว์ badge, popup, หรือเสียงเตือนได้

---

## 3) ตอนอยู่ในหน้า /chat

หน้า `/chat` ที่คุณมีอยู่แล้ว:

* ยังใช้ `subscription(SUB messageAdded(chat_id))` ต่อ chat ปัจจุบันเหมือนเดิม
* `GlobalChatListener` ก็ยังทำงาน แต่ถ้า message อยู่ในห้องที่เราเปิดอยู่ สามารถเลือกไม่เพิ่ม `unread_count` ก็ได้ (ใน onData เช็ค `currentSelectedChatId` จาก global store หรือจาก URL)

เช่นปรับ logic ใน `onData` ของ global ให้:

```ts
const state = getGlobalChatState(); // เช่น Zustand/Redux
if (state.currentChatId === m.chat_id && state.windowFocused) {
  // อยู่ในห้องนั้นแล้ว ไม่ต้อง + unread
} else {
  // + unread, แสดง notification
}
```

---

สรุปภาพรวม

1. **เพิ่ม subscription ต่อ user** ที่ backend (`incomingMessage(user_id)`).
2. **สร้าง GlobalChatListener** ที่อยู่ในทุกหน้า → ฟัง subscription นี้แล้ว

   * update cache ของ `myChats` (last_message, last_message_at, unread)
   * แสดง badge/notification
3. หน้า `/chat` ใช้ subscription แบบต่อห้อง (`messageAdded(chat_id)`) ต่อไปตามเดิม

ด้วย pattern นี้ ไม่ว่าคุณจะอยู่หน้าไหน พอมีคนทักเข้ามา ทุกที่ที่ใช้ `myChats` ก็จะอัปเดต และคุณจะเห็นว่า “ห้องไหนมีข้อความใหม่” ได้ทันทีครับ ✨


-------------------------- # ----------------------------------

เอาแบบครบชุด ใช้ **Zustand** เป็น global store นะ

---

## 1) สร้าง Global Chat Store

`/store/globalChatStore.ts`

```ts
"use client";

import { create } from "zustand";

type UnreadMap = Record<string, number>;

type GlobalChatState = {
  currentChatId: string | null;   // ห้องที่กำลังเปิดอยู่
  windowFocused: boolean;        // tab โฟกัสไหม
  unreadByChat: UnreadMap;       // chat_id -> จำนวน unread

  setCurrentChat: (chatId: string | null) => void;
  setWindowFocused: (focused: boolean) => void;
  incrementUnread: (chatId: string) => void;
  clearUnread: (chatId: string) => void;
};

export const useGlobalChatStore = create<GlobalChatState>((set, get) => ({
  currentChatId: null,
  windowFocused: true,
  unreadByChat: {},

  setCurrentChat(chatId) {
    set((s) => ({
      currentChatId: chatId,
      // เวลาเข้าห้อง ให้เคลียร์ unread ห้องนั้น
      unreadByChat:
        chatId && s.unreadByChat[chatId]
          ? { ...s.unreadByChat, [chatId]: 0 }
          : s.unreadByChat,
    }));
  },

  setWindowFocused(focused) {
    set({ windowFocused: focused });
  },

  incrementUnread(chatId) {
    const { unreadByChat } = get();
    const current = unreadByChat[chatId] ?? 0;
    set({
      unreadByChat: {
        ...unreadByChat,
        [chatId]: current + 1,
      },
    });
  },

  clearUnread(chatId) {
    const { unreadByChat } = get();
    if (!unreadByChat[chatId]) return;
    set({
      unreadByChat: {
        ...unreadByChat,
        [chatId]: 0,
      },
    });
  },
}));

// helper สำหรับใช้แบบ getState() ข้างนอก React hook
export const getGlobalChatState = () => useGlobalChatStore.getState();
```

---

## 2) GlobalChatListener (อยู่ทุกหน้า)

`/app/GlobalChatListener.tsx`

```tsx
"use client";

import { gql, useQuery, useSubscription } from "@apollo/client";
import { useEffect } from "react";
import {
  useGlobalChatStore,
  getGlobalChatState,
} from "@/store/globalChatStore";

const Q_ME = gql`
  query {
    me {
      id
      name
    }
  }
`;

const Q_CHATS = gql`
  query {
    myChats {
      id
      name
      is_group
      last_message_at
      last_message {
        id
        text
        created_at
        sender {
          id
          name
          avatar
        }
        images {
          id
          url
          file_id
          mime
        }
      }
    }
  }
`;

const SUB_INCOMING = gql`
  subscription ($user_id: ID!) {
    incomingMessage(user_id: $user_id) {
      id
      chat_id
      text
      created_at
      sender {
        id
        name
        avatar
      }
      images {
        id
        url
        file_id
        mime
      }
    }
  }
`;

export function GlobalChatListener() {
  const { data: meData } = useQuery(Q_ME);
  const meId = meData?.me?.id;

  const incrementUnread = useGlobalChatStore((s) => s.incrementUnread);
  const setWindowFocused = useGlobalChatStore((s) => s.setWindowFocused);

  // ติดตาม focus/blur ของ window
  useEffect(() => {
    const onFocus = () => setWindowFocused(true);
    const onBlur = () => setWindowFocused(false);

    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, [setWindowFocused]);

  useSubscription(SUB_INCOMING, {
    skip: !meId,
    variables: { user_id: meId },
    onData: ({ data, client }) => {
      const m = data.data?.incomingMessage;
      if (!m) return;

      // ====== logic ที่คุณถาม ======
      const state = getGlobalChatState(); // ดึง state ปัจจุบันจาก Zustand
      if (state.currentChatId === m.chat_id && state.windowFocused) {
        // อยู่ในห้องนั้น + หน้าต่างโฟกัสแล้ว → ไม่ต้อง + unread
      } else {
        // ไม่ได้อยู่ในห้อง หรือ tab ไม่โฟกัส → + unread
        incrementUnread(m.chat_id);

        // optional: Browser notification
        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification(m.sender?.name || "New message", {
              body: m.text || "ส่งรูปภาพมา",
            });
          }
        }
      }

      // ====== อัปเดต cache myChats ให้ last_message/last_message_at เปลี่ยน ======
      client.cache.updateQuery<{ myChats: any[] }>({ query: Q_CHATS }, (old) => {
        if (!old) return old;
        return {
          myChats: old.myChats.map((chat) => {
            if (chat.id !== m.chat_id) return chat;
            return {
              ...chat,
              last_message: {
                id: m.id,
                text: m.text,
                created_at: m.created_at,
                sender: m.sender,
                images: m.images ?? [],
              },
              last_message_at: m.created_at,
            };
          }),
        };
      });
    },
  });

  return null; // ไม่ต้อง render อะไร
}
```

แล้วเอาไปใส่ใน root layout:

```tsx
// app/layout.tsx
import { GlobalChatListener } from "@/app/GlobalChatListener";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <GlobalChatListener />
        {children}
      </body>
    </html>
  );
}
```

---

## 3) เชื่อมกับหน้า Chat (เวลาสลับห้อง)

ใน `ChatUI` ของคุณ ให้ update currentChat + clearUnread เวลาเลือกห้อง:

```tsx
import { useGlobalChatStore } from "@/store/globalChatStore";

// ด้านบนใน ChatUI()
const setCurrentChat = useGlobalChatStore((s) => s.setCurrentChat);
const clearUnread = useGlobalChatStore((s) => s.clearUnread);

// เวลาเลือกห้อง
<List.Item
  onClick={() => {
    setSel(c.id);
    setCurrentChat(c.id);   // แจ้ง global ว่าเปิดห้องนี้อยู่
    clearUnread(c.id);      // เคลียร์ unread ของห้องนี้
    lastMsgCountRef.current = 0;
    setReplyTarget(null);
    refetchMsgs({ chat_id: c.id });
  }}
  ...
/>
```

แค่นี้ flow ก็ครบแล้ว:

* มี global store เก็บ `currentChatId`, `windowFocused`, `unreadByChat`
* `GlobalChatListener` ฟัง `incomingMessage` ทุกหน้า
* ใช้ logic

```ts
const state = getGlobalChatState();
if (state.currentChatId === m.chat_id && state.windowFocused) {
  // ไม่ + unread
} else {
  incrementUnread(m.chat_id);
}
```