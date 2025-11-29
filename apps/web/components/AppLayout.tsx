"use client";

import { Layout, theme, Grid } from "antd";
import Breadcrumbs from "./Breadcrumbs";
import HeaderBar from "./HeaderBar";

const { Content, Footer } = Layout;
const { useBreakpoint } = Grid;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const screens = useBreakpoint();
  const isMobile = !screens.md; // md breakpoint = ~768px

  return (
    <Layout
      style={{
        minHeight: "100vh",
        background: "#ffffffff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header responsive */}
      <HeaderBar isMobile={isMobile} />

      {/* Main content */}
      <Content
        style={{
          margin: isMobile ? "0px auto" : "16px auto",
          width: "100%",
          maxWidth: isMobile ? "100%" : 1400,
          padding: isMobile ? "0 0px" : "0 16px",
        }}
      >
        {/* Breadcrumb: ซ่อนบนมือถือ */}
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

      {/* Footer compact บน mobile */}
      <Footer
        style={{
          textAlign: "center",
          color: "rgba(0,0,0,0.45)",
          background: "#ffffffff",
          fontSize: isMobile ? 12 : 14,
          padding: isMobile ? "8px 0" : "16px 0",
        }}
      >
        © {new Date().getFullYear()} BEST MALL U
      </Footer>
    </Layout>
  );
}
