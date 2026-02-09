"use client";

import { Typography, Divider } from "antd";
import { useI18n } from "@/lib/i18nContext";

const { Title, Paragraph, Link } = Typography;

export default function OpenSourcePage() {
  const { t } = useI18n();

  return (
    <div style={{ width: "100%", minHeight: 520, padding: 16 }}>
    <Typography>
      <Title level={2}>Open Source</Title>
      <Paragraph>
        {t("header.title")} มีส่วนประกอบที่เป็นซอฟต์แวร์โอเพ่นซอร์ส (Open Source Software)
      </Paragraph>

      <Divider />

      <Title level={4}>Source Code Repository</Title>
      <Paragraph>
        ซอร์สโค้ดหลักของโปรเจกต์ {t("header.title")} สามารถเข้าถึงได้ที่ GitHub:
      </Paragraph>

      <Paragraph>
        <Link
          href="https://github.com/Base2526/next-apollo-pg-ws"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://github.com/Base2526/next-apollo-pg-ws
        </Link>
      </Paragraph>

      <Divider />

      <Paragraph type="secondary">
        This project includes open-source components. Services provided by {t("header.title")}
        may be subject to separate commercial terms.
      </Paragraph>
    </Typography>
    </div>
  );
}
