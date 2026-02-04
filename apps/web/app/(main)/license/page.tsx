"use client";

import { Typography, Divider } from "antd";

import { useI18n } from "@/lib/i18nContext";

const { Title, Paragraph, Link } = Typography;

export default function LicensePage() {
  const { t } = useI18n();
  return (
    <Typography>
      <Title level={2}>License</Title>
      <Paragraph>
        Licensing information for {t("header.title")}
      </Paragraph>

      <Divider />

      <Title level={4}>Open Source Repository</Title>
      <Paragraph>
        {t("header.title")} is based on the following open-source repository:
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

      <Title level={4}>MIT License</Title>
      <Paragraph>
        Copyright © {new Date().getFullYear()} {t("header.title")}
      </Paragraph>

      <Paragraph>
        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
      </Paragraph>
    </Typography>
  );
}
