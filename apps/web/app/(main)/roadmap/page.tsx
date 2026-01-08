"use client";

import React, { useMemo } from "react";
import { Badge, Card, Col, Divider, Progress, Row, Space, Tag, Timeline, Typography } from "antd";
import type { TimelineProps } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  ShareAltOutlined,
  TeamOutlined,
  SearchOutlined,
  AlertOutlined,
  BarChartOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

type Status = "done" | "in_progress" | "planned";

type RoadmapItem = {
  id: string;
  quarter: string;
  title: string;
  status: Status;
  goals: string[];
  deliverables: string[];
  tags?: string[];
  icon?: React.ReactNode;
};

function statusColor(status: Status) {
  if (status === "done") return "green";
  if (status === "in_progress") return "blue";
  return "default";
}

function statusIcon(status: Status) {
  if (status === "done") return <CheckCircleOutlined />;
  if (status === "in_progress") return <ClockCircleOutlined />;
  return <RocketOutlined />;
}

export default function RoadmapRedBoxContent() {
  const labels = {
    pageTitle: "Roadmap การพัฒนาระบบ whosscam.com",
    subtitle: "แผนพัฒนาระบบเพื่อให้การรับเรื่องร้องเรียนมีความน่าเชื่อถือ ใช้งานง่าย และพร้อมใช้เป็นหลักฐาน",
    done: "เสร็จแล้ว",
    inProgress: "กำลังทำ",
    planned: "วางแผน",
    progressLabel: "ความคืบหน้าโดยประมาณ",
    keyObjectives: "เป้าหมายหลัก",
    objectives: [
      "รวบรวมหลักฐานได้ครบถ้วน + เชื่อถือได้ (Evidence-ready)",
      "ลดเรื่องซ้ำ/สแปม และยกระดับคุณภาพข้อมูล",
      "ทำให้การแชร์/รายงาน/ส่งต่อหน่วยงานทำได้ง่าย",
      "รองรับการเติบโต: moderation, analytics, API",
    ],
    notes: "หมายเหตุ",
    recommendTag: "คำแนะนำ",
    notesText:
      "Roadmap นี้ออกแบบให้เริ่มจากการทำ “เคสมีหลักฐานและตรวจสอบได้” ก่อน แล้วค่อยขยายไป social automation และ analytics เพื่อโตแบบมีคุณภาพ",
    tip1: "เริ่มจาก Export PDF + Zip หลักฐานก่อน แล้วค่อยต่อ Social Auto-post",
    tip2: "ลงทุนกับ Search + Duplicate detection จะลดภาระทีมและเพิ่มคุณภาพข้อมูล",
    suggestedAdd: "ข้อเสนอแนะเพิ่มเติม (แนะนำ)",
    suggest: [
      { color: "purple", text: "Evidence Vault (ไฟล์หลักฐาน + เวลา)" },
      { color: "purple", text: "Case Timeline & Status" },
      { color: "purple", text: "Duplicate / Similarity Detection" },
      { color: "purple", text: "Moderation Queue + PII Redaction" },
      { color: "gold", text: "Watchlist & Alerts" },
      { color: "gold", text: "Public Safe Share Page" },
      { color: "gold", text: "Analytics Dashboard" },
      { color: "gold", text: "API / Webhook for partners" },
    ],
    roadmap: "แผนงานตามไตรมาส",
    status: "สถานะ",
    goals: "Goals",
    deliverables: "Deliverables",
  } as const;

  const items: RoadmapItem[] = useMemo(
    () => [
      {
        id: "built",
        quarter: "Built (ปัจจุบัน)",
        title: "สิ่งที่พัฒนาไปแล้ว",
        status: "done",
        icon: <CheckCircleOutlined />,
        tags: ["done", "foundation"],
        goals: ["มีระบบพื้นฐานครบ: สมาชิก/รับเรื่อง/แชท/อีเมล"],
        deliverables: ["ระบบสมาชิก", "ระบบรับเรื่องร้องทุกข์", "ระบบสนทนาแชท", "ระบบอีเมลแจ้งเตือน"],
      },
      {
        id: "q1",
        quarter: "Q1 2026",
        title: "Evidence Pack v1 + Workflow เคส",
        status: "in_progress",
        icon: <SafetyCertificateOutlined />,
        tags: ["core", "evidence", "workflow"],
        goals: ["ทำให้แต่ละเคสมีโครงสร้างชัดเจน พร้อมใช้เป็นหลักฐาน", "เพิ่มสถานะเคสและไทม์ไลน์เหตุการณ์"],
        deliverables: [
          "สถานะเคส (Draft/Submitted/Verified/Escalated/Closed)",
          "แนบหลักฐาน (รูป/ไฟล์/ลิงก์) + บันทึกเวลา",
          "Export PDF เบื้องต้น (สรุปเหตุการณ์ + ข้อมูลสำคัญ)",
        ],
      },
      {
        id: "q2",
        quarter: "Q2 2026",
        title: "Moderation + Anti-spam + Duplicate Detection",
        status: "planned",
        icon: <TeamOutlined />,
        tags: ["moderation", "quality"],
        goals: ["ลดเรื่องซ้ำ/สแปม", "เพิ่มความน่าเชื่อถือข้อมูลและผู้รายงาน"],
        deliverables: [
          "Admin queue ตรวจเคส + กฎ redact ข้อมูลส่วนบุคคล (PII)",
          "ตรวจความซ้ำ (เบอร์/บัญชี/URL/ข้อความคล้ายกัน)",
          "คะแนนความน่าเชื่อถือ (reporter trust / case confidence)",
        ],
      },
      {
        id: "q3",
        quarter: "Q3 2026",
        title: "Public Share Page + Watchlist & Alerts",
        status: "planned",
        icon: <ShareAltOutlined />,
        tags: ["public", "alerts"],
        goals: ["แชร์เคสได้แบบปลอดภัย ไม่เปิดข้อมูลส่วนบุคคล", "ให้ผู้ใช้ติดตาม keyword/เบอร์ได้"],
        deliverables: ["หน้า Public summary (redacted) + share link", "Watchlist + แจ้งเตือนอีเมล", "Search UX ดีขึ้น (filter/sort)"],
      },

      // ✅ เปลี่ยน Q4 2026 เป็น "เสร็จแล้ว" ตามที่ขอ
      {
        id: "q4",
        quarter: "Q4 2026",
        title: "Social Automation (Facebook, X) + Templates (พัฒนาเสร็จแล้ว)",
        status: "done",
        icon: <RocketOutlined />,
        tags: ["social", "automation", "done"],
        goals: ["ช่วยกระจายเคสที่ผ่านการตรวจแล้ว", "โพสต์แบบมี template และไม่เสี่ยงละเมิด PII"],
        deliverables: [
          "Auto post เฉพาะเคส Verified/Approved",
          "Template post หลายแบบ (สั้น/ยาว/แนบลิงก์)",
          "Log การโพสต์ + retry + rate limit",
          "เก็บ permalink_url + published_at เพื่อให้เว็บกดไปดูโพสต์ต้นทางได้",
        ],
      },

      {
        id: "q1_2027",
        quarter: "Q1 2027",
        title: "Analytics Dashboard + API/Webhook",
        status: "planned",
        icon: <BarChartOutlined />,
        tags: ["analytics", "api"],
        goals: ["เห็นภาพรวมแนวโน้มการหลอกลวง", "เปิดให้ partner ใช้งานข้อมูลแบบ read-only"],
        deliverables: ["Dashboard: ช่องทาง/พื้นที่/มูลค่า/keyword", "Export dataset แบบ anonymized", "API read-only + webhook events"],
      },
    ],
    []
  );

  const doneCount = items.filter((i) => i.status === "done").length;
  const inProgressCount = items.filter((i) => i.status === "in_progress").length;
  const plannedCount = items.filter((i) => i.status === "planned").length;

  const progress =
    Math.round(
      (items.reduce((sum, i) => sum + (i.status === "done" ? 100 : i.status === "in_progress" ? 50 : 0), 0) /
        (items.length * 100)) *
        100
    ) || 0;

  const timelineItems: TimelineProps["items"] = items.map((it) => ({
    dot: it.icon || statusIcon(it.status),
    color: statusColor(it.status) as any,
    children: (
      <div style={{ paddingBottom: 6 }}>
        <Row gutter={[12, 6]} align="middle" justify="space-between">
          <Col>
            <Space direction="vertical" size={0}>
              <Text type="secondary">{it.quarter}</Text>
              <Text strong style={{ fontSize: 15 }}>
                {it.title}
              </Text>
            </Space>
          </Col>
          <Col>
            <Tag color={statusColor(it.status)} icon={statusIcon(it.status)}>
              {labels.status}:{" "}
              {it.status === "done" ? labels.done : it.status === "in_progress" ? labels.inProgress : labels.planned}
            </Tag>
          </Col>
        </Row>

        <Row gutter={[12, 12]} style={{ marginTop: 10 }}>
          <Col xs={24} md={12}>
            <Text strong>{labels.goals}</Text>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {it.goals.map((g) => (
                <li key={g}>
                  <Text>{g}</Text>
                </li>
              ))}
            </ul>
          </Col>
          <Col xs={24} md={12}>
            <Text strong>{labels.deliverables}</Text>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {it.deliverables.map((d) => (
                <li key={d}>
                  <Text>{d}</Text>
                </li>
              ))}
            </ul>
          </Col>
        </Row>

        {it.tags?.length ? (
          <div style={{ marginTop: 6 }}>
            <Space wrap>
              {it.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Space>
          </div>
        ) : null}

        <Divider style={{ margin: "12px 0 0" }} />
      </div>
    ),
  }));

  return (
    <div style={{ width: "100%", minHeight: 520, padding: 16 }}>
      <Card
        bordered={false}
        style={{
          borderRadius: 14,
          boxShadow: "0 1px 10px rgba(0,0,0,0.06)",
          overflow: "hidden",
          height: "100%",
        }}
        bodyStyle={{ padding: 16 }}
      >
        <Row align="middle" justify="space-between" style={{ marginBottom: 8 }}>
          <Col>
            <Space direction="vertical" size={0}>
              <Title level={4} style={{ margin: 0 }}>
                {labels.pageTitle}
              </Title>
              <Text type="secondary">{labels.subtitle}</Text>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Tag color="green">
                {labels.done}: {doneCount}
              </Tag>
              <Tag color="blue">
                {labels.inProgress}: {inProgressCount}
              </Tag>
              <Tag>
                {labels.planned}: {plannedCount}
              </Tag>
            </Space>
          </Col>
        </Row>

        <Divider style={{ margin: "12px 0" }} />

        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Card size="small" title={labels.progressLabel} bordered>
              <Progress percent={progress} />
            </Card>

            <Card size="small" title={labels.keyObjectives} bordered style={{ marginTop: 12 }}>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {labels.objectives.map((p) => (
                  <li key={p}>
                    <Text>{p}</Text>
                  </li>
                ))}
              </ul>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card size="small" title={labels.notes} bordered extra={<Tag icon={<AlertOutlined />}>{labels.recommendTag}</Tag>}>
              <Paragraph style={{ marginBottom: 0 }}>{labels.notesText}</Paragraph>
              <Divider style={{ margin: "12px 0" }} />
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Space>
                  <FileTextOutlined />
                  <Text>{labels.tip1}</Text>
                </Space>
                <Space>
                  <SearchOutlined />
                  <Text>{labels.tip2}</Text>
                </Space>
              </Space>
            </Card>
          </Col>
        </Row>

        <Divider style={{ margin: "12px 0" }} />

        <Card size="small" title={labels.suggestedAdd} bordered style={{ marginBottom: 12 }}>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Space direction="vertical" size={6}>
                {labels.suggest.slice(0, 4).map((s) => (
                  <Badge key={s.text} color={s.color as any} text={s.text} />
                ))}
              </Space>
            </Col>
            <Col xs={24} md={12}>
              <Space direction="vertical" size={6}>
                {labels.suggest.slice(4).map((s) => (
                  <Badge key={s.text} color={s.color as any} text={s.text} />
                ))}
              </Space>
            </Col>
          </Row>
        </Card>

        <Card size="small" title={labels.roadmap} bordered>
          <Timeline items={timelineItems} />
        </Card>
      </Card>
    </div>
  );
}
