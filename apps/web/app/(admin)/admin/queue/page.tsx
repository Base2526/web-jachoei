"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Flex,
  InputNumber,
  message,
  Row,
  Segmented,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ClearOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SendOutlined,
  WarningOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

type ApiData = {
  ok: boolean;
  error?: string;
  keys?: { QUEUE_KEY: string; DLQ_KEY: string; DELAYED_KEY: string };
  counts?: { queueLen: number; dlqLen: number; delayedLen: number; dbCount: number }; // ✅ add dbCount
  preview?: {
    queue: Array<{ raw: string; parsed: any }>;
    dlq: Array<{ raw: string; parsed: any }>;
    delayed: Array<{ raw: string; runAtMs: number; parsed: { raw: string; parsed: any } }>;
  };
  now?: number;
  dbError?: string; // ✅ optional (มาจาก /api/admin/queue ถ้า count db พัง)
};

type DbApi = {
  ok: boolean;
  error?: string;
  rows?: DbRow[];
};

type ViewKey = "queue" | "delayed" | "dlq" | "db";

type RowItem = {
  key: string;
  idx: number;
  platform?: string;
  action?: string;
  postId?: string;
  eventId?: string;
  attempts?: number;
  maxAttempts?: number;
  runAtMs?: number;
  parsed: any;
  raw: string;
};

type DbRow = {
  post_id: string;
  platform: "facebook";
  status: "PENDING" | "PUBLISHED" | "FAILED" | "SKIPPED";
  social_post_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type DbRowItem = {
  key: string;
  idx: number;
  postId: string;
  platform: string;
  status: string;
  socialPostId?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  row: DbRow;
};

function getAdminToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("ADMIN_TOKEN") ?? "";
}

async function fetchQueue(): Promise<ApiData> {
  const token = getAdminToken();
  const res = await fetch("/api/admin/queue", {
    headers: token ? { "x-admin-token": token } : {},
    cache: "no-store",
  });
  return res.json();
}

async function fetchDb(limit = 80): Promise<DbApi> {
  const token = getAdminToken();
  const res = await fetch(`/api/admin/queue/db?limit=${limit}`, {
    headers: token ? { "x-admin-token": token } : {},
    cache: "no-store",
  });
  return res.json();
}

async function postAction(action: string, body: any = {}) {
  const token = getAdminToken();
  const res = await fetch("/api/admin/queue/actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-admin-token": token } : {}),
    },
    body: JSON.stringify({ action, ...body }),
  });
  return res.json();
}

function fmtTime(ms?: number) {
  if (!ms) return "-";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "-";
  }
}
function fmtISO(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function actionColor(action?: string) {
  if (action === "create") return "green";
  if (action === "update") return "blue";
  if (action === "delete") return "red";
  return "default";
}

function statusColor(status?: string) {
  if (status === "PUBLISHED") return "green";
  if (status === "FAILED") return "red";
  if (status === "SKIPPED") return "default";
  if (status === "PENDING") return "blue";
  return "default";
}

export default function Page() {
  const [data, setData] = useState<ApiData | null>(null);
  const [db, setDb] = useState<DbApi | null>(null);
  const [loading, setLoading] = useState(false);

  const [auto, setAuto] = useState(true);
  const [intervalMs, setIntervalMs] = useState(2000);

  const [view, setView] = useState<ViewKey>("queue");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [selectedJob, setSelectedJob] = useState<RowItem | null>(null);
  const [selectedDb, setSelectedDb] = useState<DbRowItem | null>(null);

  const [msgApi, contextHolder] = message.useMessage();

  const counts = data?.counts;
  const keysInfo = useMemo(() => (data?.keys ? data.keys : null), [data]);

  // ✅ refresh ใหม่: ถ้า view=db -> ยิง /queue เพื่ออัปเดต counts + ยิง /db เพื่อเอา table
  const refresh = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (view === "db") {
        const [q, d] = await Promise.all([fetchQueue(), fetchDb(120)]);
        setData(q);
        setDb(d);

        if (!q.ok) msgApi.error(q.error ?? "Queue API error");
        if (q.dbError) msgApi.warning(`DB Count warning: ${q.dbError}`);

        if (!d.ok) msgApi.error(d.error ?? "DB History error");
      } else {
        const q = await fetchQueue();
        setData(q);
        if (!q.ok) msgApi.error(q.error ?? "Queue API error");
        if (q.dbError) msgApi.warning(`DB Count warning: ${q.dbError}`);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => refresh(true), intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, intervalMs, view]);

  const rows: RowItem[] = useMemo(() => {
    if (!data?.preview) return [];

    const list =
      view === "queue"
        ? data.preview.queue
        : view === "dlq"
        ? data.preview.dlq
        : view === "delayed"
        ? data.preview.delayed.map((x: any) => ({
            raw: x.raw,
            parsed: x.parsed?.parsed ?? null,
            runAtMs: x.runAtMs,
          }))
        : [];

    return list.map((item: any, i: number) => {
      const parsed = item?.parsed ?? null;
      return {
        key: `${view}-${i}`,
        idx: i + 1,
        platform: parsed?.platform,
        action: parsed?.action,
        postId: parsed?.post?.postId,
        eventId: parsed?.eventId,
        attempts: parsed?.attempts,
        maxAttempts: parsed?.maxAttempts,
        runAtMs: item?.runAtMs,
        parsed,
        raw: item?.raw,
      };
    });
  }, [data, view]);

  const dbRows: DbRowItem[] = useMemo(() => {
    const list = db?.rows ?? [];
    return list.map((r, i) => ({
      key: `db-${i}`,
      idx: i + 1,
      postId: r.post_id,
      platform: r.platform,
      status: r.status,
      socialPostId: r.social_post_id,
      lastError: r.last_error,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      row: r,
    }));
  }, [db]);

  const onRowClick = (record: RowItem) => {
    setSelectedDb(null);
    setSelectedJob(record);
    setDrawerOpen(true);
  };

  const onDbRowClick = (record: DbRowItem) => {
    setSelectedJob(null);
    setSelectedDb(record);
    setDrawerOpen(true);
  };

  const doAction = async (action: string, body: any = {}) => {
    try {
      const r = await postAction(action, body);
      if (r.ok) {
        msgApi.success(
          action === "pump_delayed"
            ? `Pumped ${r.moved ?? 0} job(s)`
            : action === "requeue_dlq"
            ? `Requeued ${r.moved ?? 0} job(s)`
            : "Done"
        );
      } else {
        msgApi.error(r.error ?? "Action failed");
      }
      refresh(true);
    } catch (e: any) {
      msgApi.error(String(e?.message ?? e));
    }
  };

  const queueColumns = [
    {
      title: "#",
      dataIndex: "idx",
      width: 60,
      sorter: (a: RowItem, b: RowItem) => a.idx - b.idx,
    },
    {
      title: "Platform",
      dataIndex: "platform",
      width: 110,
      render: (v: string) => (v ? <Tag>{v}</Tag> : <Text type="secondary">-</Text>),
    },
    {
      title: "Action",
      dataIndex: "action",
      width: 110,
      render: (v: string) =>
        v ? <Tag color={actionColor(v)}>{v}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: "Post ID",
      dataIndex: "postId",
      ellipsis: true,
      render: (v: string) => (v ? <Text code>{v}</Text> : <Text type="secondary">-</Text>),
    },
    {
      title: "Attempts",
      dataIndex: "attempts",
      width: 120,
      render: (_: any, r: RowItem) => {
        if (r.attempts === undefined && r.maxAttempts === undefined)
          return <Text type="secondary">-</Text>;
        return (
          <Space size={6}>
            <Tag color={r.attempts && r.attempts > 0 ? "orange" : "default"}>
              {Number(r.attempts ?? 0)}
            </Tag>
            <Text type="secondary">/</Text>
            <Tag>{Number(r.maxAttempts ?? 8)}</Tag>
          </Space>
        );
      },
    },
    ...(view === "delayed"
      ? [
          {
            title: "Run At",
            dataIndex: "runAtMs",
            width: 190,
            render: (v: number) => <Text>{fmtTime(v)}</Text>,
          },
        ]
      : []),
    {
      title: "Event ID",
      dataIndex: "eventId",
      ellipsis: true,
      width: 220,
      render: (v: string) =>
        v ? <Text type="secondary">{v}</Text> : <Text type="secondary">-</Text>,
    },
  ];

  const dbColumns = [
    { title: "#", dataIndex: "idx", width: 60 },
    {
      title: "Updated",
      dataIndex: "updatedAt",
      width: 190,
      render: (v: string) => <Text>{fmtISO(v)}</Text>,
      sorter: (a: DbRowItem, b: DbRowItem) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      defaultSortOrder: "descend" as const,
    },
    {
      title: "Post ID",
      dataIndex: "postId",
      ellipsis: true,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: "Platform",
      dataIndex: "platform",
      width: 110,
      render: (v: string) => <Tag>{v}</Tag>,
      filters: [
        { text: "facebook", value: "facebook" },
        { text: "x", value: "x" },
      ],
      onFilter: (value: any, record: DbRowItem) => record.platform === value,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      render: (v: string) => <Tag color={statusColor(v)}>{v}</Tag>,
      filters: [
        { text: "PUBLISHED", value: "PUBLISHED" },
        { text: "FAILED", value: "FAILED" },
        { text: "SKIPPED", value: "SKIPPED" },
        { text: "PENDING", value: "PENDING" },
      ],
      onFilter: (value: any, record: DbRowItem) => record.status === value,
    },
    {
      title: "Social ID",
      dataIndex: "socialPostId",
      ellipsis: true,
      width: 220,
      render: (v: string) => (v ? <Text type="secondary">{v}</Text> : <Text type="secondary">-</Text>),
    },
    {
      title: "Last error",
      dataIndex: "lastError",
      ellipsis: true,
      render: (v: string) => (v ? <Text type="secondary">{v}</Text> : <Text type="secondary">-</Text>),
    },
  ];

  return (
    <>
      {contextHolder}

      <Card styles={{ body: { padding: 16 } }}>
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Social Queue Monitor
            </Title>
            <Text type="secondary">
              {view === "db"
                ? "DB History from social_posts"
                : data?.now
                ? `Now: ${new Date(data.now).toLocaleString()}`
                : "—"}
            </Text>
          </div>

          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => refresh()} loading={loading} type="primary">
              Refresh
            </Button>

            <Space>
              <Text type="secondary">Auto</Text>
              <Switch checked={auto} onChange={setAuto} />
            </Space>

            <Space>
              <Text type="secondary">Interval</Text>
              <InputNumber
                min={500}
                step={500}
                value={intervalMs}
                onChange={(v) => setIntervalMs(Number(v ?? 2000))}
                style={{ width: 120 }}
                addonAfter="ms"
              />
            </Space>
          </Space>
        </Flex>

        {(data && !data.ok && view !== "db") || (db && !db.ok && view === "db") ? (
          <Alert
            style={{ marginTop: 12 }}
            type="error"
            message="API Error"
            description={
              <div>
                <div>{(view === "db" ? db?.error : data?.error) ?? "Unknown error"}</div>
                <Divider style={{ margin: "8px 0" }} />
                <Text type="secondary">ถ้าตั้ง ADMIN_TOKEN ไว้ ใส่ใน console:</Text>
                <pre style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                  localStorage.setItem("ADMIN_TOKEN","YOUR_TOKEN")
                </pre>
              </div>
            }
            showIcon
          />
        ) : null}

        <Divider style={{ margin: "14px 0" }} />

        {/* ✅ 4 cards */}
        <Row gutter={[12, 12]}>
          <Col xs={24} md={6}>
            <Card size="small" bordered>
              <Statistic title="Queue" value={counts?.queueLen ?? 0} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small" bordered>
              <Statistic title="Delayed" value={counts?.delayedLen ?? 0} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small" bordered>
              <Statistic title="DLQ" value={counts?.dlqLen ?? 0} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small" bordered>
              <Tooltip title="Total rows in social_posts">
                <Statistic title="DB" value={counts?.dbCount ?? 0} />
              </Tooltip>
            </Card>
          </Col>
        </Row>

        <Divider style={{ margin: "14px 0" }} />

        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <Segmented<ViewKey>
            value={view}
            options={[
              { label: "Queue", value: "queue" },
              { label: "Delayed", value: "delayed" },
              { label: "DLQ", value: "dlq" },
              { label: <span><DatabaseOutlined /> DB History</span>, value: "db" },
            ]}
            onChange={(v) => setView(v as ViewKey)}
          />

          {view !== "db" ? (
            <Space wrap>
              <Tooltip title="ย้ายงานที่ถึงเวลาจาก Delayed → Queue">
                <Button icon={<SendOutlined />} onClick={() => doAction("pump_delayed", { batch: 200 })}>
                  Pump Delayed
                </Button>
              </Tooltip>

              <Tooltip title="นำงานจาก DLQ กลับไป Queue (50 งาน)">
                <Button icon={<CloudDownloadOutlined />} onClick={() => doAction("requeue_dlq", { count: 50 })}>
                  Requeue DLQ
                </Button>
              </Tooltip>

              <Tooltip title="ล้าง Queue ปัจจุบันทั้งหมด">
                <Button danger icon={<ClearOutlined />} onClick={() => doAction("clear_queue")}>
                  Clear Queue
                </Button>
              </Tooltip>

              <Tooltip title="ล้าง Delayed ทั้งหมด">
                <Button danger icon={<DeleteOutlined />} onClick={() => doAction("clear_delayed")}>
                  Clear Delayed
                </Button>
              </Tooltip>

              <Tooltip title="ล้าง DLQ ทั้งหมด">
                <Button danger icon={<WarningOutlined />} onClick={() => doAction("clear_dlq")}>
                  Clear DLQ
                </Button>
              </Tooltip>
            </Space>
          ) : (
            <Text type="secondary">Showing latest records from social_posts</Text>
          )}
        </Flex>

        <Divider style={{ margin: "14px 0" }} />

        {view !== "db" && keysInfo ? (
          <Descriptions size="small" column={1} bordered={false} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="QUEUE_KEY">
              <Text code>{keysInfo.QUEUE_KEY}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="DELAYED_KEY">
              <Text code>{keysInfo.DELAYED_KEY}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="DLQ_KEY">
              <Text code>{keysInfo.DLQ_KEY}</Text>
            </Descriptions.Item>
          </Descriptions>
        ) : null}

        {view === "db" ? (
          <Table<DbRowItem>
            size="middle"
            rowKey="key"
            columns={dbColumns as any}
            dataSource={dbRows}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            onRow={(record) => ({ onClick: () => onDbRowClick(record) })}
            locale={{ emptyText: "No DB history found (social_posts)" }}
          />
        ) : (
          <Table<RowItem>
            size="middle"
            rowKey="key"
            columns={queueColumns as any}
            dataSource={rows}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            onRow={(record) => ({ onClick: () => onRowClick(record) })}
            locale={{ emptyText: "No jobs found" }}
          />
        )}
      </Card>

      <Drawer title="Details" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={720}>
        {selectedJob ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Card size="small">
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="Platform">
                  {selectedJob.platform ? <Tag>{selectedJob.platform}</Tag> : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Action">
                  {selectedJob.action ? (
                    <Tag color={actionColor(selectedJob.action)}>{selectedJob.action}</Tag>
                  ) : (
                    "-"
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Post ID" span={2}>
                  {selectedJob.postId ? <Text code>{selectedJob.postId}</Text> : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Event ID" span={2}>
                  {selectedJob.eventId ? <Text type="secondary">{selectedJob.eventId}</Text> : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Attempts">{selectedJob.attempts ?? 0}</Descriptions.Item>
                <Descriptions.Item label="Max Attempts">{selectedJob.maxAttempts ?? 8}</Descriptions.Item>
                {view === "delayed" ? (
                  <Descriptions.Item label="Run At" span={2}>
                    {fmtTime(selectedJob.runAtMs)}
                  </Descriptions.Item>
                ) : null}
              </Descriptions>
            </Card>

            <Card size="small" title="Parsed">
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowX: "auto" }}>
                {JSON.stringify(selectedJob.parsed, null, 2)}
              </pre>
            </Card>

            <Card size="small" title="Raw">
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowX: "auto" }}>
                {selectedJob.raw}
              </pre>
            </Card>
          </Space>
        ) : selectedDb ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Card size="small">
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="Platform">
                  <Tag>{selectedDb.platform}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={statusColor(selectedDb.status)}>{selectedDb.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Post ID" span={2}>
                  <Text code>{selectedDb.postId}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Social Post ID" span={2}>
                  {selectedDb.socialPostId ? (
                    <Text type="secondary">{selectedDb.socialPostId}</Text>
                  ) : (
                    <Text type="secondary">-</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Created At">{fmtISO(selectedDb.createdAt)}</Descriptions.Item>
                <Descriptions.Item label="Updated At">{fmtISO(selectedDb.updatedAt)}</Descriptions.Item>
                <Descriptions.Item label="Last Error" span={2}>
                  <Text type="secondary">{selectedDb.lastError ?? "-"}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Raw DB row">
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowX: "auto" }}>
                {JSON.stringify(selectedDb.row, null, 2)}
              </pre>
            </Card>
          </Space>
        ) : (
          <Text type="secondary">Select an item</Text>
        )}
      </Drawer>
    </>
  );
}
