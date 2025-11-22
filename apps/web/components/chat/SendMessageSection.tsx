"use client";

import React, {
  useMemo,
  useCallback,
  KeyboardEvent,
  useState,
  useRef,
  useEffect,
} from "react";
import { Input, Button, Upload, Image, Typography } from "antd";
import {
  SendOutlined,
  SmileOutlined,
  PictureOutlined,
  DeleteOutlined,
  CloseOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

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
  replyTarget,
  setReplyTarget,
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
      reply_to_id?: string | null;
    };
  }) => Promise<any>;
  me: Me;
  replyTarget: any | null;
  setReplyTarget: (t: any | null) => void;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const textAreaRef = useRef<any>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

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

  // ============= SEND MESSAGE ============
  const handleSend = useCallback(async () => {
    if (!canSend) return;
    console.log("[handleSend] = ", sel, toUserIds, replyTarget?.id);

    const nowIso = new Date().toISOString();
    const tempId = "temp-" + nowIso;

    try {
      await send({
        variables: {
          chat_id: sel!,
          text: trimmed,
          to_user_ids: toUserIds,
          images: uploadedImages,
          reply_to_id: replyTarget?.id ?? null,
        },
        optimisticResponse: {
          sendMessage: {
            __typename: "Message",
            id: tempId,
            chat_id: sel!,
            text: trimmed,
            created_at: nowIso,
            reply_to_id: replyTarget?.id ?? null,
            sender: {
              __typename: "User",
              id: me?.id,
              name: me?.name || "Me",
              avatar: null,
            },
            images: uploadedImages.map((file, idx) => ({
              __typename: "ChatImage",
              id: `temp-img-${idx}`,
              url: URL.createObjectURL(file),
              file_id: null,
              mime: file.type,
            })),
          },
        },
      } as any);

      setText("");
      setUploadedImages([]);
      setReplyTarget(null);
    } catch (e) {
      console.error("[send] error:", e);
    }
  }, [
    canSend,
    sel,
    trimmed,
    uploadedImages,
    toUserIds,
    replyTarget,
    send,
    setText,
    setReplyTarget,
    me?.id,
    me?.name,
  ]);


  // Enter to send
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Emoji Picker
  const emojis = [
    "😀","😁","😂","🤣","😊","😍","😎","🤔","😢","🙏",
    "👍","🔥","💯","🎉","✨","❤️","😡"
  ];

  const appendEmoji = (emoji: string) => {
    setText(text + emoji);
    textAreaRef.current?.focus?.();
    // ถ้าอยากให้เลือกแล้ว dialog ยังไม่ปิด ให้ไม่เรียก setShowEmoji(false)
    // ถ้าอยากให้ปิดทันทีตอนเลือก ก็เพิ่มบรรทัดนี้:
    // setShowEmoji(false);
  };

  // ปิด emoji dialog เมื่อคลิกนอกพื้นที่
  useEffect(() => {
    if (!showEmoji) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        emojiPickerRef.current &&
        target &&
        !emojiPickerRef.current.contains(target)
      ) {
        setShowEmoji(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmoji]);

  // Image Upload
  const beforeUpload = (file: File) => {
    setUploadedImages((prev) => [...prev, file]);
    return false;
  };

  const removeImage = (file: File) => {
    setUploadedImages((prev) => prev.filter((f) => f !== file));
  };

  const disabled = !me?.id || !chat || !sel;

  // =========== RENDER REPLY PREVIEW ==========
  const renderReplyPreview = () => {
    if (!replyTarget) return null;

    const isMine = replyTarget?.sender?.id === me?.id;
    const senderLabel = isMine ? "You" : replyTarget?.sender?.name || "User";

    const replyText: string =
      typeof replyTarget?.text === "string" ? replyTarget.text : "";

    const replyImages: any[] = Array.isArray(replyTarget?.images)
      ? replyTarget.images
      : [];

    const hasImages = replyImages.length > 0;

    const getSrc = (img: any) =>
      img?.file_id ? `/api/files/${img.file_id}` : img?.url || "";

    return (
      <div
        style={{
          marginBottom: 10,
          padding: "6px 10px",
          borderRadius: 10,
          background: "#f0f5ff",
          borderLeft: "3px solid #1677ff",
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              marginBottom: 4,
              color: "#1677ff",
            }}
          >
            Replying to {senderLabel}
          </div>

          {replyText && (
            <div
              style={{
                marginBottom: hasImages ? 4 : 0,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "#555",
              }}
            >
              {replyText}
            </div>
          )}

          {hasImages && (
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              {replyImages.slice(0, 3).map((img: any, i: number) => {
                const extra = replyImages.length - 3;
                const isLast = i === 2 && extra > 0;

                return (
                  <div
                    key={i}
                    style={{
                      width: 45,
                      height: 45,
                      borderRadius: 6,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <Image
                      src={getSrc(img)}
                      preview={false}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        filter: isLast ? "brightness(0.6)" : "none",
                      }}
                    />

                    {isLast && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0,0,0,0.4)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        +{extra}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={() => setReplyTarget(null)}
          style={{ padding: 0, color: "#666" }}
        />
      </div>
    );
  };

  // ======================== RENDER ========================
  return (
    <div
      style={{
        width: "100%",
        padding: 12,
        background: "#fff",
        borderTop: "1px solid #eee",
        position: "relative", // ⭐ เพื่อให้ absolute emoji ผูกกับ container นี้
      }}
    >
      {/* ===== Reply Preview ===== */}
      {renderReplyPreview()}

      {/* ===== IMAGE PREVIEW ===== */}
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

      {/* ===== INPUT BAR ===== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "#fff",
          borderRadius: 24,
          padding: "6px 12px",
          border: "1px solid #eee",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          gap: 10,
        }}
      >
        {/* Upload */}
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

        {/* Emoji */}
        <Button
          type="text"
          icon={<SmileOutlined style={{ fontSize: 20, color: "#888" }} />}
          onClick={() => setShowEmoji((s) => !s)}
          disabled={disabled}
          style={{ border: "none" }}
        />

        {/* Text Area */}
        <Input.TextArea
          ref={textAreaRef}
          autoSize={{ minRows: 1, maxRows: 4 }}
          placeholder="Type a message..."
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
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

        {/* SEND */}
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

      {/* ===== EMOJI PICKER ===== */}
      {showEmoji && !disabled && (
        <div
          ref={emojiPickerRef}
          style={{
            position: "absolute",
            bottom: 70,
            left: 20,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 10,
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
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