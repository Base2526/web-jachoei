'use client';
import React from 'react';
import { Card, Form, Input, Button, Space, message, Typography, Divider } from 'antd';
import { gql, useMutation } from '@apollo/client';

const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    loginUser(input: $input) {
      ok
      message
      token
      user { id name email role }
    }
  }
`;

export default function Page() {
  const [form] = Form.useForm();
  const [login, { loading }] = useMutation(LOGIN);

  const onFinish = async (values: { identifier: string; password: string }) => {
    const { identifier, password } = values;

    // เดาว่าเป็น email ถ้ามี '@' ไม่งั้นใช้ username
    const input = identifier.includes('@')
      ? { email: identifier.trim(), password }
      : { username: identifier.trim(), password };

    try {
      const { data } = await login({ variables: { input } });
      const res = data?.loginUser
      console.log("[login]", res);

      if (!res?.ok) {
        message.error(res?.message || 'Invalid credentials');
        return;
      }

      // เก็บ token แบบง่าย (แนะนำทำ httpOnly cookie ที่ฝั่ง server ในงานจริง)
      if (res.token) {
        localStorage.setItem("user", JSON.stringify(res.user));
        localStorage.setItem('token', res.token);
        document.cookie = `token=${res.token}; path=/; samesite=lax`;
      }

      message.success(`Welcome ${res.user?.name || ''}!`);
      // TODO: redirect ถ้าต้องการ เช่น window.location.href = '/'

      // window.location.href = "/";
    } catch (err: any) {
      message.error(err?.message || 'Login failed');
    }
  };

  return (
    <Card title="Sign in" style={{ maxWidth: 420, margin: '0 auto' }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ identifier: '', password: '' }}
      >
        <Form.Item
          label="Username or Email"
          name="identifier"
          rules={[{ required: true, message: 'Please enter your username or email' }]}
        >
          <Input placeholder="e.g. bob or bob@example.com" autoComplete="username" />
        </Form.Item>

        <Form.Item
          label="Password"
          name="password"
          rules={[{ required: true, message: 'Please enter your password' }]}
        >
          <Input.Password placeholder="Your password" autoComplete="current-password" />
        </Form.Item>

        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
          >
            Login
          </Button>

          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button type="link" href="/register">Register</Button>
            <Button type="link" href="/forgot-password">Forgot password?</Button>
          </Space>
        </Space>
      </Form>

      <Divider />

      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        Tip: บน server คุณสามารถตั้งค่าให้เซ็ต <code>httpOnly cookie</code> ตอน login
        เพื่อความปลอดภัยมากขึ้น และใช้ token จาก cookie ฝั่ง API/SSR ได้
      </Typography.Paragraph>
    </Card>
  );
}
