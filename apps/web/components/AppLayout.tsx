"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layout, theme, Grid, Space, Typography, Divider, Tag, Tooltip, Button } from "antd";
import {
  FileTextOutlined,
  SafetyCertificateOutlined,
  CodeOutlined,
  BookOutlined,
  HeartOutlined,
  CustomerServiceOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SettingOutlined,
} from "@ant-design/icons";

import Breadcrumbs from "./Breadcrumbs";
import HeaderBar from "./HeaderBar";
import { useI18n } from "@/lib/i18nContext";

const { Content, Footer } = Layout;
const { useBreakpoint } = Grid;
const { Text } = Typography;

const footerLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "rgba(0,0,0,0.02)",
  color: "rgba(0,0,0,0.68)",
  textDecoration: "none",
  lineHeight: 1,
  transition: "all 160ms ease",
};

const mobileFooterLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 38,
  height: 38,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "rgba(0,0,0,0.02)",
  color: "rgba(0,0,0,0.7)",
  textDecoration: "none",
  lineHeight: 1,
  transition: "all 160ms ease",
};

function hoverIn(e: React.MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.style.background = "rgba(0,0,0,0.045)";
  e.currentTarget.style.borderColor = "rgba(0,0,0,0.14)";
}
function hoverOut(e: React.MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.style.background = "rgba(0,0,0,0.02)";
  e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)";
}

/** -------------------------
 * PDPA / Cookie Consent (simple allow / reject)
 * - allow  = allow cookies/analytics (ถ้ามี)
 * - reject = allow only necessary cookies
 * - stored in localStorage
 * - user can reopen via footer "PDPA"
 * ------------------------- */
type ConsentValue = "allow" | "reject";
const CONSENT_KEY = "pdpa_consent_v1";

function readConsent(): { value: ConsentValue; at: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.value === "allow" || parsed?.value === "reject") return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeConsent(value: ConsentValue) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ value, at: new Date().toISOString() }));
  } catch {
    // ignore
  }
}

function PDPAConsentBar({
  isMobile,
  visible,
  onAllow,
  onReject,
  onClose,
}: {
  isMobile: boolean;
  visible: boolean;
  onAllow: () => void;
  onReject: () => void;
  onClose: () => void;
}) {
  if (!visible) return null;

  // แถบลอยด้านล่างแบบ “มาตรฐานทั่วไป”
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        padding: isMobile ? "10px 10px" : "14px 16px",
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(10px)",
        borderTop: "1px solid rgba(0,0,0,0.06)",
      }}
      role="dialog"
      aria-label="PDPA cookie consent"
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.08)",
          background: "#fff",
          padding: isMobile ? "10px 10px" : "12px 14px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <Space
          direction={isMobile ? "vertical" : "horizontal"}
          size={10}
          style={{ width: "100%", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center" }}
        >
          <div style={{ minWidth: 0 }}>
            <Text style={{ fontWeight: 600, color: "rgba(0,0,0,0.85)" }}>
              PDPA / Cookies
            </Text>
            <div style={{ marginTop: 2 }}>
              <Text style={{ color: "rgba(0,0,0,0.58)" }}>
                เราใช้คุกกี้ที่จำเป็นเพื่อให้เว็บทำงาน และอาจใช้คุกกี้วิเคราะห์เพื่อปรับปรุงประสบการณ์ใช้งาน
                คุณสามารถเลือก “Allow” หรือ “Reject” ได้
              </Text>
              <div style={{ marginTop: 6 }}>
                <Space size={10} wrap>
                  <Link href="/privacy" style={{ color: "rgba(0,0,0,0.65)" }}>
                    Privacy Policy
                  </Link>
                  <Link href="/terms" style={{ color: "rgba(0,0,0,0.65)" }}>
                    Terms
                  </Link>
                </Space>
              </div>
            </div>
          </div>

          <Space
            size={8}
            wrap
            style={{
              justifyContent: isMobile ? "flex-end" : "flex-end",
              flexShrink: 0,
            }}
          >
            <Button onClick={onReject} icon={<CloseCircleOutlined />} style={{ borderRadius: 12 }}>
              Reject
            </Button>
            <Button type="primary" onClick={onAllow} icon={<CheckCircleOutlined />} style={{ borderRadius: 12 }}>
              Allow
            </Button>

            {/* optional close (แต่ไม่บันทึก) */}
            {!isMobile && (
              <Button onClick={onClose} style={{ borderRadius: 12 }}>
                Close
              </Button>
            )}
          </Space>
        </Space>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const { t } = useI18n();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const year = new Date().getFullYear();

  // ---- PDPA state ----
  const [consent, setConsent] = useState<ConsentValue | null>(null);
  const [showPdpa, setShowPdpa] = useState(false);

  useEffect(() => {
    const c = readConsent();
    if (c?.value) {
      setConsent(c.value);
      setShowPdpa(false);
    } else {
      setShowPdpa(true);
    }
  }, []);

  const onAllow = () => {
    writeConsent("allow");
    setConsent("allow");
    setShowPdpa(false);

    // ✅ ตรงนี้เอาไว้ hook เปิด analytics ถ้าต้องการในอนาคต
    // window.dispatchEvent(new CustomEvent("pdpa:consent", { detail: { value: "allow" } }));
  };

  const onReject = () => {
    writeConsent("reject");
    setConsent("reject");
    setShowPdpa(false);

    // ✅ ตรงนี้เอาไว้ hook ปิด analytics ถ้าต้องการในอนาคต
    // window.dispatchEvent(new CustomEvent("pdpa:consent", { detail: { value: "reject" } }));
  };

  // ✅ ใส่ Roadmap เข้า footer (ใช้ i18n ถ้ามี ไม่มีก็ fallback)
  const footerLinks = useMemo(
    () => [
      { href: "/roadmap", label: "Roadmap", icon: <RocketOutlined /> },
      { href: "/terms", label: "Terms", icon: <FileTextOutlined /> },
      { href: "/privacy", label: "Privacy", icon: <SafetyCertificateOutlined /> },
      { href: "/open-source", label: "Open Source", icon: <CodeOutlined /> },
      { href: "/license", label: "License", icon: <BookOutlined /> },
      { href: "/support", label: (t("footer.support") as string) ?? "Support", icon: <CustomerServiceOutlined /> },
      { href: "/donate", label: "Donate", icon: <HeartOutlined /> },
    ],
    [t]
  );

  return (
    <Layout
      style={{
        minHeight: "100vh",
        background: "#ffffffff",
        display: "flex",
        flexDirection: "column",
        // เผื่อ PDPA bar บัง footer ตอนยังไม่กด
        paddingBottom: showPdpa ? (isMobile ? 120 : 98) : 0,
      }}
    >
      <HeaderBar isMobile={isMobile} />

      <Content
        style={{
          margin: isMobile ? "0px auto" : "16px auto",
          width: "100%",
          maxWidth: isMobile ? "100%" : 1400,
          padding: isMobile ? "0 0px" : "0 16px",
        }}
      >
        {!isMobile && <Breadcrumbs />}

        <div
          style={{
            padding: isMobile ? 0 : 16,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: isMobile ? "auto" : 360,
            boxShadow: isMobile ? "0 0 4px rgba(0,0,0,0.06)" : "none",
          }}
        >
          {children}
        </div>
      </Content>

      <Footer
        style={{
          background: "#ffffffff",
          padding: isMobile ? "12px 10px" : "22px 16px",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.06)",
            background: "rgba(0,0,0,0.015)",
            padding: isMobile ? "12px 10px" : "16px 18px",
          }}
        >
          <Space direction="vertical" size={10} style={{ width: "100%", alignItems: "center" }}>
            {/* top row */}
            <Space
              wrap
              size={10}
              style={{
                width: "100%",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "rgba(0,0,0,0.55)" }}>
                <Text>
                  © {year} {String(t("header.title") ?? "JACHOEI")}
                </Text>
              </Text>

              <Space size={8} wrap style={{ justifyContent: "center" }}>
                <Tag
                  icon={<SafetyCertificateOutlined />}
                  style={{
                    borderRadius: 999,
                    padding: "2px 10px",
                    margin: 0,
                    background: "rgba(0,0,0,0.02)",
                    borderColor: "rgba(0,0,0,0.08)",
                    color: "rgba(0,0,0,0.65)",
                  }}
                >
                  AS IS / No Warranty
                </Tag>

                {!isMobile && (
                  <Tag
                    icon={<CodeOutlined />}
                    style={{
                      borderRadius: 999,
                      padding: "2px 10px",
                      margin: 0,
                      background: "rgba(0,0,0,0.02)",
                      borderColor: "rgba(0,0,0,0.08)",
                      color: "rgba(0,0,0,0.65)",
                    }}
                  >
                    Open-source components
                  </Tag>
                )}
              </Space>
            </Space>

            <Divider style={{ margin: "4px 0", borderColor: "rgba(0,0,0,0.06)" }} />

            {/* links row */}
            {isMobile ? (
              <Space
                wrap
                size={8}
                style={{
                  justifyContent: "center",
                  width: "100%",
                }}
              >
                {footerLinks.map((it) => (
                  <Tooltip key={it.href} title={it.label} placement="top">
                    <Link
                      href={it.href}
                      style={mobileFooterLinkStyle}
                      onMouseEnter={hoverIn}
                      onMouseLeave={hoverOut}
                      aria-label={it.label}
                    >
                      <span style={{ fontSize: 18, lineHeight: 1, display: "inline-flex" }}>{it.icon}</span>
                    </Link>
                  </Tooltip>
                ))}

                {/* ✅ PDPA manage (mobile) */}
                <Tooltip
                  title={consent ? `PDPA: ${consent.toUpperCase()} (tap to change)` : "PDPA settings"}
                  placement="top"
                >
                  <button
                    type="button"
                    onClick={() => setShowPdpa(true)}
                    style={{
                      ...mobileFooterLinkStyle,
                      cursor: "pointer",
                    }}
                    aria-label="PDPA settings"
                  >
                    <SettingOutlined style={{ fontSize: 18 }} />
                  </button>
                </Tooltip>
              </Space>
            ) : (
              <Space wrap size={10} style={{ justifyContent: "center" }}>
                {footerLinks.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    style={footerLinkStyle}
                    onMouseEnter={hoverIn}
                    onMouseLeave={hoverOut}
                  >
                    {it.icon}
                    {it.label}
                  </Link>
                ))}

                {/* ✅ PDPA manage (desktop) */}
                <button
                  type="button"
                  onClick={() => setShowPdpa(true)}
                  style={{
                    ...footerLinkStyle,
                    cursor: "pointer",
                  }}
                  aria-label="PDPA settings"
                >
                  <SettingOutlined />
                  PDPA
                  {consent ? (
                    <span style={{ marginLeft: 6, opacity: 0.75, fontSize: 12 }}>
                      ({consent.toUpperCase()})
                    </span>
                  ) : null}
                </button>
              </Space>
            )}

            {/* bottom note */}
            {!isMobile && (
              <Text style={{ color: "rgba(0,0,0,0.45)", textAlign: "center" }}>
                Some components of this website are open-source. Software is provided “AS IS” without warranties. See Open
                Source / License for details.
              </Text>
            )}
          </Space>
        </div>
      </Footer>

      {/* ✅ PDPA bar (fixed bottom) */}
      <PDPAConsentBar
        isMobile={isMobile}
        visible={showPdpa}
        onAllow={onAllow}
        onReject={onReject}
        onClose={() => setShowPdpa(false)}
      />
    </Layout>
  );
}
