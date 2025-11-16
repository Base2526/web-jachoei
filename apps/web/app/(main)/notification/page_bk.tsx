'use client';

import { useState } from 'react';
import { List, Tabs, Badge, Button, Typography, Tag, Input, Dropdown, Menu, Space } from 'antd';
import { BellOutlined, MessageOutlined, FileTextOutlined, MoreOutlined, SettingOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Search } = Input;

type NotificationItem = {
  id: string;
  type: string;        // CHAT_CREATED, POST_COMMENT, ...
  entity_type: string; // 'chat' | 'post' | 'system'
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;  // ISO string
  tagLabel: string;    // สำหรับแสดงใน Tag เช่น 'Chat', 'Post'
  timeLabel: string;   // เช่น '5m ago'
  groupLabel: string;  // Today | Yesterday | Earlier
};

const mockData: NotificationItem[] = [
  {
    id: '1',
    type: 'CHAT_CREATED',
    entity_type: 'chat',
    title: 'New chat with Jarvis',
    message: 'Jarvis started a chat with you.',
    is_read: false,
    created_at: new Date().toISOString(),
    tagLabel: 'Chat',
    timeLabel: '2m ago',
    groupLabel: 'Today',
  },
  {
    id: '2',
    type: 'POST_COMMENT',
    entity_type: 'post',
    title: 'New comment on your post',
    message: 'John: "I have a question about..."',
    is_read: true,
    created_at: new Date().toISOString(),
    tagLabel: 'Post',
    timeLabel: '1h ago',
    groupLabel: 'Today',
  },
];

function getIcon(entity_type: string) {
  switch (entity_type) {
    case 'chat':
      return <MessageOutlined />;
    case 'post':
      return <FileTextOutlined />;
    default:
      return <BellOutlined />;
  }
}

export default function NotificationPage() {
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [items, setItems] = useState<NotificationItem[]>(mockData);

  const unreadCount = items.filter((i) => !i.is_read).length;

  const filtered = items.filter((item) => {
    if (tab === 'unread' && item.is_read) return false;
    if (tab === 'chat' && item.entity_type !== 'chat') return false;
    if (tab === 'post' && item.entity_type !== 'post') return false;
    if (search && !`${item.title} ${item.message}`.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  // group by groupLabel
  const groups = filtered.reduce<Record<string, NotificationItem[]>>((acc, item) => {
    acc[item.groupLabel] = acc[item.groupLabel] || [];
    acc[item.groupLabel].push(item);
    return acc;
  }, {});

  const onMarkAllRead = () => {
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    // TODO: call mutation markAllNotificationsRead
  };

  const onClickItem = (item: NotificationItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i)),
    );
    // TODO: navigate to chat/post based on entity_type & entity_id
  };

  const menuForItem = (item: NotificationItem) => (
    <Menu
      items={[
        {
          key: 'read',
          label: item.is_read ? 'Mark as unread' : 'Mark as read',
          onClick: () => {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, is_read: !i.is_read } : i,
              ),
            );
          },
        },
        {
          key: 'delete',
          danger: true,
          label: 'Delete',
          onClick: () => {
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          },
        },
      ]}
    />
  );

  return (
    <div style={{ margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Title level={3} style={{ margin: 0 }}>
            Notifications
          </Title>
          {unreadCount > 0 && <Badge count={unreadCount} />}
        </Space>
        <Space>
          <Button type="link" icon={<SettingOutlined />}>
            Settings
          </Button>
          <Button onClick={onMarkAllRead} disabled={unreadCount === 0}>
            Mark all as read
          </Button>
        </Space>
      </Space>

      {/* Tabs + Search */}
      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        <Tabs activeKey={tab} onChange={setTab}>
          <TabPane tab="All" key="all" />
          <TabPane tab={`Unread (${unreadCount})`} key="unread" />
          <TabPane tab="Chat" key="chat" />
          <TabPane tab="Posts" key="post" />
        </Tabs>
        <Search
          placeholder="Search notifications..."
          allowClear
          onChange={(e) => setSearch(e.target.value)}
        />
      </Space>

      {/* List group by day */}
      {Object.keys(groups).length === 0 ? (
        <Text type="secondary">No notifications.</Text>
      ) : (
        Object.entries(groups).map(([groupLabel, groupItems]) => (
          <div key={groupLabel} style={{ marginBottom: 24 }}>
            <Text strong>{groupLabel}</Text>
            <List
              itemLayout="horizontal"
              dataSource={groupItems}
              renderItem={(item) => (
                <List.Item
                  onClick={() => onClickItem(item)}
                  style={{
                    cursor: 'pointer',
                    background: item.is_read ? 'transparent' : 'rgba(24,144,255,0.06)',
                    paddingLeft: 12,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                  actions={[
                    <Dropdown key="more" overlay={menuForItem(item)} trigger={['click']}>
                      <MoreOutlined onClick={(e) => e.stopPropagation()} />
                    </Dropdown>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <div style={{ position: 'relative' }}>
                        {getIcon(item.entity_type)}
                        {!item.is_read && (
                          <span
                            style={{
                              position: 'absolute',
                              top: -2,
                              right: -2,
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: '#1890ff',
                            }}
                          />
                        )}
                      </div>
                    }
                    title={
                      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontWeight: item.is_read ? 400 : 600 }}>
                          {item.title}
                        </span>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.timeLabel}
                        </Text>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Text type="secondary" ellipsis>
                          {item.message}
                        </Text>
                        <Tag>{item.tagLabel}</Tag>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        ))
      )}
    </div>
  );
}
