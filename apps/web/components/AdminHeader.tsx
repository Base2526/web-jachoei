'use client';
import Link from 'next/link';
import { Space, Button, Badge, Typography, Layout, message } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  FileImageOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  SnippetsOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/useSession'

const { Title } = Typography;
const { Header } = Layout;

export default function AdminHeader() {
  const quick = [
    { text: 'Posts', icon: <FileTextOutlined />, href: '/admin/posts', badge: 2 },
    { text: 'Users', icon: <UserOutlined />, href: '/admin/users', badge: 3 },
    { text: 'Files', icon: <FileImageOutlined />, href: '/admin/files', badge: 5 },
    { text: 'Social Queue', icon: <DatabaseOutlined />, href: '/admin/queue', badge: 0 },
    { text: 'Logs', icon: <DatabaseOutlined />, href: '/admin/logs', badge: 1 },
    { text: 'Fake', icon: <SnippetsOutlined />, href: '/admin/dev/fake', badge: 0 },
    { text: 'ENV', icon: <EnvironmentOutlined />, href: '/admin/env', badge: 0 },
  ];
  const { admin:adminSession, isAuthenticated, loading, refreshSession } = useSession()
  async function onLogout() {
    const res = await fetch("/api/auth/logout-admin", { method: "POST" });

    console.log("[onLogout-Admin] res :", res.ok);
    refreshSession();
    if (res.ok) {
      message.success("Logged out");
      refreshSession(); // รีโหลดสถานะ session
      window.location.href = "/admin/login";
    } else {
      message.error("Logout failed");
    }
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
      }}>
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
          onClick={onLogout}
          danger
          type="primary"
          style={{ minWidth: 100 }}>
          Logout
        </Button>
      </Space>
    </Header>
  );
}
