"use client";

import { Typography, Divider } from "antd";
import { useI18n } from "@/lib/i18nContext";

const { Title, Paragraph, Text } = Typography;

export default function TermsPage() {
  const { t } = useI18n();

  
  return (
    <div style={{ width: "100%", minHeight: 520, padding: 16 }}>
    <Typography>
      <Title level={2}>Terms & Conditions</Title>
      <Paragraph>
        เงื่อนไขและข้อตกลงในการใช้งานเว็บไซต์และบริการของ {t("header.title")}
      </Paragraph>

      <Divider />

      <Title level={4}>1. Acceptance of Terms</Title>
      <Paragraph>
        การเข้าถึงหรือใช้งานเว็บไซต์นี้ ถือว่าคุณตกลงยอมรับเงื่อนไขและข้อตกลงทั้งหมด
        หากคุณไม่ยอมรับ กรุณาหยุดการใช้งานทันที
      </Paragraph>

      <Title level={4}>2. Use of the Service</Title>
      <Paragraph>
        คุณตกลงที่จะใช้งานเว็บไซต์และบริการนี้อย่างถูกต้องตามกฎหมาย
        และไม่กระทำการใด ๆ ที่อาจก่อให้เกิดความเสียหายต่อระบบ ผู้ใช้งานอื่น
        หรือบุคคลภายนอก
      </Paragraph>

      <Title level={4}>3. Limitation of Liability</Title>
      <Paragraph>
        เว็บไซต์และซอฟต์แวร์นี้ให้บริการในสภาพ “ตามสภาพที่เป็น” (AS IS)
        ผู้พัฒนาไม่รับผิดชอบต่อความเสียหายใด ๆ ที่เกิดจากการใช้งาน
      </Paragraph>

      <Divider />

      <Paragraph type="secondary">
        This Terms & Conditions page applies to all users of the website and services.
      </Paragraph>
    </Typography>
    </div>
  );
}
