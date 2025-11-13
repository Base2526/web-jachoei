"use client";

import React from "react";
import { Layout, theme } from "antd";
import Breadcrumbs from "./Breadcrumbs";
import HeaderBar from "./HeaderBar"; // ← เพิ่มบรรทัดนี้

const { Content, Footer } = Layout;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout style={{ minHeight: "100vh", background: "#ffffffff" }}>
      {/* ใช้ HeaderBar ที่ทำให้เหมือนภาพ */}
      <HeaderBar />

      <Content
        style={{
          margin: "16px auto",
          width: "100%",
          maxWidth: 1400,
          padding: "0 16px",
        }}
      >
        <Breadcrumbs />
        <div
          style={{
            padding: 16,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 360,
          }}
        >
          {children}
        </div>
      </Content>

      <Footer style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", background: "#ffffffff" }}>
        © {new Date().getFullYear()} BEST MALL U
      </Footer>
    </Layout>
  );
}
