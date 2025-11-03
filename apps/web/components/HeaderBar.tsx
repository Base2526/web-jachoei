"use client";
import React, { useEffect, useState } from "react";
import { Layout, Button, Tooltip, Space, Avatar, Typography, Dropdown, message } from "antd";
import { GlobalOutlined, UserOutlined, SettingOutlined, ReloadOutlined, LoginOutlined, UserAddOutlined, ShoppingCartOutlined, MessageOutlined, BellOutlined, QuestionCircleOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MenuProps } from "antd";
import { useSession } from "@/lib/useSession";

const { Header } = Layout;
const { Text } = Typography;

type Lang = "th" | "en";
const labelOf: Record<Lang,string> = { th:"TH", en:"EN" };

export default function HeaderBar({ initialLang = "th" }: { initialLang?: Lang }) {
  const router = useRouter();
  const { user: userSession, refreshSession } = useSession();

  // ✅ ให้ SSR == Client: เริ่มจาก initialLang เสมอ
  const [currentLang, setCurrentLang] = useState<Lang>(initialLang);

  // (ออปชัน) ถ้าต้อง sync กับ cookie ฝั่ง client จริง ๆ ให้ทำหลัง mount เท่านั้น
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )lang=([^;]+)/);
    const c = (m ? decodeURIComponent(m[1]) : null) as Lang | null;
    if (c && c !== currentLang) setCurrentLang(c);
  }, []); // รันครั้งเดียว

  async function onLogout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      message.success("Logged out");
      refreshSession();
      router.push("/");
    } else {
      message.error("Logout failed");
    }
  }

  const changeLang = (lang: Lang) => {
    if (lang === currentLang) return;
    document.cookie = `lang=${lang}; path=/; samesite=lax`;
    setCurrentLang(lang);       // อัปเดต state ทันที
    router.refresh();           // ให้หน้าอื่นรับค่าใหม่
  };

  const languageMenu: MenuProps["items"] = (["th","en"] as Lang[]).map((lang) => ({
    key: lang,
    disabled: lang === currentLang,
    label: (
      <span style={{ display:"flex", alignItems:"center", gap:10, opacity: lang===currentLang ? 0.45 : 1 }}>
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
    <Header style={{ background: "#fff", display:"flex", alignItems:"center", gap:16, height:56, padding:"0 16px", position:"sticky", top:0, zIndex:100 }}>
      <Link href="/" style={{ display:"flex", alignItems:"center", gap:12 }}>
        <Clover />
        <Text style={{ color:"#000", fontSize:18, letterSpacing:1, fontWeight:600, whiteSpace:"nowrap" }}>BEST MALL U</Text>
      </Link>

      <div style={{ marginLeft:"auto" }} />

      <Space size={8} align="center">
        {userSession && (
          <>
            <Tooltip title="ตะกร้าสินค้า"><Button type="text" icon={<ShoppingCartOutlined style={{ fontSize:18, color:"#000" }} />} /></Tooltip>
            <Tooltip title="ข้อความ"><Button type="text" onClick={() => router.push("/chat")} icon={<MessageOutlined style={{ fontSize:18, color:"#000" }} />} /></Tooltip>
            <Tooltip title="แจ้งเตือน"><Button type="text" onClick={() => router.push("/notifications")} icon={<BellOutlined style={{ fontSize:18, color:"#000" }} />} /></Tooltip>
          </>
        )}

        <Dropdown menu={{ items: languageMenu }} trigger={["click"]} placement="bottomRight" arrow overlayStyle={{ minWidth:160 }}>
          <Button type="text" icon={<GlobalOutlined />} onClick={(e) => e.preventDefault()}>
            <span style={{ marginLeft: 6 }}>{labelOf[currentLang]}</span>
          </Button>
        </Dropdown>

        <Tooltip title="ศูนย์ช่วยเหลือ">
          <Button type="text" onClick={() => router.push("/help")} icon={<QuestionCircleOutlined style={{ fontSize: 18, color: "#000" }} />} />
        </Tooltip>

        {userSession ? (
          <Dropdown menu={{ items: profileMenu }} trigger={["click"]} placement="bottomRight" arrow>
            <Avatar size={36} style={{ background:"#666", cursor:"pointer" }} icon={<UserOutlined />} />
          </Dropdown>
        ) : (
          <Space>
            <Button icon={<LoginOutlined />} onClick={() => router.push("/login")}>Login</Button>
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => router.push("/register")}>Register</Button>
          </Space>
        )}
      </Space>
    </Header>
  );
}

function Clover() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8.2 2.8a3.4 3.4 0 0 0-4.8 4.8l3.6 3.6L10 6.4a3.4 3.4 0 0 0-1.8-3.6zM15.8 2.8A3.4 3.4 0 0 1 17.6 6.4L15 9.2l3.6 3.6a3.4 3.4 0 1 0-4.8-4.8L10.2 4.4a3.4 3.4 0 0 1 5.6-1.6zM2.8 15.8a3.4 3.4 0 0 0 4.8 4.8l3.6-3.6L6.4 14a3.4 3.4 0 0 0-3.6 1.8zM21.2 15.8a3.4 3.4 0 0 1-4.8 4.8L12.8 17l3.6-3.6a3.4 3.4 0 0 1 4.8 2.4z" fill="#000"/>
      <circle cx="12" cy="12" r="1.6" fill="#000" />
    </svg>
  );
}
