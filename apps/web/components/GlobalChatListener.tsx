"use client";

import { gql, useQuery, useSubscription } from "@apollo/client";
import { useEffect } from "react";
import {
  useGlobalChatStore,
  getGlobalChatState,
} from "@/store/globalChatStore";
import { notify } from "@/lib/notify";

// ===== QUERIES =====
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

// ===== SUBSCRIPTIONS =====
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

const SUB_USER_MESSAGE = gql`
  subscription ($user_id: ID!) {
    userMessageAdded(user_id: $user_id) {
      id
      chat_id
      sender {
        id
        name
        phone
        email
      }
      text
      created_at
      to_user_ids
    }
  }
`;

const SUB_TIME = gql`
  subscription {
    time
  }
`;


// ====================================
//     GLOBAL CHAT LISTENER (FINAL)
// ====================================
export function GlobalChatListener() {
  const { data: meData } = useQuery(Q_ME);
  const meId = meData?.me?.id;

  const incrementUnread = useGlobalChatStore((s: any) => s.incrementUnread);
  const setWindowFocused = useGlobalChatStore((s: any) => s.setWindowFocused);

  // ติดตาม Window Focus → Zustand
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

  // ===========================================================
  // A) SUB_INCOMING → unread + update last_message list ซ้าย
  // ===========================================================
  useSubscription(SUB_INCOMING, {
    skip: !meId,
    variables: { user_id: meId },
    onData: ({ data, client }) => {
      const m = data.data?.incomingMessage;
      if (!m) return;

      const state = getGlobalChatState();
      console.log("[SUB_INCOMING]", m, state);

      const isCurrentRoom = state.currentChatId === m.chat_id;
      const isFocused = state.windowFocused;

      if (!(isCurrentRoom && isFocused)) {
        incrementUnread(m.chat_id);

        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            try {
              new Notification(m.sender?.name || "New message", {
                body: m.text || "ส่งรูปภาพมา",
              });
            } catch (e) {
              console.error("Notification error:", e);
            }
          }
        }
      }

      // อัปเดต sidebar last_message
      client.cache.updateQuery<{ myChats: any[] }>({ query: Q_CHATS }, (old) => {
        if (!old) return old;

        return {
          myChats: old.myChats.map((chat) =>
            chat.id !== m.chat_id
              ? chat
              : {
                  ...chat,
                  last_message: {
                    id: m.id,
                    text: m.text,
                    created_at: m.created_at,
                    sender: m.sender,
                    images: m.images ?? [],
                  },
                  last_message_at: m.created_at,
                }
          ),
        };
      });
    },
  });

  // ===========================================================
  // B) SUB_USER_MESSAGE → ใช้สำหรับ notify + dispatch event
  // ===========================================================
  useSubscription(SUB_USER_MESSAGE, {
    skip: !meId,
    variables: { user_id: meId },
    onData: async ({ data }) => {
      const msg = data.data?.userMessageAdded;
      if (!msg) return;

      const isChatPage =
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/chat");

      const activeChatId =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("chatId")
          : null;

      const isActiveChat = isChatPage && activeChatId === msg.chat_id;

      if (!isActiveChat) {
        await notify("ข้อความใหม่", {
          body: msg.text,
          tag: `chat-${msg.chat_id}`,
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("chat-unread", {
              detail: {
                chatId: msg.chat_id,
                count: 1,
                lastText: msg.text,
              },
            })
          );
        }
      }
    },
  });

  // ===========================================================
  // C) SUB_TIME → debug WebSocket ทำงานปกติ
  // ===========================================================
  useSubscription(SUB_TIME, {
    onData: ({ data }) => {
      console.log("[TIME SUB] =", data.data?.time);
    },
    onError: (err) => console.error("[TIME SUB ERROR]", err),
  });

  return null;
}
