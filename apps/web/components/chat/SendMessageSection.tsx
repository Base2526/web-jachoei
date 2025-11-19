"use client";

import React, {
  useMemo,
  useCallback,
  KeyboardEvent,
  useState,
  useRef,
} from "react";
import { Input, Button, Upload, Image } from "antd";
import {
  SendOutlined,
  SmileOutlined,
  PictureOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

type Member = { id: string; name?: string };
type Chat = { id: string; members?: Member[] };
type Me = { id: string; name?: string } | null;

export default function SendMessageSection({
  chats,
  sel,
  text,
  setText,
  send,
  me,
}: {
  chats?: { myChats?: Chat[] };
  sel: string | null;
  text: string;
  setText: (s: string) => void;
  send: (args: {
    variables: {
      chat_id: string;
      text: string;
      to_user_ids: string[];
      images?: File[];
    };
  }) => Promise<any>;
  me: Me;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const textAreaRef = useRef<any>(null);

  // หา chat ที่เลือก
  const chat = useMemo(
    () => chats?.myChats?.find((i) => i.id === sel),
    [chats, sel]
  );

  const otherMembers = useMemo(() => {
    if (!chat?.members) return [];
    return chat.members.filter((m) => m.id !== me?.id);
  }, [chat?.members, me?.id]);

  const toUserIds = useMemo(() => otherMembers.map((m) => m.id), [otherMembers]);

  const trimmed = text.trim();
  const canSend =
    !!me?.id &&
    !!sel &&
    !!chat &&
    (trimmed || uploadedImages.length > 0) &&
    toUserIds.length > 0;

  // ส่งข้อความ + รูป
  const handleSend = useCallback(async () => {
    if (!canSend) return;

    try {
      await send({
        variables: {
          chat_id: sel!,
          text: trimmed,
          to_user_ids: toUserIds,
          images: uploadedImages,  // 👈 ต้องมี
        },
      });

      setText("");
      setUploadedImages([]);
    } catch (e) {
      console.error("[send] error:", e);
    }
  }, [canSend, sel, trimmed, uploadedImages, toUserIds, setText, send]);

  // Enter = send
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // emoji list
  const emojis = ["😀","😁","😂","🤣","😊","😍","😎","🤔","😢","🙏","👍","🔥","💯","🎉","✨","❤️","😡"];

  const appendEmoji = (emoji: string) => {
    setText(text + emoji);
    textAreaRef.current?.focus?.();
  };

  // Handle Image Upload
  const beforeUpload = (file: File) => {
    setUploadedImages((prev) => [...prev, file]);
    return false; // prevent auto upload
  };

  const removeImage = (file: File) => {
    setUploadedImages((prev) => prev.filter((f) => f !== file));
  };

  const disabled = !me?.id || !chat || !sel;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        padding: 12,
        background: "#fff",
        borderTop: "1px solid #eee",
      }}
    >
      {/* PREVIEW IMAGES */}
      {uploadedImages.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 10,
            overflowX: "auto",
            paddingBottom: 6,
          }}
        >
          {uploadedImages.map((img, index) => (
            <div
              key={index}
              style={{
                position: "relative",
                width: 80,
                height: 80,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid #ddd",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <Image
                src={URL.createObjectURL(img)}
                alt="preview"
                width={80}
                height={80}
                style={{ objectFit: "cover" }}
                preview={false}
              />

              <Button
                size="small"
                type="text"
                icon={<DeleteOutlined style={{ color: "#fff" }} />}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  background: "rgba(0,0,0,0.5)",
                  borderRadius: 0,
                }}
                onClick={() => removeImage(img)}
              />
            </div>
          ))}
        </div>
      )}

      {/* MAIN INPUT BAR */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "#ffffff",
          borderRadius: 24,
          padding: "6px 12px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          border: "1px solid #eee",
          gap: 10,
        }}
      >
        {/* Upload Button */}
        <Upload
          beforeUpload={beforeUpload}
          multiple
          showUploadList={false}
          accept="image/*"
          disabled={disabled}
        >
          <Button
            type="text"
            icon={<PictureOutlined style={{ fontSize: 20, color: "#888" }} />}
            style={{ border: "none" }}
          />
        </Upload>

        {/* Emoji Button */}
        <Button
          type="text"
          icon={<SmileOutlined style={{ fontSize: 20, color: "#888" }} />}
          disabled={disabled}
          onClick={() => setShowEmoji((s) => !s)}
          style={{ border: "none" }}
        />

        {/* TEXT AREA */}
        <Input.TextArea
          ref={textAreaRef}
          autoSize={{ minRows: 1, maxRows: 4 }}
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          style={{
            border: "none",
            boxShadow: "none",
            resize: "none",
            fontSize: 16,
            lineHeight: "22px",
            paddingTop: 8,
            flex: 1,
          }}
        />

        {/* SEND BUTTON */}
        <Button
          type="primary"
          shape="circle"
          icon={<SendOutlined />}
          disabled={!canSend}
          onClick={handleSend}
          style={{
            width: 42,
            height: 42,
            fontSize: 18,
            boxShadow: canSend ? "0 4px 10px rgba(0,0,0,0.15)" : "none",
          }}
        />
      </div>

      {/* EMOJI PICKER */}
      {showEmoji && !disabled && (
        <div
          style={{
            position: "absolute",
            bottom: 70,
            left: 20,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 10,
            boxShadow: "0 4px 18px rgba(0,0,0,0.15)",
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: 6,
            zIndex: 20,
            maxWidth: 300,
          }}
        >
          {emojis.map((em) => (
            <button
              key={em}
              onClick={() => appendEmoji(em)}
              style={{
                fontSize: 22,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 4,
                transition: "0.15s",
              }}
            >
              {em}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
