'use client';
import React from 'react';
import Link from 'next/link';
import { Space, Button, Badge, Typography, Layout } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  FileImageOutlined,
  DatabaseOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Title } = Typography;
const { Header } = Layout;

export default function AdminHeader() {
  const quick = [
    { text: 'Users', icon: <UserOutlined />, href: '/admin/users', badge: 3 },
    { text: 'Posts', icon: <FileTextOutlined />, href: '/admin/posts', badge: 2 },
    { text: 'Files', icon: <FileImageOutlined />, href: '/admin/files', badge: 5 },
    { text: 'Logs', icon: <DatabaseOutlined />, href: '/admin/logs', badge: 1 },
  ];

  const router = useRouter();
  async function logout() {
    await fetch('/admin/api/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  return (
    <Header
      style={{
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      {/* Left */}
      <Title level={3} style={{ margin: 0 }}>
        <Link href="/admin" style={{  }}>
          Admin Dashboard
        </Link>
      </Title>

      {/* Center */}
      <Space size="middle" wrap>
        {quick.map((q) => (
          <Badge key={q.text} count={q.badge} overflowCount={99} offset={[4, -2]}>
            <Link href={q.href}>
              <Button
                icon={q.icon}
                style={{
                  background: '#f5f5f5',
                  border: 'none',
                  boxShadow: 'none',
                }}
              >
                {q.text}
              </Button>
            </Link>
          </Badge>
        ))}
        {/* Right */}
        <Button
          icon={<LogoutOutlined />}
          onClick={logout}
          danger
          type="primary"
          style={{ minWidth: 100 }}
        >
          Logout
        </Button>
      </Space>

      
    </Header>
  );
}
