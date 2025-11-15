'use client';

import { gql, useQuery, useMutation } from "@apollo/client";
import { useState, useEffect, useMemo } from "react";
import {
  List,
  Card,
  Input,
  Button,
  Space,
  Typography,
  Divider,
  Modal,
  message,
  Tag,
  Dropdown,
  Radio,
  Select,
} from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { useSearchParams } from "next/navigation";

import SendMessageSection from "@/components/chat/SendMessageSection";

// ===== GraphQL =====
const Q_ME = gql`
  query {
    me {
      id
    }
  }
`;

// ✅ เพิ่ม created_by ด้วย
const Q_CHATS = gql`
  query {
    myChats {
      id
      name
      is_group
      created_at
      created_by {
        id
        name
      }
      members {
        id
        name
      }
    }
  }
`;

const Q_MSGS = gql`
  query ($chat_id: ID!) {
    messages(chat_id: $chat_id) {
      id
      chat_id
      text
      created_at
      sender {
        id
        name
      }
      myReceipt {
        deliveredAt
        isRead
        readAt
      }
      readers {
        id
        name
        phone
        email
        created_at
      }
      readersCount
      deleted_at
      is_deleted
    }
  }
`;

const Q_USERS = gql`
  query ($q: String) {
    users(search: $q) {
      id
      name
    }
  }
`;

const MUT_DELETE_MSG = gql`
  mutation ($message_id: ID!) {
    deleteMessage(message_id: $message_id)
  }
`;

const MUT_MARK_READ = gql`
  mutation ($message_id: ID!) {
    markMessageRead(message_id: $message_id)
  }
`;

const MUT_MARK_UPTO = gql`
  mutation ($chat_id: ID!, $cursor: String!) {
    markChatReadUpTo(chat_id: $chat_id, cursor: $cursor)
  }
`;

const MUT_SEND = gql`
  mutation ($chat_id: ID!, $text: String!, $to_user_ids: [ID!]!) {
    sendMessage(chat_id: $chat_id, text: $text, to_user_ids: $to_user_ids) {
      id
    }
  }
`;

const MUT_CREATE = gql`
  mutation ($name: String, $isGroup: Boolean!, $memberIds: [ID!]!) {
    createChat(name: $name, isGroup: $isGroup, memberIds: $memberIds) {
      id
      name
    }
  }
`;

const MUT_ADD = gql`
  mutation ($chat_id: ID!, $user_id: ID!) {
    addMember(chat_id: $chat_id, user_id: $user_id)
  }
`;

const MUT_RENAME = gql`
  mutation ($chat_id: ID!, $name: String!) {
    renameChat(chat_id: $chat_id, name: $name)
  }
`;

const MUT_DELETE = gql`
  mutation ($chat_id: ID!) {
    deleteChat(chat_id: $chat_id)
  }
`;

const SUB = gql`
  subscription ($chat_id: ID!) {
    messageAdded(chat_id: $chat_id) {
      id
      chat_id
      sender {
        id
        name
      }
      text
      created_at
      to_user_ids
      myReceipt {
        deliveredAt
        isRead
        readAt
      }
      readers {
        id
        name
        phone
        email
        created_at
      }
      readersCount
      deleted_at
      is_deleted
    }
  }
`;

const SUB_DELETED = gql`
  subscription ($chat_id: ID!) {
    messageDeleted(chat_id: $chat_id)
  }
`;

type Member = { id: string; name?: string };
type Chat = {
  id: string;
  name: string;
  is_group: boolean;
  created_by?: { id: string; name?: string } | null;
  members?: Member[];
};

function ChatUI() {
  const [sel, setSel] = useState<string | null>(null);
  const [text, setText] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [mode, setMode] = useState<"single" | "group">("single");
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const [openEdit, setOpenEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState<{ id: string; name?: string } | null>(null);

  // กันไม่ให้ handle ?to ซ้ำ
  const [handledTo, setHandledTo] = useState(false);

  const searchParams = useSearchParams();
  const toParam = searchParams.get("to");

  const { data: me } = useQuery(Q_ME);

  const {
    data: chats,
    refetch: refetchChats,
    loading: loadingChats,
  } = useQuery(Q_CHATS);

  const {
    data: msgs,
    refetch: refetchMsgs,
    subscribeToMore,
  } = useQuery(Q_MSGS, {
    skip: !sel,
    variables: { chat_id: sel },
  });

  const { data: users, refetch: refetchUsers } = useQuery(Q_USERS, {
    variables: { q: "" },
  });

  const [send] = useMutation(MUT_SEND);
  const [createChat] = useMutation(MUT_CREATE);
  const [addMember] = useMutation(MUT_ADD);
  const [renameChat] = useMutation(MUT_RENAME, { onError: () => {} });
  const [deleteChat] = useMutation(MUT_DELETE, { onError: () => {} });

  const [markRead] = useMutation(MUT_MARK_READ);
  const [markUpTo] = useMutation(MUT_MARK_UPTO);

  const [deleteMessageMut] = useMutation(MUT_DELETE_MSG, { onError: () => {} });

  // ถ้า query param to เปลี่ยน ให้ reset handledTo
  useEffect(() => {
    setHandledTo(false);
  }, [toParam]);

  // ====== Auto mark read up to last message ======
  useEffect(() => {
    if (!sel) return;
    const list = msgs?.messages || [];
    if (list.length > 0) {
      const lastTs = list[list.length - 1].created_at;
      markUpTo({ variables: { chat_id: sel, cursor: lastTs } }).catch(() => {});
    }
  }, [sel, msgs, markUpTo]);

  // ====== Subscriptions (messageAdded & messageDeleted) ======
  useEffect(() => {
    if (!sel) return;

    console.log("SUB @0 :", sel, chats, chat);
    const unsubAdded = subscribeToMore({
      document: SUB,
      variables: { chat_id: sel },
      updateQuery(prev, { subscriptionData }) {
        const m = subscriptionData.data?.messageAdded;
        console.log("SUB @1: ", m);
        if (!m) return prev;
        const appended = (prev.messages || []).concat([
          {
            id: m.id,
            chat_id: m.chat_id,
            text: m.text,
            created_at: m.created_at,
            sender: m.sender,
            myReceipt: m.myReceipt,
            readers: m.readers,
            readersCount: m.readersCount,
            deleted_at: m.deleted_at ?? null,
          },
        ]);
        console.log("SUB @2: ", m, appended);
        return { ...prev, messages: appended };
      },
    });

    const unsubDeleted = subscribeToMore({
      document: SUB_DELETED,
      variables: { chat_id: sel },
      updateQuery(prev, { subscriptionData }) {
        console.log("SUB_DELETED @1: ");
        const deletedId = subscriptionData?.data?.messageDeleted;
        if (!deletedId) return prev;
        const next = {
          ...prev,
          messages: (prev.messages || []).filter((x: any) => x.id !== deletedId),
        };
        return next;
      },
    });

    return () => {
      console.log("SUB cleanup", sel);
      if (typeof unsubAdded === "function") unsubAdded();
      if (typeof unsubDeleted === "function") unsubDeleted();
    };
  }, [sel, subscribeToMore]);

  // ====== Auto open / create 1:1 chat when ?to=<user_id> ======
  useEffect(() => {
    const to = toParam;
    const meId = me?.me?.id;
    const list = chats?.myChats || [];

    // ยังไม่มี param to หรือยังไม่รู้ me → ยังไม่ทำอะไร
    if (!to || !meId) return;

    // ขณะ myChats กำลังโหลด → ยังไม่ควรสรุปว่า "ไม่มี chat"
    if (loadingChats) return;

    // ถ้าเคย handle ไปแล้ว (ไม่ว่าจะเจอห้องหรือสร้างใหม่แล้ว) → ไม่ทำซ้ำ
    if (handledTo) return;

    console.log("[chat?to] effect run", {
      to,
      meId,
      listLength: list.length,
      handledTo,
    });

    // ----------- CASE 1: ยังไม่มี chat เลย -----------
    if (list.length === 0) {
      console.log("[chat?to] no chats at all → create 1:1 first time:", to);

      (async () => {
        try {
          const { data } = await createChat({
            variables: {
              name: null,
              isGroup: false,
              memberIds: [to], // 1:1 chat
            },
          });

          const newId = data?.createChat?.id;
          setHandledTo(true);

          if (newId) {
            await refetchChats();
            setSel(newId);
            refetchMsgs({ chat_id: newId });
          } else {
            message.error("Cannot create chat");
          }
        } catch (e: any) {
          setHandledTo(true);
          message.error(e?.message || "Cannot create chat");
          console.error(e);
        }
      })();

      return;
    }

    // ----------- CASE 2: มี chat อยู่แล้ว → หา 1:1 ที่มี user นี้ไหม -----------
    // ไม่ต้อง return ถ้า sel มี → เพราะเราอยากให้ auto-open ได้ตอน initial load เท่านั้น
    const existing = list.find((c: any) => {
      if (c.is_group) return false;
      const memberIds = (c.members || []).map((m: any) => m.id);
      const hasMe = memberIds.includes(meId);
      const hasTo = memberIds.includes(to);
      const creatorMatch = c.created_by?.id === meId || c.created_by?.id === to;

      return (hasMe && hasTo) || (creatorMatch && hasTo);
    });

    if (existing) {
      console.log("[chat?to] found existing chat:", existing.id);
      setHandledTo(true);
      setSel(existing.id);
      refetchMsgs({ chat_id: existing.id });
      return;
    }

    // ----------- CASE 3: หาไม่เจอ → create 1:1 ใหม่ -----------
    (async () => {
      try {
        console.log("[chat?to] create new 1:1 chat with:", to);
        const { data } = await createChat({
          variables: {
            name: null,
            isGroup: false,
            memberIds: [to],
          },
        });

        const newId = data?.createChat?.id;
        setHandledTo(true);

        if (newId) {
          await refetchChats();
          setSel(newId);
          refetchMsgs({ chat_id: newId });
        } else {
          message.error("Cannot create chat");
        }
      } catch (e: any) {
        setHandledTo(true);
        message.error(e?.message || "Cannot create chat");
        console.error(e);
      }
    })();
  }, [toParam, me, chats, loadingChats, handledTo, createChat, refetchChats, refetchMsgs]);

    
  const meId = me?.me?.id;
  // 🔹 หา user ที่เรามี 1:1 chat อยู่แล้ว
  const existingOneToOnePartnerIds = useMemo(() => {
    const set = new Set<string>();
    const list = chats?.myChats || [];
    if (!meId) return set;

    for (const c of list) {
      if (c.is_group) continue; // เอาเฉพาะห้อง 1:1
      const memberIds = (c.members || []).map((m: any) => m.id);
      if (!memberIds.includes(meId)) continue;
      for (const mid of memberIds) {
        if (mid !== meId) set.add(mid); // partner ของเราในห้องนี้
      }
    }
    return set;
  }, [chats, meId]);

  // 🔹 ฟิลเตอร์รายชื่อ user ที่ให้เลือกใน Modal Create chat
  const availableUsers = useMemo(() => {
    let arr = (users?.users || []).filter((u: any) => u.id !== meId); // ตัดตัวเองออกก่อน

    if (mode === 'single') {
      // 1:1 → ซ่อนคนที่มีห้องคุยอยู่แล้ว
      arr = arr.filter((u: any) => !existingOneToOnePartnerIds.has(u.id));
    }
    // ถ้าเป็น group → แสดงทุกคน (ยกเว้นตัวเอง)
    return arr;
  }, [users, meId, mode, existingOneToOnePartnerIds]);

  const onEdit = (c: any) => {
    setEditTarget({ id: c.id, name: c.name });
    setEditName(c.name || "");
    setOpenEdit(true);
  };

  const onDelete = (c: any) => {
    Modal.confirm({
      title: `Delete chat`,
      content: (
        <>
          คุณต้องการลบห้อง{" "}
          <b>{c.name || (c.is_group ? "(Group)" : "(1:1)")}</b> ใช่ไหม?
        </>
      ),
      okType: "danger",
      onOk: async () => {
        try {
          await deleteChat({ variables: { chat_id: c.id } });
          message.success("Deleted");
          if (sel === c.id) setSel(null);
          refetchChats();
        } catch (e: any) {
          message.error(e.message || "Delete failed");
        }
      },
    });
  };

  const onAddMember = async (c: any) => {
    const pick = await new Promise<string | undefined>((resolve) => {
      let localSel: string[] = [];
      Modal.confirm({
        title: "Add member",
        content: (
          <Select
            style={{ width: "100%" }}
            placeholder="Pick one user"
            options={(users?.users || []).map((u: any) => ({
              value: u.id,
              label: u.name,
            }))}
            onChange={(val) => {
              localSel = Array.isArray(val) ? val : [val];
            }}
            showSearch
          />
        ),
        onOk: () => resolve(localSel[0]),
        onCancel: () => resolve(undefined),
      });
    });
    if (!pick) return;
    try {
      await addMember({ variables: { chat_id: c.id, user_id: pick } });
      message.success("Member added");
      refetchChats();
    } catch (e: any) {
      message.error(e.message || "Add member failed");
    }
  };

  const menuFor = (c: any) => ({
    items: [
      {
        type: "group" as const,
        label: "Group",
        children: [
          { key: "edit", label: "Edit name", onClick: () => onEdit(c) },
          { key: "delete", label: "Delete chat", onClick: () => onDelete(c) },
        ],
      },
      {
        type: "group" as const,
        label: "Members",
        children: [{ key: "add", label: "Add member", onClick: () => onAddMember(c) }],
      },
    ],
  });

  const onCreateChat = async () => {
    const ids = mode === "single" ? selectedUsers.slice(0, 1) : selectedUsers;
    if (ids.length === 0) {
      message.warning("Please select at least 1 member");
      return;
    }
    await createChat({
      variables: {
        name: mode === "group" ? groupName || null : null,
        isGroup: mode === "group",
        memberIds: ids,
      },
    });
    setOpenCreate(false);
    setGroupName("");
    setSelectedUsers([]);
    message.success("Created");
    refetchChats();
  };

  const chat: Chat | undefined = useMemo(
    () => chats?.myChats?.find((i: any) => i.id === sel),
    [chats, sel]
  );
  
  const nameGroup = () => {
    if (!sel || !chat) return "Select a chat";

    // 🔹 1) กรณี Group chat
    if (chat.is_group) {
      // ถ้า group ไม่มี name → ตั้ง default
      return chat.name?.trim()
        ? `Group: ${chat.name}`
        : "Group Chat";
    }

    // 🔹 2) กรณี 1:1 chat
    const partner = (chat.members || []).find((m: any) => m.id !== meId);

    if (partner?.name) {
      return `Chat with ${partner.name}`;
    }

    // กันกรณีข้อมูลยังโหลดไม่ทัน
    return "Chat";
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
      <Card
        title="Chats"
        extra={
          <Button
            onClick={() => {
              setOpenCreate(true);
              refetchUsers({ q: "" });
            }}
          >
            + New Chat
          </Button>
        }
      >
        <List
          dataSource={chats?.myChats || []}
          renderItem={(c: any) => (
            <List.Item
              onClick={() => {
                setSel(c.id);
                refetchMsgs({ chat_id: c.id });
              }}
              style={{ 
                cursor: "pointer",
                background: sel === c.id ? "#e6f7ff" : "transparent"   // <-- highlight
              }}
              actions={[
                c.is_group ? (
                  <Tag color="blue" key="tag">
                    Group
                  </Tag>
                ) : (
                  <Tag key="tag">1:1</Tag>
                ),
                <Dropdown key="more" menu={menuFor(c)} trigger={["click"]}>
                  <Button
                    type="text"
                    icon={<MoreOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>,
              ]}
            >
            <List.Item.Meta
                title={
                  c.is_group
                    ? (c.name || "Group")
                    : (c.members || []).find((m: any) => m.id !== meId)?.name || "1:1"
                }
                description={
                  c.is_group
                    ? (c.members || [])
                        .filter((m: any) => m.id !== meId)
                        .map((m: any) => m.name)
                        .join(", ")
                    : null
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Card title={nameGroup()}  /*{sel ? `Chat ${chat?.name}` : "Select a chat"}*/ >
        {sel && (
          <>
            <div
              style={{
                height: "60vh",
                overflow: "auto",
                border: "1px solid #eee",
                padding: 12,
              }}
            >
              {(msgs?.messages || []).map((m: any) => (
                <div
                  key={m.id}
                  style={{ marginBottom: 8 }}
                  onDoubleClick={() =>
                    markRead({ variables: { message_id: m.id } }).catch(() => {})
                  }
                >
                  <Typography.Text strong>
                    {m.sender?.name || "—"}:
                  </Typography.Text>{" "}
                  {m.text}
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Tag color={m?.myReceipt?.isRead ? "green" : "default"}>
                      {m?.myReceipt?.isRead ? "Read" : "Unread"}
                    </Tag>
                    <Tag>{m?.readersCount ?? 0} read</Tag>

                    {me?.me?.id && m.sender?.id === me.me.id && (
                      <Button
                        danger
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          Modal.confirm({
                            title: "Delete this message?",
                            okType: "danger",
                            onOk: async () => {
                              try {
                                await deleteMessageMut({
                                  variables: { message_id: m.id },
                                });
                                await refetchMsgs({ chat_id: sel });
                              } catch (err: any) {
                                message.error(err.message || "Delete failed");
                              }
                            },
                          });
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Divider />
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type message..."
              />
              <SendMessageSection
                chats={chats}
                sel={sel || "1"}
                text={text}
                setText={setText}
                send={send}
              />
            </Space.Compact>
          </>
        )}
      </Card>

      <Modal
        open={openCreate}
        title="Create chat"
        onCancel={() => setOpenCreate(false)}
        onOk={onCreateChat}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Radio.Group
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setSelectedUsers([]);
            }}
            options={[
              { label: "Single (1:1)", value: "single" },
              { label: "Group", value: "group" },
            ]}
            optionType="button"
          />

          {mode === "group" && (
            <Input
              placeholder="Group name (optional)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          )}

          <Select
            mode={mode === "group" ? "multiple" : undefined}
            style={{ width: "100%" }}
            placeholder={mode === "group" ? "Select members" : "Select one user"}
            options={availableUsers.map((u: any) => ({
              value: u.id,
              label: u.name,
            }))}
            value={selectedUsers}
            onChange={(val) => setSelectedUsers(Array.isArray(val) ? val : [val])}
            showSearch
            onSearch={(val) => refetchUsers({ q: val })}
            filterOption={false}
          />
        </Space>
      </Modal>

      <Modal
        open={openEdit}
        title="Edit chat name"
        onCancel={() => setOpenEdit(false)}
        onOk={async () => {
          if (!editTarget?.id) return;
          try {
            await renameChat({
              variables: { chat_id: editTarget.id, name: editName || null },
            });
            setOpenEdit(false);
            message.success("Renamed");
            refetchChats();
          } catch (e: any) {
            message.error(e.message || "Rename failed");
          }
        }}
      >
        <Input
          placeholder="Chat name"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
        />
      </Modal>
    </div>
  );
}

export default function Page() {
  return <ChatUI />;
}
