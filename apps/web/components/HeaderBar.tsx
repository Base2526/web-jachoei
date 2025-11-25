"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Layout,
  Button,
  Tooltip,
  Space,
  Avatar,
  Typography,
  Dropdown,
  message,
  AutoComplete,
  Input,
} from "antd";
import {
  UserOutlined,
  SettingOutlined,
  ReloadOutlined,
  LoginOutlined,
  MessageOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  HistoryOutlined,
  CloseCircleFilled
} from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MenuProps } from "antd";
import { gql, useQuery } from "@apollo/client";

import { useSession } from "@/lib/useSession";
import { useGlobalChatStore } from "@/store/globalChatStore";
import { useI18n } from "@/lib/i18nContext";
import type { Lang } from "@/i18n";

const { Header } = Layout;
const { Text } = Typography;

const labelOf: Record<Lang, string> = { th: "ไทย", en: "English" };
const flagOf: Record<Lang, string> = { th: "🇹🇭", en: "🇺🇸" };

// ===== GraphQL =====
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

const Q_UNREAD_NOTIFICATION_COUNT = gql`
  query MyUnreadNotificationCount {
    myUnreadNotificationCount
  }
`;

export default function HeaderBar({ initialLang = "th" }: { initialLang?: Lang }) {
  const router = useRouter();
  const { user: userSession, refreshSession } = useSession();
  const { t, lang, setLang } = useI18n();

  // ===== User / unread =====
  const { data: meData } = useQuery(Q_ME, { skip: !userSession, fetchPolicy: "cache-first" });
  const me = meData?.me;

  const totalUnread = useGlobalChatStore((s: any) =>
    Object.values(s.unreadByChat || {}).reduce((sum: number, n: any) => sum + (n || 0), 0)
  );

  const { data: notifData } = useQuery(Q_UNREAD_NOTIFICATION_COUNT, {
    skip: !userSession,
    fetchPolicy: "cache-and-network",
  });
  const notifUnreadCount = notifData?.myUnreadNotificationCount ?? 0;

  // ===== Language =====
  const [currentLang, setCurrentLang] = useState<Lang>(lang ?? initialLang);

  useEffect(() => {
    setCurrentLang(lang);
  }, [lang]);

  const changeLang = (nextLang: Lang) => {
    if (nextLang === currentLang) return;
    document.cookie = `lang=${nextLang}; path=/; samesite=lax`;
    setCurrentLang(nextLang);
    setLang?.(nextLang);
    router.refresh();
  };

  // sync cookie หลัง mount
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )lang=([^;]+)/);
    const c = (m ? decodeURIComponent(m[1]) : null) as Lang | null;
    if (c && c !== currentLang) setCurrentLang(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const languageMenu: MenuProps["items"] = (["th", "en"] as Lang[]).map((lng) => ({
    key: lng,
    disabled: lng === currentLang,
    label: (
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          opacity: lng === currentLang ? 0.45 : 1,
        }}
      >
        <span style={{ fontSize: 18 }}>{flagOf[lng]}</span>
        <span>{labelOf[lng]}</span>
      </span>
    ),
    onClick: () => changeLang(lng),
  }));

  const profileMenu: MenuProps["items"] = [
    { key: "settings", label: <Link href="/settings">Settings</Link>, icon: <SettingOutlined /> },
    { type: "divider" },
    { key: "logout", label: <span onClick={onLogout}>Logout</span>, icon: <ReloadOutlined /> },
  ];

  // ====== Search + History ======
  const [searchValue, setSearchValue] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const searchInputRef = useRef<any>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  // load history จาก localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("globalSearchHistory");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed.filter((x) => typeof x === "string"));
        }
      }
    } catch (e) {
      console.warn("[Search] load history error", e);
    }
  }, []);

  const saveHistory = (list: string[]) => {
    setSearchHistory(list);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("globalSearchHistory", JSON.stringify(list));
    }
  };

  const addToHistory = (term: string) => {
    const tVal = term.trim();
    if (!tVal) return;
    const next = [tVal, ...searchHistory.filter((x) => x !== tVal)].slice(0, 10);
    saveHistory(next);
  };

  const clearHistory = () => {
    saveHistory([]);
    setSearchValue("");
  };

  const handleSearchSubmit = (raw?: string) => {
    const q = (raw ?? searchValue).trim();
    if (!q) return;

    addToHistory(q);
    setSearchValue(q);

    router.push(
      `/search?q=${encodeURIComponent(q)}`,
      { scroll: false }      // ป้องกัน jump-to-top
    );
  };


  const handleSearchSelect = (value: string) => {
    if (value === "__clear__") {
      clearHistory();
      return;
    }
    setSearchValue(value);
    handleSearchSubmit(value);
  };

  const clearSearchInput = () => {
    setSearchValue("");
    // ไม่ยุ่งกับ URL /search?q=... แค่เคลียร์ช่องบน header
    searchInputRef.current?.focus?.();
  };

  const searchOptions = useMemo(() => {
    const historyOptions = searchHistory.map((h) => ({
      value: h,
      label: (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            <HistoryOutlined style={{ marginRight: 8, color: "#999" }} />
            {h}
          </span>
        </div>
      ),
    }));

    const clearOption =
      searchHistory.length > 0
        ? [
            {
              value: "__clear__",
              label: (
                <div
                  style={{
                    textAlign: "right",
                    fontSize: 12,
                    color: "#999",
                  }}
                >
                  {t("header.searchClearHistory")}
                </div>
              ),
            },
          ]
        : [];

    return [...historyOptions, ...clearOption];
  }, [searchHistory, t]);

  // Ctrl+K / Cmd+K → focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const metaPressed = isMac ? e.metaKey : e.ctrlKey;
      if (metaPressed && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Header
      style={{
        background: "#fff",
        padding: "0 16px",
        height: 64,
        borderBottom: "1px solid #f0f0f0",
        position: "sticky",  
        top: 0,
        zIndex: 1000,      
      }}>
      {/* ชั้นใน: จัดเป็น 3 โซน ซ้ายกลางขวา */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          height: "100%",
        }}
      >
        {/* ซ้าย: Logo / Title */}
        <div style={{ flexShrink: 0 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Text
              style={{
                color: "#000",
                fontSize: 18,
                letterSpacing: 1,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {t("header.title")}
            </Text>
          </Link>
        </div>

        {/* กลาง: Search (ให้ขยายได้เต็ม ส่วนกลาง) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
          }}>
          <div
            style={{
              width: "100%",
              maxWidth: 650,
              minWidth: 100,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <AutoComplete
              value={searchValue}
              onChange={setSearchValue}
              onSelect={handleSearchSelect}
              options={searchOptions}
              popupMatchSelectWidth={true}>
              <Input
                ref={searchInputRef}
                size="middle"
                placeholder={t("header.searchPlaceholder")}
                prefix={
                  <SearchOutlined
                    style={{
                      color: searchFocused ? "#1677ff" : "#999",
                      transition: "color .18s ease",
                    }}
                  />
                }
                suffix={
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: "#999",
                    }}
                  >
                    {/* ✅ ปุ่ม X เคลียร์ เมื่อมี text */}
                    {searchValue && (
                      <CloseCircleFilled
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          clearSearchInput();
                        }}
                        style={{
                          fontSize: 14,
                          cursor: "pointer",
                          color: "#bfbfbf",
                        }}
                      />
                    )}

                    {/* Ctrl + K hint เดิม */}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          padding: "1px 6px",
                          borderRadius: 6,
                          background: "#f0f0f0",
                          border: "1px solid #e1e1e1",
                          boxShadow: "0 1px 0 rgba(255,255,255,0.6)",
                        }}
                      >
                        Ctrl
                      </span>
                      <span style={{ opacity: 0.7 }}>+</span>
                      <span
                        style={{
                          padding: "1px 6px",
                          borderRadius: 6,
                          background: "#f0f0f0",
                          border: "1px solid #e1e1e1",
                          boxShadow: "0 1px 0 rgba(255,255,255,0.6)",
                        }}
                      >
                        K
                      </span>
                    </span>
                  </span>
                }
                style={{
                  width: "100%",
                  borderRadius: 999,
                  paddingInline: 16,
                  background: searchFocused ? "#ffffff" : "#f5f5f5",
                  border: searchFocused ? "1px solid rgba(22,119,255,0.35)" : "1px solid transparent",
                  boxShadow: searchFocused
                    ? "0 0 0 1px rgba(22,119,255,0.18), 0 6px 18px rgba(15,23,42,0.08)"
                    : "0 2px 6px rgba(15,23,42,0.04)",
                  transition: "all .18s ease",
                }}
                onPressEnter={() => handleSearchSubmit()}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </AutoComplete>
          </div>
        </div>

        {/* ขวา: ปุ่มต่าง ๆ */}
        <div style={{ flexShrink: 0 }}>
          <Space size={8} align="center">
            {userSession && (
              <>
                {/* Chat */}
                <Tooltip title="ข้อความ">
                  <Button
                    type="text"
                    onClick={() => router.push("/chat")}
                    icon={
                      <span style={{ position: "relative", display: "inline-block" }}>
                        <MessageOutlined style={{ fontSize: 18, color: "#000" }} />
                        {totalUnread > 0 && (
                          <span
                            style={{
                              position: "absolute",
                              top: 10,
                              right: -10,
                              minWidth: 18,
                              height: 18,
                              padding: "0 5px",
                              background: "#ff4d4f",
                              borderRadius: 999,
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 0 4px rgba(0, 0, 0, 0.3)",
                            }}
                          >
                            {totalUnread > 99 ? "99+" : totalUnread}
                          </span>
                        )}
                      </span>
                    }
                  />
                </Tooltip>

                {/* Notifications */}
                <Tooltip title="แจ้งเตือน">
                  <Button
                    type="text"
                    onClick={() => router.push("/notification")}
                    icon={
                      <span style={{ position: "relative", display: "inline-block" }}>
                        <BellOutlined style={{ fontSize: 18, color: "#000" }} />
                        {notifUnreadCount > 0 && (
                          <span
                            style={{
                              position: "absolute",
                              top: 10,
                              right: -10,
                              minWidth: 18,
                              height: 18,
                              padding: "0 5px",
                              background: "#ff4d4f",
                              borderRadius: 999,
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 0 4px rgba(0, 0, 0, 0.3)",
                            }}
                          >
                            {notifUnreadCount > 99 ? "99+" : notifUnreadCount}
                          </span>
                        )}
                      </span>
                    }
                  />
                </Tooltip>
              </>
            )}

            {/* Language */}
            <Dropdown
              menu={{ items: languageMenu }}
              trigger={["click"]}
              placement="bottomRight"
              arrow
              overlayStyle={{ minWidth: 180 }}
            >
              <Button type="text" onClick={(e) => e.preventDefault()}>
                <span style={{ fontSize: 18, marginRight: 6 }}>{flagOf[currentLang]}</span>
                <span>{labelOf[currentLang]}</span>
              </Button>
            </Dropdown>

            {/* Help */}
            <Tooltip title="ศูนย์ช่วยเหลือ">
              <Button
                type="text"
                onClick={() => router.push("/help")}
                icon={<QuestionCircleOutlined style={{ fontSize: 18, color: "#000" }} />}
              />
            </Tooltip>

            {/* User Avatar / Login */}
            {userSession ? (
              <Dropdown
                menu={{ items: profileMenu }}
                trigger={["click"]}
                placement="bottomRight"
                arrow
              >
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
        </div>
      </div>
    </Header>
  );
}
