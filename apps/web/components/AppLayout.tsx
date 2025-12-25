"use client";

import React from "react";
import Link from "next/link";
import { Layout, theme, Grid, Space, Typography, Divider, Tag } from "antd";
import {
  FileTextOutlined,
  SafetyCertificateOutlined,
  CodeOutlined,
  BookOutlined,
  HeartOutlined,
  CustomerServiceOutlined
} from "@ant-design/icons";

import Breadcrumbs from "./Breadcrumbs";
import HeaderBar from "./HeaderBar";

// import { WEB_NAME } from "@/lib/config";
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const { t, lang, setLang } = useI18n();

  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const year = new Date().getFullYear();

  return (
    <Layout
      style={{
        minHeight: "100vh",
        background: "#ffffffff",
        display: "flex",
        flexDirection: "column",
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
          padding: isMobile ? "14px 12px" : "22px 16px",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.06)",
            background: "rgba(0,0,0,0.015)",
            padding: isMobile ? "14px 12px" : "16px 18px",
          }}
        >
          <Space
            direction="vertical"
            size={10}
            style={{ width: "100%", alignItems: "center" }}
          >
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
                <Text>© {year} {t("header.title")}</Text>
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
              </Space>
            </Space>

            <Divider style={{ margin: "4px 0", borderColor: "rgba(0,0,0,0.06)" }} />

            {/* links row */}
            <Space wrap size={10} style={{ justifyContent: "center" }}>
              <Link
                href="/terms"
                style={footerLinkStyle}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.045)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.14)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.02)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.08)";
                }}
              >
                <FileTextOutlined />
                Terms
              </Link>

              <Link
                href="/privacy"
                style={footerLinkStyle}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.045)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.14)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.02)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.08)";
                }}
              >
                <SafetyCertificateOutlined />
                Privacy
              </Link>

              <Link
                href="/open-source"
                style={footerLinkStyle}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.045)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.14)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.02)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.08)";
                }}
              >
                <CodeOutlined />
                Open Source
              </Link>

              <Link
                href="/license"
                style={footerLinkStyle}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.045)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.14)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.02)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.08)";
                }}
              >
                <BookOutlined />
                License
              </Link>

              {/* 🔹 Support */}
              <Link
                href="/support"
                style={footerLinkStyle}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.045)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.14)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.02)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.08)";
                }}
              >
                <CustomerServiceOutlined />
                {t("footer.support") ?? "Support"}
              </Link>

              <Link
                href="/donate"
                style={footerLinkStyle}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.045)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.14)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,0,0,0.02)";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.08)";
                }}
              >
                <HeartOutlined />
                Donate
              </Link>

            </Space>

            {/* bottom note */}
            <Text style={{ color: "rgba(0,0,0,0.45)", textAlign: "center" }}>
              Some components of this website are open-source. Software is provided “AS IS” without
              warranties. See Open Source / License for details.
            </Text>
          </Space>
        </div>
      </Footer>
    </Layout>
  );
}