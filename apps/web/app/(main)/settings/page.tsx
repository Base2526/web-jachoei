'use client';
import React, { useState } from 'react';
import {
  Layout,
  Menu,
  Card,
  Form,
  Input,
  Button,
  Switch,
  Upload,
  Avatar,
  Select,
  message,
  Space,
  Typography,
  Divider,
} from 'antd';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  UserOutlined,
  LockOutlined,
  BellOutlined,
  SettingOutlined,
  CloudUploadOutlined,
  LogoutOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

type MenuKey = 'profile' | 'security' | 'notifications' | 'account';

export default function SettingsPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState<MenuKey>('profile');
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  const items = [
    { key: 'profile', icon: <UserOutlined />, label: 'Profile' },
    { key: 'account', icon: <SettingOutlined />, label: 'Account' },
    { key: 'security', icon: <LockOutlined />, label: 'Security' },
    { key: 'notifications', icon: <BellOutlined />, label: 'Notifications' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sider Menu */}
      <Sider
        width={240}
        collapsedWidth={0}
        collapsible
        collapsed={collapsed}
        trigger={null}
        breakpoint="lg"
        style={{
          background: 'transparent',
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <Card bodyStyle={{ padding: 0 }}>
          <Menu
            mode="inline"
            selectedKeys={[active]}
            items={items}
            onClick={(e) => setActive(e.key as MenuKey)}
          />
        </Card>
      </Sider>

      <Layout>
        {/* Header with Hamburger */}
        <Header
          style={{
            background: 'white',
            borderBottom: '1px solid #f0f0f0',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <Typography.Title level={4} style={{ margin: 0 }}>
              Settings
            </Typography.Title>
          </Space>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={() => {
              localStorage.removeItem('token');
              document.cookie = 'token=; Max-Age=0; path=/;';
              message.success('Signed out');
              window.location.href = '/login';
            }}
          >
            Logout
          </Button>
        </Header>

        <Content style={{ padding: 24, background: '#fff' }}>
          {active === 'profile' && (
            <Card title="Profile Settings" style={{ maxWidth: 720 }}>
              <Space align="start" size="large">
                <Avatar size={96} src={avatarUrl} icon={<UserOutlined />} />
                <div>
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      const reader = new FileReader();
                      reader.onload = () => setAvatarUrl(String(reader.result));
                      reader.readAsDataURL(file);
                      message.success('Preview updated');
                      return false;
                    }}
                  >
                    <Button icon={<CloudUploadOutlined />}>Upload Avatar</Button>
                  </Upload>
                </div>
              </Space>

              <Divider />

              <Form
                layout="vertical"
                initialValues={{
                  name: 'Alice Example',
                  phone: '080-000-0001',
                  language: 'en',
                }}
                onFinish={() => message.success('Profile saved')}
              >
                <Form.Item name="name" label="Display name" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="phone" label="Phone">
                  <Input />
                </Form.Item>
                <Form.Item name="language" label="Language">
                  <Select
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'th', label: 'ไทย' },
                    ]}
                  />
                </Form.Item>
                <Button type="primary" htmlType="submit">
                  Save changes
                </Button>
              </Form>
            </Card>
          )}

          {active === 'account' && (
            <Card title="Account" style={{ maxWidth: 720 }}>
              <Form
                layout="vertical"
                initialValues={{ email: 'alice@example.com', username: 'alice' }}
                onFinish={() => message.success('Account updated')}
              >
                <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Button type="primary" htmlType="submit">
                  Update
                </Button>
              </Form>
            </Card>
          )}

          {active === 'security' && (
            <Card title="Security" style={{ maxWidth: 720 }}>
              <Form layout="vertical" onFinish={() => message.success('Password changed')}>
                <Form.Item name="current" label="Current password" rules={[{ required: true }]}>
                  <Input.Password />
                </Form.Item>
                <Form.Item name="new" label="New password" rules={[{ required: true, min: 8 }]}>
                  <Input.Password />
                </Form.Item>
                <Form.Item
                  name="confirm"
                  label="Confirm new password"
                  dependencies={['new']}
                  rules={[
                    { required: true },
                    ({ getFieldValue }) => ({
                      validator(_, v) {
                        if (!v || getFieldValue('new') === v) return Promise.resolve();
                        return Promise.reject(new Error('Passwords do not match'));
                      },
                    }),
                  ]}
                >
                  <Input.Password />
                </Form.Item>
                <Button type="primary" htmlType="submit">
                  Change Password
                </Button>
              </Form>
            </Card>
          )}

          {active === 'notifications' && (
            <Card title="Notifications" style={{ maxWidth: 720 }}>
              <Form
                layout="vertical"
                initialValues={{ email: true, push: true }}
                onFinish={() => message.success('Notifications updated')}
              >
                <Form.Item label="Email Notifications" name="email" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item label="Push Notifications" name="push" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Button type="primary" htmlType="submit">
                  Save
                </Button>
              </Form>
            </Card>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
