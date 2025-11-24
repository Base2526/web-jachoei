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

export const useGlobalChatStore = create<GlobalChatState>((set:any, get:any) => ({
  currentChatId: null,
  windowFocused: true,
  unreadByChat: {},

  setCurrentChat(chatId:any) {
    set((s:any) => ({
      currentChatId: chatId,
      // เวลาเข้าห้อง ให้เคลียร์ unread ห้องนั้น
      unreadByChat:
        chatId && s.unreadByChat[chatId]
          ? { ...s.unreadByChat, [chatId]: 0 }
          : s.unreadByChat,
    }));
  },

  setWindowFocused(focused:any) {
    set({ windowFocused: focused });
  },

  incrementUnread(chatId:any) {
    const { unreadByChat } = get();
    const current = unreadByChat[chatId] ?? 0;
    set({
      unreadByChat: {
        ...unreadByChat,
        [chatId]: current + 1,
      },
    });
  },

  clearUnread(chatId:any) {
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
