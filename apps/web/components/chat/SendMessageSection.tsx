// ในไฟล์ component (client)
"use client";
import React, { useMemo } from "react";
import { getStoredUser, type StoredUser } from "@/utils/storage";

type Member = { id: string; name?: string };
type Chat = { id: string; members?: Member[] };

// สมมุติ props หรือ state ที่คุณมี
// const [send] = useMutation(SEND_MESSAGE);

export default function SendMessageSection({
  chats,
  sel,
  text,
  setText,
  send,
}: {
  chats?: { myChats?: Chat[] };
  sel: string | null;
  text: string;
  setText: (s: string) => void;
  send: (args: { variables: { chat_id: string; text: string; to_user_ids: string[] } }) => Promise<any>;
}) {
  // อ่าน user จาก localStorage แค่ครั้งเดียว (memo + SSR safe)
  const user: StoredUser | null = useMemo(() => getStoredUser(), []);

  // หาแชทที่เลือก
  const chat: Chat | undefined = useMemo(
    () => chats?.myChats?.find((i) => i.id === sel),
    [chats, sel]
  );

  // คำนวณ toUserIds (สมาชิกคนอื่นที่ไม่ใช่เรา) และกันค่าซ้ำ
  const toUserIds: string[] = useMemo(() => {
    if (!chat?.members) return [];
    const meId = user?.id;
    const ids = chat.members
      .filter((m) => !!m?.id && m.id !== meId)
      .map((m) => m.id);
    return [...new Set(ids)];
  }, [chat?.members, user?.id]);

  const handleSend = async () => {
    // validation เบื้องต้น
    if (!user?.id) {
      console.warn("[send] not logged in");
      // TODO: redirect('/login') หรือแจ้งเตือน
      return;
    }
    if (!sel || !chat) {
      console.warn("[send] no selected chat");
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      await send({ variables: { chat_id: sel, text: trimmed, to_user_ids: toUserIds } });
      setText("");
      console.log("[chats] sent to:", toUserIds);
    } catch (e) {
      console.error("[send] error:", e);
      // TODO: แสดง message.error หากใช้ antd
    }
  };

  return (
    <>
      {/* ... input กล่องแชทของคุณ ... */}
      <button onClick={handleSend} disabled={!user || !sel || !text.trim()}>
        Send
      </button>
    </>
  );
}
