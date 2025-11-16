'use client';

import { gql, useSubscription, ApolloClient } from "@apollo/client";
import { notify } from "@/lib/notify";

// ตัวอย่างสคีมา: messageAdded(userId: ID)
const SUB = gql`
  subscription($user_id: ID!) {
    userMessageAdded(user_id: $user_id) {
      id chat_id sender{id name phone email} text created_at to_user_ids
    }
  }
`;

const SUB_TIME = gql`
  subscription {
    time
  }
`;

type Props = {
  meId: string;               // ไอดีผู้ใช้ปัจจุบัน (ใส่จาก context/cookie)
  client: ApolloClient<any>;  // เอาไว้เคลียร์/อัปเดต cache นับ unread
};

export default function GlobalChatSub({ meId, client }: Props) {
  useSubscription(SUB, {
    variables: { user_id: meId },
    onData: async ({ data }) => {

      console.log("[GlobalChatSub]", data);
      const msg = data.data?.userMessageAdded;
      if (!msg) return;

      // ถ้ายังไม่ได้อยู่หน้าห้องนั้น → เด้งแจ้งเตือน
      const isChatPage = location.pathname.startsWith("/chat");
      const activeChatId = new URLSearchParams(location.search).get("chatId");
      const isActiveChat = isChatPage && activeChatId === msg.chatId;

      if (!isActiveChat) {
        await notify(`ข้อความใหม่`, { body: msg.text, tag: `chat-${msg.chatId}` });
        window.dispatchEvent(new CustomEvent("chat-unread", {
          detail: { chatId: msg.chatId, count: 1, lastText: msg.text }
        }));
      }
    }
  });

  
  useSubscription(SUB_TIME, {
    onData: ({ data }) => {
      console.log("[TIME SUB] raw =", data);
      console.log("[TIME SUB] time =", data.data?.time);
    },
    onError: (err) => {
      console.error("[TIME SUB ERROR]", err);
    },
  });

  // เปิดคลิกที่ Notification แล้วเข้าไปห้องแชทได้
  // ถ้าต้องการให้ notification click ทำงาน: ใช้ service worker จะเวิร์กกว่า
  // (Notification API ตรงๆ บนบางเบราว์เซอร์อาจไม่มี click event แบบเดิม)

  return null;
}
