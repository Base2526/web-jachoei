"use client";
import React, { useEffect, useState } from "react";
import { Layout, Button, Tooltip, Space, Avatar, Typography, Dropdown, message } from "antd";
import { GlobalOutlined, UserOutlined, SettingOutlined, ReloadOutlined, LoginOutlined, UserAddOutlined, ShoppingCartOutlined, MessageOutlined, BellOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MenuProps } from "antd";
import { useSession } from "@/lib/useSession";
import { gql, useQuery } from "@apollo/client";

const { Header } = Layout;
const { Text } = Typography;

type Lang = "th" | "en";
const labelOf: Record<Lang, string> = { th: "ไทย", en: "English" };
// ✅ ธงต่อภาษา (อยากเปลี่ยนเป็น 🇬🇧 ก็ได้)
const flagOf: Record<Lang, string> = { th: "🇹🇭", en: "🇺🇸" };

// ดึงข้อมูลตัวเอง
const Q_ME = gql`
  query {
    me {
      id
      name
      email
      phone
      username
      language
      role
      avatar
      created_at
    }
  }
`;

export default function HeaderBar({ initialLang = "th" }: { initialLang?: Lang }) {
  const router = useRouter();
  const { user: userSession, refreshSession } = useSession();

  const { data: meData } = useQuery(Q_ME, { skip: !userSession, fetchPolicy: "cache-first" });
  const me = meData?.me;

  // ✅ ให้ SSR == Client: เริ่มจาก initialLang เสมอ
  const [currentLang, setCurrentLang] = useState<Lang>(initialLang);

  // sync cookie หลัง mount
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )lang=([^;]+)/);
    const c = (m ? decodeURIComponent(m[1]) : null) as Lang | null;
    if (c && c !== currentLang) setCurrentLang(c);
  }, []); // รันครั้งเดียว

  async function onLogout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      message.success("Logged out");
      try {
        refreshSession();
      } catch {}

      router.replace("/");
      setTimeout(() => window.location.reload(), 100);
    } else {
      message.error("Logout failed");
    }
  }

  const changeLang = (lang: Lang) => {
    if (lang === currentLang) return;
    document.cookie = `lang=${lang}; path=/; samesite=lax`;
    setCurrentLang(lang);
    router.refresh();
  };

  const languageMenu: MenuProps["items"] = (["th", "en"] as Lang[]).map((lang) => ({
    key: lang,
    disabled: lang === currentLang,
    label: (
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          opacity: lang === currentLang ? 0.45 : 1,
        }}
      >
        {/* ธงใน dropdown */}
        <span style={{ fontSize: 18 }}>{flagOf[lang]}</span>
        <span>{labelOf[lang]}</span>
      </span>
    ),
    onClick: () => changeLang(lang),
  }));

  const profileMenu: MenuProps["items"] = [
    { key: "settings", label: <Link href="/settings">Settings</Link>, icon: <SettingOutlined /> },
    { type: "divider" },
    { key: "logout", label: <span onClick={onLogout}>Logout</span>, icon: <ReloadOutlined /> },
  ];

  return (
    <Header
      style={{
        background: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 16,
        height: 56,
        padding: "0 16px",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Text style={{ color: "#000", fontSize: 18, letterSpacing: 1, fontWeight: 600, whiteSpace: "nowrap" }}>
          PROTECT SCAMMER
        </Text>
      </Link>

      <div style={{ marginLeft: "auto" }} />

      <Space size={8} align="center">
        {userSession && (
          <>
            <Tooltip title="ข้อความ">
              <Button
                type="text"
                onClick={() => router.push("/chat")}
                icon={<MessageOutlined style={{ fontSize: 18, color: "#000" }} />}
              />
            </Tooltip>
            <Tooltip title="แจ้งเตือน">
              <Button
                type="text"
                onClick={() => router.push("/notification")}
                icon={<BellOutlined style={{ fontSize: 18, color: "#000" }} />}
              />
            </Tooltip>
          </>
        )}

        {/* ✅ ปุ่มเลือกภาษา + ธง */}
        <Dropdown menu={{ items: languageMenu }} trigger={["click"]} placement="bottomRight" arrow overlayStyle={{ minWidth: 180 }}>
          <Button type="text" onClick={(e) => e.preventDefault()}>
            {/* ถ้าอยากให้มีไอคอนโลกด้วย เอาอันนี้ออกคอมเมนต์ได้ */}
            {/* <GlobalOutlined style={{ marginRight: 4 }} /> */}
            <span style={{ fontSize: 18, marginRight: 6 }}>{flagOf[currentLang]}</span>
            <span>{labelOf[currentLang]}</span>
          </Button>
        </Dropdown>

        <Tooltip title="ศูนย์ช่วยเหลือ">
          <Button
            type="text"
            onClick={() => router.push("/help")}
            icon={<QuestionCircleOutlined style={{ fontSize: 18, color: "#000" }} />}
          />
        </Tooltip>

        {userSession ? (
          <Dropdown menu={{ items: profileMenu }} trigger={["click"]} placement="bottomRight" arrow>
            <Avatar
              size={36}
              src={me?.avatar}
              style={{ background: "#666", cursor: "pointer" }}
              icon={<UserOutlined />}
            />
          </Dropdown>
        ) : (
          <Space>
            <Button icon={<LoginOutlined />} onClick={() => router.push("/login")}>
              Login
            </Button>
          </Space>
        )}
      </Space>
    </Header>
  );
}
