// app/admin/env/EnvTableClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import { Button, Card, Descriptions, Input, Space, Table, Tag, Typography, message } from "antd";
import { CopyOutlined, KeyOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { EnvRow } from "./page";

const { Text } = Typography;

type Meta = {
  nodeEnv: string;
  runtime: string;
  hostname: string;
  pid: string;
  uptimeSec: string;
  now: string;
};

export default function EnvTableClient({ env, meta }: { env: EnvRow[]; meta: Meta }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return env;
    return env.filter((r) => r.key.toLowerCase().includes(s));
  }, [q, env]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success("Copied");
    } catch {
      // fallback
      try {
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        message.success("Copied");
      } catch {
        message.error("Copy failed");
      }
    }
  };

  const columns: ColumnsType<EnvRow> = [
    {
      title: "Key",
      dataIndex: "key",
      key: "key",
      width: 360,
      render: (k: string) => (
        <Space>
          <KeyOutlined />
          <Text code>{k}</Text>
        </Space>
      ),
      sorter: (a, b) => a.key.localeCompare(b.key),
      defaultSortOrder: "ascend",
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
      render: (v: string) => (
        <Text code style={{ wordBreak: "break-all" }}>
          {v || "(empty)"}
        </Text>
      ),
    },
    {
      title: "Masked",
      dataIndex: "masked",
      key: "masked",
      width: 110,
      align: "center",
      render: (m: boolean) => (m ? <Tag color="gold">MASKED</Tag> : <Tag>OK</Tag>),
      filters: [
        { text: "Masked", value: "masked" },
        { text: "Not masked", value: "ok" },
      ],
      onFilter: (value, record) => {
        if (value === "masked") return record.masked;
        return !record.masked;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space>
          <Button icon={<CopyOutlined />} onClick={() => copy(record.key)}>
            Copy Key
          </Button>
          <Button icon={<CopyOutlined />} onClick={() => copy(record.value)}>
            Copy Value
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card title="System ENV" bordered>
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="NODE_ENV">{meta.nodeEnv}</Descriptions.Item>
            <Descriptions.Item label="Runtime">{meta.runtime}</Descriptions.Item>
            <Descriptions.Item label="Hostname">{meta.hostname}</Descriptions.Item>
            <Descriptions.Item label="PID">{meta.pid}</Descriptions.Item>
            <Descriptions.Item label="Uptime (sec)">{meta.uptimeSec}</Descriptions.Item>
            <Descriptions.Item label="Now">{meta.now}</Descriptions.Item>
          </Descriptions>
          <div style={{ marginTop: 12, opacity: 0.75 }}>
            * ค่า secret จะถูก mask อัตโนมัติ (Copy Value จะได้ค่า mask ไม่ใช่ค่าจริง)
          </div>
        </Card>

        <Card
          title={
            <Space>
              <SearchOutlined />
              ENV List
            </Space>
          }
          extra={<Tag>{filtered.length} items</Tag>}
          bordered
        >
          <Input
            allowClear
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search key เช่น DATABASE / REDIS / NEXT_ ..."
            style={{ marginBottom: 12 }}
          />

          <Table<EnvRow>
            rowKey="key"
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 50, showSizeChanger: true }}
            scroll={{ x: 980 }}
          />
        </Card>
      </Space>
    </div>
  );
}
