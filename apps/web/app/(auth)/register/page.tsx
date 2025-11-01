'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { gql, useMutation } from '@apollo/client';
import {
  Card, Form, Input, Button, Checkbox, Typography, message, Progress, Space
} from 'antd';

const { Title, Text } = Typography;

const REGISTER_MUTATION = gql`
  mutation RegisterUser($input: RegisterInput!) {
    registerUser(input: $input)
  }
`;

// ฟังก์ชันคำนวณความแข็งแรงของรหัสผ่านแบบง่าย ๆ
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

export default function RegisterPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [password, setPassword] = useState('');
  const strength = useMemo(() => calcStrength(password), [password]);
  const [mutate, { loading }] = useMutation(REGISTER_MUTATION);

  async function onSubmit(values: any) {
    try {
      const payload = {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || null,
        password: values.password,       // ให้ backend เป็นคน hash + set cookie
        agree: values.agree === true,    // เผื่อ backend ตรวจด้วย
        // inviteCode: values.inviteCode || null, // ถ้ามี
      };

      const res = await mutate({ variables: { input: payload } });
      if (res.data?.registerUser) {
        message.success('สมัครสมาชิกสำเร็จ');
        // สมมติ backend set-cookie `user_token` แล้ว
        router.replace('/'); // หรือ /account /dashboard ตาม flow ของคุณ
      } else {
        message.error('สมัครสมาชิกไม่สำเร็จ');
      }
    } catch (e: any) {
      message.error(e?.message || 'เกิดข้อผิดพลาด');
    }
  }

  return (
    <div style={{ display:'flex', justifyContent:'center', padding: '40px 16px' }}>
      <Card style={{ width: 520, maxWidth: '100%' }}>
        <Title level={3} style={{ marginBottom: 8 }}>Create your account</Title>
        <Text type="secondary">สมัครสมาชิกเพื่อเริ่มต้นใช้งานระบบ</Text>

        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 24 }}
          onFinish={onSubmit}
          initialValues={{ agree: false }}
        >
          <Form.Item
            name="name"
            label="Full name"
            rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}
          >
            <Input placeholder="เช่น Somchai Jaidee" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'กรุณากรอกอีเมล' },
              { type: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง' },
            ]}
          >
            <Input placeholder="you@example.com" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone (optional)"
            rules={[
              { pattern: /^[0-9+\-\s()]*$/, message: 'ตัวเลข/เครื่องหมายเท่านั้น' },
            ]}
          >
            <Input placeholder="เช่น 0801234567" />
          </Form.Item>

          {/* <Form.Item name="inviteCode" label="Invite code (optional)">
            <Input placeholder="ถ้ามี" />
          </Form.Item> */}

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'กรุณากรอกรหัสผ่าน' },
              { min: 8, message: 'ความยาวอย่างน้อย 8 ตัวอักษร' },
            ]}
          >
            <Input.Password
              placeholder="อย่างน้อย 8 ตัวอักษร"
              onChange={(e) => setPassword(e.target.value)}
            />
          </Form.Item>

          <div style={{ marginTop: -8, marginBottom: 16 }}>
            <Text type="secondary" style={{ display:'block', marginBottom: 4 }}>
              Password strength
            </Text>
            <Progress
              percent={strength}
              showInfo={false}
              strokeColor={strength >= 80 ? '#52c41a' : strength >= 50 ? '#faad14' : '#ff4d4f'}
            />
          </div>

          <Form.Item
            name="confirm"
            label="Confirm password"
            dependencies={['password']}
            rules={[
              { required: true, message: 'กรุณายืนยันรหัสผ่าน' },
              ({ getFieldValue }) => ({
                validator(_, v) {
                  if (!v || getFieldValue('password') === v) return Promise.resolve();
                  return Promise.reject(new Error('รหัสผ่านไม่ตรงกัน'));
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
                validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('กรุณายอมรับเงื่อนไขการใช้งาน'))),
              },
            ]}
          >
            <Checkbox>
              ฉันยอมรับ <a href="/terms" target="_blank">ข้อตกลงการใช้งาน</a> และ <a href="/privacy" target="_blank">นโยบายความเป็นส่วนตัว</a>
            </Checkbox>
          </Form.Item>

          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
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
