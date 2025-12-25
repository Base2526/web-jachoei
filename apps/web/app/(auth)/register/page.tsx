"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { gql, useMutation } from "@apollo/client";
import {
  Card,
  Form,
  Input,
  Button,
  Checkbox,
  Typography,
  message,
  Progress,
  Space,
} from "antd";

const { Title, Text } = Typography;

const REGISTER_MUTATION = gql`
  mutation RegisterUser($input: RegisterInput!) {
    registerUser(input: $input)
  }
`;

// ---- password strength (เดิม) ----
function calcStrength(pw: string) {
  let score = 0;
  if (!pw) return 0;
  if (pw.length >= 8) score += 25;
  if (/[A-Z]/.test(pw)) score += 20;
  if (/[a-z]/.test(pw)) score += 20;
  if (/\d/.test(pw)) score += 20;
  if (/[^A-Za-z0-9]/.test(pw)) score += 15;
  return Math.min(score, 100);
}

// ---- username rules ----
// แนวทางทั่วไป:
// - 3-20 ตัวอักษร
// - ใช้ a-z 0-9 และ _ . -
// - ห้ามมีช่องว่าง
// - ห้ามขึ้นต้น/ลงท้ายด้วย _ . -
// - ห้ามมี _ . - ติดกันหลายตัว
// - แนะนำ normalize เป็น lowercase เพื่อใช้เป็น login/unique key (กัน case collision)
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;

function normalizeUsername(input: string) {
  return (input || "").trim().toLowerCase();
}

function validateUsername(usernameRaw: string): { ok: boolean; reason?: string } {
  const u = (usernameRaw || "").trim();

  if (!u) return { ok: false, reason: "กรุณากรอก Username" };

  if (/\s/.test(u)) return { ok: false, reason: "Username ห้ามมีช่องว่าง" };

  if (u.length < USERNAME_MIN)
    return { ok: false, reason: `Username ต้องยาวอย่างน้อย ${USERNAME_MIN} ตัวอักษร` };

  if (u.length > USERNAME_MAX)
    return { ok: false, reason: `Username ต้องยาวไม่เกิน ${USERNAME_MAX} ตัวอักษร` };

  // อนุญาตเฉพาะ a-z A-Z 0-9 _ . -
  if (!/^[A-Za-z0-9._-]+$/.test(u))
    return { ok: false, reason: "ใช้ได้เฉพาะ a-z, 0-9 และ _ . -" };

  // ห้ามขึ้นต้น/ลงท้ายด้วยสัญลักษณ์
  if (/^[._-]/.test(u) || /[._-]$/.test(u))
    return { ok: false, reason: "ห้ามขึ้นต้นหรือจบด้วย _ . -" };

  // ห้ามมีสัญลักษณ์ติดกัน เช่น ".." "__" "--" "._" "-." ฯลฯ
  if (/[._-]{2,}/.test(u))
    return { ok: false, reason: "ห้ามมี _ . - ติดกันหลายตัว" };

  // (optional) กัน username ที่ดูเหมือนอีเมล
  // if (u.includes("@")) return { ok: false, reason: "Username ห้ามมี @" };

  return { ok: true };
}

export default function RegisterPage() {
  const router = useRouter();
  const [form] = Form.useForm();

  const [password, setPassword] = useState("");
  const strength = useMemo(() => calcStrength(password), [password]);

  const [mutate, { loading }] = useMutation(REGISTER_MUTATION);

  async function onSubmit(values: any) {
    try {
      // normalize username เป็น lowercase ก่อนส่ง
      const username = normalizeUsername(values.username);

      const payload = {
        username, // ✅ ใช้เป็น login
        email: values.email.trim(),
        phone: values.phone?.trim() || null,
        password: values.password,
        agree: values.agree === true,
      };

      const res = await mutate({ variables: { input: payload } });
      if (res.data?.registerUser) {
        message.success("สมัครสมาชิกสำเร็จ");
        // router.replace("/login");
        window.location.href = "/login";
      } else {
        message.error("สมัครสมาชิกไม่สำเร็จ");
      }
    } catch (e: any) {
      message.error(e?.message || "เกิดข้อผิดพลาด");
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 16px" }}>
      <Card style={{ width: 520, maxWidth: "100%" }}>
        <Title level={3} style={{ marginBottom: 8 }}>
          Create your account
        </Title>
        <Text type="secondary">สมัครสมาชิกเพื่อเริ่มต้นใช้งานระบบ</Text>

        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 24 }}
          onFinish={onSubmit}
          initialValues={{ agree: false }}
        >
          {/* ✅ Username */}
          <Form.Item
            name="username"
            label="Username (for login)"
            normalize={(v) => normalizeUsername(v)}
            rules={[
              { required: true, message: "กรุณากรอก Username" },
              () => ({
                validator(_, v) {
                  const r = validateUsername(String(v || ""));
                  if (r.ok) return Promise.resolve();
                  return Promise.reject(new Error(r.reason || "Username ไม่ถูกต้อง"));
                },
              }),
            ]}
            extra={
              <Text type="secondary">
                ใช้สำหรับ Login • 3–20 ตัว • ใช้ได้เฉพาะ a-z, 0-9 และ _ . - • ห้ามมีช่องว่าง
              </Text>
            }
          >
            <Input placeholder="เช่น somchai.jaidee" autoCapitalize="none" autoCorrect="off" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "กรุณากรอกอีเมล" },
              { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" },
            ]}
          >
            <Input placeholder="you@example.com" autoCapitalize="none" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone (optional)"
            rules={[{ pattern: /^[0-9+\-\s()]*$/, message: "ตัวเลข/เครื่องหมายเท่านั้น" }]}
          >
            <Input placeholder="เช่น 0801234567" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: "กรุณากรอกรหัสผ่าน" },
              { min: 8, message: "ความยาวอย่างน้อย 8 ตัวอักษร" },
            ]}
          >
            <Input.Password
              placeholder="อย่างน้อย 8 ตัวอักษร"
              onChange={(e) => setPassword(e.target.value)}
            />
          </Form.Item>

          <div style={{ marginTop: -8, marginBottom: 16 }}>
            <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
              Password strength
            </Text>
            <Progress
              percent={strength}
              showInfo={false}
              strokeColor={strength >= 80 ? "#52c41a" : strength >= 50 ? "#faad14" : "#ff4d4f"}
            />
          </div>

          <Form.Item
            name="confirm"
            label="Confirm password"
            dependencies={["password"]}
            rules={[
              { required: true, message: "กรุณายืนยันรหัสผ่าน" },
              ({ getFieldValue }) => ({
                validator(_, v) {
                  if (!v || getFieldValue("password") === v) return Promise.resolve();
                  return Promise.reject(new Error("รหัสผ่านไม่ตรงกัน"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="พิมพ์รหัสผ่านซ้ำอีกครั้ง" />
          </Form.Item>

          <Form.Item
            name="agree"
            valuePropName="checked"
            rules={[
              {
                validator: (_, v) =>
                  v ? Promise.resolve() : Promise.reject(new Error("กรุณายอมรับเงื่อนไขการใช้งาน")),
              },
            ]}
          >
            <Checkbox>
              ฉันยอมรับ{" "}
              <a href="/terms" target="_blank" rel="noreferrer">
                ข้อตกลงการใช้งาน
              </a>{" "}
              และ{" "}
              <a href="/privacy" target="_blank" rel="noreferrer">
                นโยบายความเป็นส่วนตัว
              </a>
            </Checkbox>
          </Form.Item>

          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Text type="secondary">
              มีบัญชีแล้ว? <a href="/login">เข้าสู่ระบบ</a>
            </Text>
            <Button type="primary" htmlType="submit" loading={loading}>
              สมัครสมาชิก
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
