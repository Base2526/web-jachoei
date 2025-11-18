'use client';
import React from 'react';
import { gql, useQuery, useMutation } from "@apollo/client";
import {
  Card,
  Descriptions,
  Image,
  Divider,
  Table,
  Typography,
  Button,
  Space,
  Tooltip,
  Popconfirm,
  message,
  Row,
  Col,
} from 'antd';
import type { PostRecord } from './PostForm';
import Link from 'next/link';
import { MessageOutlined, DeleteOutlined, EditOutlined, CopyOutlined } from '@ant-design/icons';

import { useSessionCtx } from '@/lib/session-context';
import BookmarkButton from '@/components/BookmarkButton';
import { formatDate } from "@/lib/date";
import { CommentsSection } from '@/components/comments/CommentsSection'; // 👈 ปรับ path ให้ตรงโปรเจกต์

const { Text } = Typography;

type Props = {
  post: PostRecord | null;
  loading?: boolean;
  onDelete?: (id?: any) => void;
  deleting?: boolean;
  title?: string;

  onClone?: (id: string) => void;
  cloning?: boolean;
};

export default function PostView({
  post,
  loading,
  onDelete,
  deleting,
  title,
  onClone,
  cloning,
}: Props) {
  const { user } = useSessionCtx();

  if (!post) {
    return (
      <Card loading={loading} title={title ?? 'Post [x]'}>
        No data.
      </Card>
    );
  }

  const telNumbers = (post as any).tel_numbers || [];
  const sellerAccounts = (post as any).seller_accounts || [];

  return (
    <Card
      title={title ?? 'รายละเอียดโพสต์'}
      loading={loading}
      extra={
        <Space>
          {user?.id !== (post as any)?.author?.id && (
            <BookmarkButton
              postId={String((post as any).id)}
              defaultBookmarked={(post as any)?.is_bookmarked ?? false}
            />
          )}

          {user?.id !== (post as any)?.author?.id && (
            <Link href={`/chat?to=${(post as any)?.author.id}`} prefetch={false}>
              <Button
                type="text"
                size="small"
                icon={<MessageOutlined />}
                title={`Chat with`}
              />
            </Link>
          )}

          {user?.id === (post as any)?.author.id && (
            <>
              <Tooltip title="Clone">
                <Button
                  type="text"
                  size="small"
                  onClick={() => onClone?.((post as any)?.id)}
                  loading={cloning}
                  icon={<CopyOutlined />}
                />
              </Tooltip>
              <Tooltip title="Edit">
                <Link href={`/post/${(post as any)?.id}/edit`} prefetch={false}>
                  <Button type="text" size="small" icon={<EditOutlined />} />
                </Link>
              </Tooltip>

              <Popconfirm
                title="Confirm delete?"
                okText="Yes"
                cancelText="No"
                onConfirm={() => onDelete?.((post as any)?.id)}
              >
                <Tooltip title="Delete">
                  <Button
                    type="text"
                    size="small"
                    danger
                    loading={deleting}
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      }
    >
      {/* 🧱 Layout หลัก: ซ้าย = รายละเอียด, ขวา = Comments */}
      <Row gutter={24} align="top">
        {/* LEFT: รายละเอียดโพสต์ทั้งหมด */}
        <Col xs={24} md={14}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="สินค้า/บริการ ที่สั่งซื้อ">
              {(post as any).title || '-'}
            </Descriptions.Item>

            <Descriptions.Item label="รายละเอียดเพิ่มเติม">
              {(post as any).detail || '-'}
            </Descriptions.Item>

            <Descriptions.Item label="ชื่อ-นามสกุล คนขาย">
              {(post as any).first_last_name || '-'}
            </Descriptions.Item>

            <Descriptions.Item label="เลขบัตรประชาชน / พาสปอร์ต">
              <Typography.Text copyable>
                {(post as any).id_card}
              </Typography.Text>
            </Descriptions.Item>

            <Descriptions.Item label="ยอดโอน">
              {(post as any).transfer_amount
                ? Number((post as any).transfer_amount).toLocaleString(
                    'th-TH',
                    { minimumFractionDigits: 2 },
                  )
                : '-'}
            </Descriptions.Item>

            <Descriptions.Item label="วันโอนเงิน">
              {(post as any).transfer_date
                ? formatDate((post as any).transfer_date)
                : '-'}
            </Descriptions.Item>

            <Descriptions.Item label="เว็บประกาศขายของ">
              {(post as any).website || '-'}
            </Descriptions.Item>

            <Descriptions.Item label="จังหวัดของคนสร้างรายงาน">
              {(post as any).province_name ||
                (post as any).province_id ||
                '-'}
            </Descriptions.Item>
          </Descriptions>

          {/* เบอร์โทร/ไอดีไลน์ */}
          {telNumbers.length > 0 && (
            <>
              <Divider orientation="left">เบอร์โทรศัพท์ / ไอดีไลน์</Divider>
              <Table
                dataSource={telNumbers}
                pagination={false}
                rowKey={(r: any) => r.id}
                size="small"
                columns={[
                  {
                    title: 'ลำดับ',
                    render: (_: any, __: any, i: number) => i + 1,
                  },
                  {
                    title: 'เบอร์โทร / ไอดีไลน์',
                    dataIndex: 'tel',
                    render: (s: string) => (
                      <Typography.Text copyable>{s}</Typography.Text>
                    ),
                  },
                ]}
              />
            </>
          )}

          {/* บัญชีคนขาย */}
          {sellerAccounts.length > 0 && (
            <>
              <Divider orientation="left">บัญชีคนขาย</Divider>
              <Table
                dataSource={sellerAccounts}
                pagination={false}
                rowKey={(r: any) => r.id}
                size="small"
                columns={[
                  {
                    title: 'ลำดับ',
                    render: (_: any, __: any, i: number) => i + 1,
                  },
                  { title: 'ชื่อบัญชีคนขาย', dataIndex: 'bank_name' },
                  {
                    title: 'เลขที่บัญชี',
                    dataIndex: 'seller_account',
                    render: (s: string) => (
                      <Typography.Text copyable>{s}</Typography.Text>
                    ),
                  },
                ]}
              />
            </>
          )}

          {/* รูปภาพแนบ */}
          {(post.images || []).length > 0 && (
            <>
              <Divider orientation="left">ไฟล์แนบ / รูปภาพ</Divider>
              <div
                style={{
                  marginTop: 16,
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 12,
                }}
              >
                {(post.images || []).map((img) => (
                  <Image
                    key={String(img.id)}
                    src={img.url}
                    width={160}
                    height={160}
                    style={{ objectFit: 'cover' }}
                  />
                ))}
              </div>
            </>
          )}
        </Col>

        {/* RIGHT: Comments Section */}
        <Col xs={24} md={10}>
          <Divider orientation="left">ความคิดเห็น</Divider>
          <CommentsSection
            postId={String((post as any).id)}
            currentUserId={user?.id}
          />
        </Col>
      </Row>
    </Card>
  );
}
