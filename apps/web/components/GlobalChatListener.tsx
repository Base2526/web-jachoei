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

  const incrementUnread = useGlobalChatStore((s: any) => s.incrementUnread);
  const setWindowFocused = useGlobalChatStore((s: any) => s.setWindowFocused);

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

      console.log("SUB_INCOMING = @1", data, state);
      if (state.currentChatId === m.chat_id && state.windowFocused) {
        // อยู่ในห้องนั้น + หน้าต่างโฟกัสแล้ว → ไม่ต้อง + unread
      } else {
        // ไม่ได้อยู่ในห้อง หรือ tab ไม่โฟกัส → + unread
        incrementUnread(m.chat_id);

        // optional: Browser notification
        if (typeof window !== "undefined" && "Notification" in window) {

            console.log("SUB_INCOMING = @2", Notification.permission);
          if (Notification.permission === "granted") {
            try{
                new Notification(m.sender?.name || "New message", {
                body: m.text || "ส่งรูปภาพมา",
                });
            } catch (e) {
            console.error("Notification error:", e);
            }
          }
        }else{
            console.log("SUB_INCOMING = @3", Notification.permission);
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
