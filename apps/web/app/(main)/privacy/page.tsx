"use client";

import { Typography, Divider } from "antd";

import { useI18n } from "@/lib/i18nContext";

const { Title, Paragraph, Text } = Typography;

export default function PrivacyPage() {
  const { t } = useI18n();

  return (
    <div style={{ width: "100%", minHeight: 520, padding: 16 }}>
    <Typography>
      <Title level={2}>Privacy Policy</Title>
      <Paragraph>
        นโยบายความเป็นส่วนตัวของ {t("header.title")}
      </Paragraph>

      <Divider />

      <Title level={4}>1. Information We Collect</Title>
      <Paragraph>
        เราอาจเก็บข้อมูลที่จำเป็นต่อการให้บริการ เช่น
        ชื่อ อีเมล หมายเลขโทรศัพท์ หรือข้อมูลทางเทคนิค
      </Paragraph>

      <Title level={4}>2. Use of Information</Title>
      <Paragraph>
        ข้อมูลจะถูกใช้เพื่อปรับปรุงบริการ การติดต่อสื่อสาร
        และการรักษาความปลอดภัยของระบบ
      </Paragraph>

      <Title level={4}>3. Data Security</Title>
      <Paragraph>
        เราใช้มาตรการด้านความปลอดภัยที่เหมาะสมเพื่อปกป้องข้อมูลของผู้ใช้งาน
        อย่างไรก็ตาม ไม่มีระบบใดปลอดภัย 100%
      </Paragraph>

      <Title level={4}>4. Third-party Services</Title>
      <Paragraph>
        เว็บไซต์อาจมีการเชื่อมต่อกับบริการของบุคคลที่สาม
        ซึ่งมีนโยบายความเป็นส่วนตัวของตนเอง
      </Paragraph>

      <Divider />

      <Paragraph type="secondary">
        By using this website, you consent to the collection and use of information
        in accordance with this Privacy Policy.
      </Paragraph>
    </Typography>
    </div>
  );
}
