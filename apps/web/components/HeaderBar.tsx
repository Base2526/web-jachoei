"use client";

import React from "react";
import {
  Layout, Button, Tooltip, Space, Avatar, Typography, Dropdown, MenuProps, message,
} from "antd";
import {
  ShoppingCartOutlined, BellOutlined, BulbOutlined,
  UserOutlined, SettingOutlined, ToolOutlined, ReloadOutlined,
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
const flagOf: Record<Lang, string> = { th: "TH", en: "EN" };

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function HeaderBar({ initialLang = "th" }: { initialLang?: Lang }) {
  const router = useRouter();

  const onLogout = () => {
    localStorage.removeItem("token");
    document.cookie = "token=; Max-Age=0; path=/";
    message.info("You have been logged out");
    router.push("/login");
  };

  // ภาษา ณ ตอนนี้ (fallback = th)
  const currentLang = (readCookie("lang") as Lang) || "th";

  const changeLang = (lang: Lang) => {
    if (lang === currentLang) return;
    document.cookie = `lang=${lang}; path=/; samesite=lax`;
    router.refresh(); // หรือ window.location.reload();
  };

  // --- เมนูภาษา (โครงเดียวกับ profileMenu) -----------------
  const languageMenu: MenuProps["items"] = (["th", "en"] as Lang[]).map((lang) => ({
    key: lang,
    disabled: lang === currentLang,
    label: (
      <span style={{ display: "flex", alignItems: "center", gap: 10, opacity: lang === currentLang ? 0.45 : 1 }}>
        {/* <span style={{ fontSize: 18 }}>{flagOf[lang]}</span> */}
        <span>{labelOf[lang]}</span>
      </span>
    ),
    onClick: () => changeLang(lang),
  }));

  // --- เมนูโปรไฟล์ เดิม -------------------------------------
  const profileMenu: MenuProps["items"] = [
    { key: "account", label: <Link href="/my/profile">Account</Link>, icon: <UserOutlined /> },
    { key: "settings", label: <Link href="/settings">Settings</Link>, icon: <SettingOutlined /> },
    { key: "admin", label: <Link href="/admin">Administrator</Link>, icon: <ToolOutlined /> },
    { type: "divider" },
    { key: "logout", label: <span onClick={onLogout}>Logout</span>, icon: <ReloadOutlined /> },
  ];

  return (
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
      {/* ซ้าย: โลโก้ + ชื่อ */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Clover />
        <Text style={{ color: "#000", fontSize: 18, letterSpacing: 1, fontWeight: 600, whiteSpace: "nowrap" }}>
          BEST MALL U
        </Text>
      </Link>

      <div style={{ marginLeft: "auto" }} />

      {/* ขวา */}
      <Space size={8} align="center">
        <Tooltip title="ตะกร้าสินค้า">
          <Button type="text" icon={<ShoppingCartOutlined style={{ fontSize: 18, color: "#000" }} />} />
        </Tooltip>
        <Tooltip title="ธีม">
          <Button type="text" icon={<BulbOutlined style={{ fontSize: 18, color: "#000" }} />} />
        </Tooltip>
        <Tooltip title="แจ้งเตือน">
          <Button type="text" icon={<BellOutlined style={{ fontSize: 18, color: "#000" }} />} />
        </Tooltip>

        {/* ภาษา: ใช้ Dropdown + MenuProps แบบเดียวกับโปรไฟล์ */}
        <Dropdown
          menu={{ items: languageMenu }}
          trigger={["click"]}
          placement="bottomRight"
          arrow
          popupRender={(menu) => (
              <div
              style={{
                  padding: 8,
                  borderRadius: 12,
                  boxShadow: "0 6px 16px rgba(0,0,0,.08), 0 3px 6px rgba(0,0,0,.05)",
                  background: "#fff",
              }}
              >
              {menu}
              </div>
          )}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px",
              borderRadius: 999,
              cursor: "pointer",
              color: "#000",
            }}
            title="เปลี่ยนภาษา"
            onClick={(e) => e.preventDefault()}
          >
            {/* <span style={{ fontSize: 18, lineHeight: 1 }}>{flagOf[currentLang]}</span> */}
            <span style={{ fontSize: 14 }}>{labelOf[currentLang]}</span>
          </div>
        </Dropdown>

        {/* โปรไฟล์ */}
        <Dropdown menu={{ items: profileMenu }} trigger={["click"]} placement="bottomRight" arrow>
          <Avatar size={36} style={{ background: "#666", cursor: "pointer" }} icon={<UserOutlined />} />
        </Dropdown>
      </Space>
    </Header>
  );
}
