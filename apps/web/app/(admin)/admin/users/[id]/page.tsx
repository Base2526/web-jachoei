'use client';
import { ApolloClient, InMemoryCache, HttpLink, ApolloProvider, gql, useQuery, useMutation } from "@apollo/client";
import { Card, Form, Input, Select, Button, Space, message } from "antd";
import { useMemo } from "react";

const Q = gql`query($id:ID!){ user(id:$id){ id name email phone avatar role } }`;
const M_UPSERT = gql`
mutation($id:ID!, $data:UserInput!){
  upsertUser(id:$id, data:$data){ id }
}
`;

// SHA-256 (hex)
async function sha256Hex(input: string) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function FormEdit({ id }: { id: string }) {
  const [form] = Form.useForm();
  const { data } = useQuery(Q, { variables: { id } });
  const [save, { loading }] = useMutation(M_UPSERT, {
    onCompleted: () => message.success('Saved'),
  });

  if (!data?.user) return <div>Loading...</div>;

  const u = data.user;

  return (
    <Card title={`Edit User: ${u.name}`} style={{ maxWidth: 640 }}>
      <Form
        key={u.id}                 // ✅ บังคับ remount เมื่อ id เปลี่ยน
        form={form}
        layout="vertical"
        initialValues={{           // ✅ ตั้งค่าจาก data โดยตรง
          name:   u.name   ?? '',
          email:  u.email  ?? '',
          phone:  u.phone  ?? '',
          avatar: u.avatar ?? '',
          role:   u.role   ?? 'Subscriber',
        }}
        onFinish={async (v) => {
          const dataToSend: any = {
            name: v.name,
            // email immutable ในตัวอย่างนี้
            phone: v.phone || null,
            avatar: v.avatar || null,
            role: v.role,
          };

          const pwd: string = (v.password || '').trim();
          const pwd2: string = (v.confirmPassword || '').trim();
          if (pwd || pwd2) {
            if (!pwd) { message.error('Password is empty'); return; }
            if (pwd.length < 8) { message.error('Password must be at least 8 characters'); return; }
            if (pwd !== pwd2) { message.error('Confirm password not match'); return; }
            dataToSend.passwordHash = await sha256Hex(pwd);
          }

          await save({ variables: { id, data: dataToSend } });
        }}
      >
        <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input disabled /></Form.Item>
        <Form.Item name="phone" label="Phone"><Input /></Form.Item>
        <Form.Item name="avatar" label="Avatar URL"><Input /></Form.Item>
        <Form.Item name="role" label="Role" rules={[{ required: true }]}>
          <Select options={[
            { value: 'Subscriber', label: 'Subscriber' },
            { value: 'Author', label: 'Author' },
            { value: 'Administrator', label: 'Administrator' },
          ]} />
        </Form.Item>

        {/* NEW: password + confirm-password (optional) */}
        <Form.Item
          name="password"
          label="New Password"
          tooltip="Leave empty to keep current password"
          rules={[{ min: 8, message: 'At least 8 characters' }]}
          hasFeedback
        >
          <Input.Password placeholder="(optional) new password" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirm New Password"
          dependencies={['password']}
          hasFeedback
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                const pwd = getFieldValue('password');
                if (!pwd && !value) return Promise.resolve(); // both empty = ok
                if (pwd === value) return Promise.resolve();
                return Promise.reject(new Error('Confirm password not match'));
              },
            }),
          ]}
        >
          <Input.Password placeholder="(optional) confirm password" />
        </Form.Item>

        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>Save</Button>
          <Button href="/admin/users">Back</Button>
        </Space>
      </Form>
    </Card>
  );
}

export default function Page({ params }: { params: { id: string } }) {
  // ใช้ client เดิมของคุณก็ได้; ย่อส่วนเพื่อโฟกัสที่ฟอร์ม
  return <FormEdit id={params.id} />;
}
