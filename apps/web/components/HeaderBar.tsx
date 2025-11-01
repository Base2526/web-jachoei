"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Layout, Button, Tooltip, Space, Avatar, Typography, Dropdown, MenuProps, message,
  Modal, Form, Input
} from "antd";
import {
  ShoppingCartOutlined, BellOutlined, BulbOutlined,
  UserOutlined, SettingOutlined, ToolOutlined, ReloadOutlined, MessageOutlined,
  QuestionCircleOutlined, GlobalOutlined, LoginOutlined, UserAddOutlined
} from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";

const { Header } = Layout;
const { Text } = Typography;

function Clover() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8.2 2.8a3.4 3.4 0 0 0-4.8 4.8l3.6 3.6L10 6.4a3.4 3.4 0 0 0-1.8-3.6zM15.8 2.8A3.4 3.4 0 0 1 17.6 6.4L15 9.2l3.6 3.6a3.4 3.4 0 1 0-4.8-4.8L10.2 4.4a3.4 3.4 0 0 1 5.6-1.6zM2.8 15.8a3.4 3.4 0 0 0 4.8 4.8l3.6-3.6L6.4 14a3.4 3.4 0 0 0-3.6 1.8zM21.2 15.8a3.4 3.4 0 0 1-4.8 4.8L12.8 17l3.6-3.6a3.4 3.4 0 0 1 4.8 2.4z" fill="#000"/>
      <circle cx="12" cy="12" r="1.6" fill="#000" />
    </svg>
  );
}

type Lang = "th" | "en";
const labelOf: Record<Lang, string> = { th: "ภาษาไทย", en: "English" };

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function HeaderBar({ initialLang = "th" }: { initialLang?: Lang }) {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  // ----- auth check: มี token ไหม (ทั้ง cookie / localStorage) -----
  useEffect(() => {
    const has =
      !!readCookie("token") ||
      (typeof window !== "undefined" && !!localStorage.getItem("token"));
    // setIsAuthed(Boolean(has));
  }, []);

  const onLogout = () => {
    localStorage.removeItem("token");
    document.cookie = "token=; Max-Age=0; path=/";
    message.info("You have been logged out");
    setIsAuthed(false);
    router.push("/login");
  };

  const currentLang = (readCookie("lang") as Lang) || "th";
  const changeLang = (lang: Lang) => {
    if (lang === currentLang) return;
    document.cookie = `lang=${lang}; path=/; samesite=lax`;
    router.refresh();
  };

  const languageMenu: MenuProps["items"] = (["th", "en"] as Lang[]).map((lang) => ({
    key: lang,
    disabled: lang === currentLang,
    label: (
      <span style={{ display: "flex", alignItems: "center", gap: 10, opacity: lang === currentLang ? 0.45 : 1 }}>
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
    <>
      <Header
        style={{
          background: "#ffffffff",
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
        {/* โลโก้ + ชื่อ */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Clover />
          <Text style={{ color: "#000", fontSize: 18, letterSpacing: 1, fontWeight: 600, whiteSpace: "nowrap" }}>
            BEST MALL U
          </Text>
        </Link>

        <div style={{ marginLeft: "auto" }} />

        {/* ขวา */}
        <Space size={8} align="center">
          {
            isAuthed && 
            <>
              <Tooltip title="ตะกร้าสินค้า">
                <Button type="text" icon={<ShoppingCartOutlined style={{ fontSize: 18, color: "#000" }} />} />
              </Tooltip>

              <Tooltip title="ข้อความ">
                <Button type="text" onClick={() => isAuthed ? router.push("/chat") : setLoginOpen(true)} icon={<MessageOutlined style={{ fontSize: 18, color: "#000" }} />} />
              </Tooltip>

              <Tooltip title="แจ้งเตือน">
                <Button type="text" onClick={() => isAuthed ? router.push("/notifications") : setLoginOpen(true)} icon={<BellOutlined style={{ fontSize: 18, color: "#000" }} />} />
              </Tooltip>
            </>
          }
          
          <Tooltip title="ศูนย์ช่วยเหลือ">
            <Button type="text" onClick={() => router.push("/help")} icon={<QuestionCircleOutlined style={{ fontSize: 18, color: "#000" }} />} />
          </Tooltip>

          <Tooltip title="ธีม">
            <Button type="text" icon={<BulbOutlined style={{ fontSize: 18, color: "#000" }} />} />
          </Tooltip>

         
          {/* สลับภาษา */}
          <Dropdown
            menu={{ items: languageceries(languageMenu) }}
            trigger={["click"]}
            placement="bottomRight"
            arrow
            overlayStyle={{ minWidth: 160 }}
          >
            <Button type="text" icon={<GlobalOutlined />} onClick={e => e.preventDefault()}>
              <span style={{ marginLeft: 6 }}>{labelOf[currentLang]}</span>
            </Button>
          </Dropdown>

          {/* ถ้าล็อกอินแล้ว: แสดงโปรไฟล์ / ไม่ล็อกอิน: แสดงปุ่ม Login / Register */}
          {isAuthed ? (
            <Dropdown menu={{ items: profileMenu }} trigger={["click"]} placement="bottomRight" arrow>
              <Avatar size={36} style={{ background: "#666", cursor: "pointer" }} icon={<UserOutlined />} />
            </Dropdown>
          ) : (
            <Space>
              <Button icon={<LoginOutlined />} onClick={() => router.push("/login")}>
                Login
              </Button>
              <Button type="primary" icon={<UserAddOutlined />} onClick={() => router.push("/register")}>
                Register
              </Button>
            </Space>
          )}
        </Space>
      </Header>

    </>
  );
}

/** สร้างเมนูภาษาแบบง่ายๆ */
function languageceries(items: Required<MenuProps>["items"]) {
  return items;
}