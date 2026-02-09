"use client";

import React, { useMemo } from "react";
// import Image from "next/image";
import { Card, Typography, Space, Button, Divider, message, Image } from "antd";
import { CopyOutlined, LinkOutlined, SafetyCertificateOutlined } from "@ant-design/icons";

const { Title, Paragraph, Text, Link } = Typography;

export default function DonatePage() {
  // ✅ ใส่ลิงก์/ข้อมูลจริงของคุณตรงนี้
  const paymentLink = "https://s.binance.com/czv6Ztzg"; // TODO
  const noteText = "Thank you for supporting this project ❤️";

  const handleCopy = async (value: string) => {
    try {
      // ✅ Modern clipboard (ต้องเป็น HTTPS หรือ localhost)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        message.success("Copied!");
        return;
      }

      // ✅ Fallback: execCommand copy (ใช้ได้แม้ HTTP หลายกรณี)
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.opacity = "0";
      textarea.setAttribute("readonly", "");

      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (ok) message.success("Copied!");
      else message.error("Copy failed");
    } catch (err) {
      message.error("Copy failed");
    }
  };

  return (
    <div style={{ width: "100%", minHeight: 520, padding: 16 }}>
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Title level={2} style={{ marginBottom: 0 }}>
        Donate
      </Title>
      <Paragraph style={{ marginTop: 0 }}>
        หากคุณอยากสนับสนุนการพัฒนาโปรเจกต์ สามารถโดเนทผ่าน Binance ได้ (QR / Payment Link)
      </Paragraph>

      <Card style={{ borderRadius: 16 }}>
        <Space
          direction="vertical"
          size={12}
          style={{ width: "100%", alignItems: "center" }}
        >
          <Title level={4} style={{ margin: 0 }}>
            Scan QR (Binance)
          </Title>

          <div
            style={{
              width: 240,
              height: 240,
              // borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.08)",
              overflow: "hidden",
              background: "white",
            }}
          >
            <Image
              src="/icons/binance-qr.png"
              alt="Binance Donate QR"
              width={240}
              height={240}
              // priority
            />
          </div>

          <Text type="secondary">
            สแกนด้วยแอป Binance แล้วตรวจสอบชื่อผู้รับ/จำนวนเงินก่อนยืนยันทุกครั้ง
          </Text>

          <Divider style={{ margin: "6px 0" }} />

          <Title level={5} style={{ margin: 0 }}>
            Payment link
          </Title>

          <Space wrap style={{ justifyContent: "center" }}>
            <Link href={paymentLink} target="_blank" rel="noopener noreferrer">
              <LinkOutlined /> Open payment link
            </Link>

            <Button icon={<CopyOutlined />} onClick={() => handleCopy(paymentLink)}>
              Copy link
            </Button>
          </Space>

          <Paragraph style={{ marginBottom: 0, textAlign: "center" }}>
            <Text strong>Note:</Text> {noteText}
          </Paragraph>

          <Divider style={{ margin: "6px 0" }} />

          <Space align="start">
            <SafetyCertificateOutlined style={{ marginTop: 2 }} />
            <Text type="secondary">
              หน้านี้เป็นเพียงข้อมูลสำหรับการโอนโดยตรงกับ Binance เท่านั้น เว็บไซต์นี้ไม่ประมวลผลการชำระเงิน
              และไม่สามารถช่วยกู้คืนธุรกรรมที่โอนผิดได้
            </Text>
          </Space>
        </Space>
      </Card>
    </Space>
    </div>
  );
}
