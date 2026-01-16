'use client';

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
  Row,
  Col,
  Grid,
  Modal,
} from 'antd';
import Link from 'next/link';
import {
  MessageOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  FacebookFilled,
  ShareAltOutlined,
  LinkOutlined,
} from '@ant-design/icons';

import type { PostRecord } from './PostForm';
import { useSessionCtx } from '@/lib/session-context';
import BookmarkButton from '@/components/BookmarkButton';
import { formatDate } from '@/lib/date';
import { CommentsSection } from '@/components/comments/CommentsSection';

const { useBreakpoint } = Grid;

type Props = {
  post: PostRecord | null;
  loading?: boolean;
  onDelete?: (id?: any) => void;
  deleting?: boolean;
  title?: string;

  onClone?: (id: string) => void;
  cloning?: boolean;
};

/** =========================
 *  Share helpers
 *  ========================= */
type SharePayload = {
  url: string;
  title: string;
  text: string;
};

function buildSharePayload(post: any, baseUrl: string): SharePayload {
  const url = `${baseUrl}/post/${post?.id}`;
  const title = post?.title ? String(post.title) : 'Jachoei';
  const detail = post?.detail ? String(post.detail).replace(/\s+/g, ' ').trim() : '';
  const text = detail
    ? `${title}\n\n${detail.slice(0, 180)}${detail.length > 180 ? '...' : ''}`
    : title;

  return { url, title, text };
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

function ShareActionButton({ post, baseUrl, isMobile }: { post: any; baseUrl: string; isMobile: boolean }) {
  const [open, setOpen] = React.useState(false);

  const payload = React.useMemo(() => buildSharePayload(post, baseUrl), [post, baseUrl]);

  const openFacebookShare = (shareUrl: string) => {
    const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(fb, '_blank', 'noopener,noreferrer');
  };

  const handleShare = async (e: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    try {
      const nav: any = navigator as any;

      // ✅ Native share (มือถือ/บาง desktop)
      if (nav?.share) {
        await nav.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
        });
        return;
      }

      // ✅ Fallback modal
      setOpen(true);
    } catch (err: any) {
      // ผู้ใช้กด cancel บาง browser จะ throw AbortError
      if (String(err?.name || '').toLowerCase().includes('abort')) return;
      setOpen(true);
    }
  };

  return (
    <>
      <Tooltip title="Share">
        <Button
          type="text"
          size={isMobile ? 'small' : 'middle'}
          icon={<ShareAltOutlined />}
          onClick={handleShare}
        />
      </Tooltip>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title="Share post"
        footer={null}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <Typography.Text strong>{payload.title}</Typography.Text>
            <div style={{ marginTop: 6 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {payload.url}
              </Typography.Text>
            </div>
          </div>

          <Space wrap>
            <Button
              icon={<LinkOutlined />}
              onClick={async () => {
                try {
                  await copyToClipboard(payload.url);
                  message?.success?.('Copied link'); // safeguard if message is not available
                } catch {
                  // fallback to antd message if available
                }
              }}
            >
              Copy link
            </Button>

            <Button
              icon={<CopyOutlined />}
              onClick={async () => {
                try {
                  await copyToClipboard(`${payload.title}\n${payload.url}`);
                } catch {}
              }}
            >
              Copy text
            </Button>

            <Button icon={<FacebookFilled />} onClick={() => openFacebookShare(payload.url)}>
              Share to Facebook
            </Button>

            <Button
              onClick={() => {
                window.open(payload.url, '_blank', 'noopener,noreferrer');
              }}
            >
              Open link
            </Button>
          </Space>

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Tip: บนมือถือจะเปิด native share ให้เองถ้าเครื่องรองรับ
          </Typography.Text>
        </div>
      </Modal>
    </>
  );
}

/**
 * IMPORTANT:
 * ใช้ message ของ antd ต้อง import message
 */
import { message } from 'antd';
import React from 'react';

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
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // ✅ base url สำหรับแชร์ (client-only)
  const BASE_URL =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://jachoei.com');

  if (!post) {
    return (
      <Card loading={loading} title={title ?? 'Post [x]'}>
        No data.
      </Card>
    );
  }

  const telNumbers = (post as any).tel_numbers || [];
  const sellerAccounts = (post as any).seller_accounts || [];

  // ✅ Facebook icon behavior
  const fbStatus = String((post as any).fb_status ?? '').toUpperCase();
  const fbPermalinkUrl = String((post as any).fb_permalink_url ?? '').trim();
  const isFbPublished = fbStatus === 'PUBLISHED' && !!fbPermalinkUrl;

  const fbBtn = (
    <Button
      type="text"
      size={isMobile ? 'small' : 'middle'}
      icon={<FacebookFilled />}
      disabled={!isFbPublished}
      aria-label="Facebook"
      style={{
        opacity: isFbPublished ? 1 : 0.35,
        cursor: isFbPublished ? 'pointer' : 'not-allowed',
      }}
    />
  );

  return (
    <Card
      title={title ?? 'รายละเอียดโพสต์'}
      loading={loading}
      headStyle={{
        padding: isMobile ? '8px 12px' : '12px 16px',
      }}
      bodyStyle={{
        padding: isMobile ? 12 : 16,
      }}
      extra={
        <Space size={isMobile ? 4 : 8} wrap>
         

          {/* ✅ Facebook icon (click new tab only if PUBLISHED + permalink_url exists) */}
          <Tooltip
            title={
              isFbPublished
                ? 'Open Facebook post'
                : `Facebook: ${fbStatus || 'NOT PUBLISHED'}`
            }
          >
            {isFbPublished ? (
              <a
                href={fbPermalinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex' }}
              >
                {fbBtn}
              </a>
            ) : (
              fbBtn
            )}
          </Tooltip>

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
                size={isMobile ? 'small' : 'middle'}
                icon={<MessageOutlined />}
                title="Chat with"
              />
            </Link>
          )}

          {user?.id === (post as any)?.author.id && (
            <>
              <Tooltip title="Clone">
                <Button
                  type="text"
                  size={isMobile ? 'small' : 'middle'}
                  onClick={() => onClone?.(String((post as any)?.id))}
                  loading={cloning}
                  icon={<CopyOutlined />}
                />
              </Tooltip>

              <Tooltip title="Edit">
                <Link href={`/post/${(post as any)?.id}/edit`} prefetch={false}>
                  <Button
                    type="text"
                    size={isMobile ? 'small' : 'middle'}
                    icon={<EditOutlined />}
                  />
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
                    size={isMobile ? 'small' : 'middle'}
                    danger
                    loading={deleting}
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}

           {/* ✅ Share (เหมือนหน้าบน) */}
          <ShareActionButton post={post} baseUrl={BASE_URL} isMobile={isMobile} />
        </Space>
      }
    >
      {/* 🧱 Layout หลัก: ซ้าย = รายละเอียด, ขวา = Comments (stack บน mobile) */}
      <Row gutter={isMobile ? 12 : 24} align="top">
        {/* LEFT: รายละเอียดโพสต์ทั้งหมด */}
        <Col xs={24} md={14}>
          <Descriptions
            column={1}
            bordered={!isMobile}
            size={isMobile ? 'small' : 'middle'}
            labelStyle={{
              width: isMobile ? 130 : 200,
              fontSize: isMobile ? 12 : 14,
              padding: isMobile ? '6px 8px' : undefined,
            }}
            contentStyle={{
              fontSize: isMobile ? 13 : 14,
              padding: isMobile ? '6px 8px' : undefined,
            }}
          >
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
                ? Number((post as any).transfer_amount).toLocaleString('th-TH', {
                    minimumFractionDigits: 2,
                  })
                : '-'}
            </Descriptions.Item>

            <Descriptions.Item label="วันโอนเงิน">
              {(post as any).transfer_date ? formatDate((post as any).transfer_date) : '-'}
            </Descriptions.Item>

            <Descriptions.Item label="เว็บประกาศขายของ">
              {(post as any).website || '-'}
            </Descriptions.Item>

            <Descriptions.Item label="จังหวัดของคนสร้างรายงาน">
              {(post as any).province_name || (post as any).province_id || '-'}
            </Descriptions.Item>

            {/* ✅ OPTIONAL: แสดงสถานะ Facebook แบบอ่านง่าย */}
            <Descriptions.Item label="Facebook">
              {isFbPublished ? (
                <Space size={8} wrap>
                  <Typography.Text>Published</Typography.Text>
                  {(post as any).fb_published_at ? (
                    <Typography.Text type="secondary">
                      {formatDate((post as any).fb_published_at)}
                    </Typography.Text>
                  ) : null}
                  <Typography.Text type="secondary" copyable>
                    {fbPermalinkUrl}
                  </Typography.Text>
                </Space>
              ) : (
                <Typography.Text type="secondary">
                  {fbStatus || 'NOT PUBLISHED'}
                </Typography.Text>
              )}
            </Descriptions.Item>
          </Descriptions>

          {/* เบอร์โทร/ไอดีไลน์ */}
          {telNumbers.length > 0 && (
            <>
              <Divider orientation="left" style={{ margin: isMobile ? '12px 0' : '16px 0' }}>
                เบอร์โทรศัพท์ / ไอดีไลน์
              </Divider>
              <Table
                dataSource={telNumbers}
                pagination={false}
                rowKey={(r: any) => r.id}
                size="small"
                scroll={isMobile ? { x: 320 } : undefined}
                style={{ fontSize: isMobile ? 12 : 14 }}
                columns={[
                  {
                    title: 'ลำดับ',
                    width: 60,
                    render: (_: any, __: any, i: number) => i + 1,
                  },
                  {
                    title: 'เบอร์โทร / ไอดีไลน์',
                    dataIndex: 'tel',
                    render: (s: string) => (
                      <Typography.Text copyable style={{ fontSize: isMobile ? 12 : 14 }}>
                        {s}
                      </Typography.Text>
                    ),
                  },
                ]}
              />
            </>
          )}

          {/* บัญชีคนขาย */}
          {sellerAccounts.length > 0 && (
            <>
              <Divider orientation="left" style={{ margin: isMobile ? '12px 0' : '16px 0' }}>
                บัญชีคนขาย
              </Divider>
              <Table
                dataSource={sellerAccounts}
                pagination={false}
                rowKey={(r: any) => r.id}
                size="small"
                scroll={isMobile ? { x: 360 } : undefined}
                style={{ fontSize: isMobile ? 12 : 14 }}
                columns={[
                  {
                    title: 'ลำดับ',
                    width: 60,
                    render: (_: any, __: any, i: number) => i + 1,
                  },
                  {
                    title: 'ชื่อบัญชีคนขาย',
                    dataIndex: 'bank_name',
                    render: (s: string) => (
                      <Typography.Text style={{ fontSize: isMobile ? 12 : 14 }}>
                        {s}
                      </Typography.Text>
                    ),
                  },
                  {
                    title: 'เลขที่บัญชี',
                    dataIndex: 'seller_account',
                    render: (s: string) => (
                      <Typography.Text copyable style={{ fontSize: isMobile ? 12 : 14 }}>
                        {s}
                      </Typography.Text>
                    ),
                  },
                ]}
              />
            </>
          )}

          {/* รูปภาพแนบ */}
          {(post.images || []).length > 0 && (
            <>
              <Divider orientation="left" style={{ margin: isMobile ? '12px 0' : '16px 0' }}>
                ไฟล์แนบ / รูปภาพ
              </Divider>
              <div
                style={{
                  marginTop: 8,
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 110 : 160}px, 1fr))`,
                  gap: isMobile ? 8 : 12,
                }}
              >
                {(post.images || []).map((img) => (
                  <Image
                    key={String(img.id)}
                    src={(img as any).url}
                    width={isMobile ? 110 : 160}
                    height={isMobile ? 110 : 160}
                    style={{ objectFit: 'cover', borderRadius: 4 }}
                  />
                ))}
              </div>
            </>
          )}
        </Col>

        {/* RIGHT: Comments Section */}
        <Col xs={24} md={10} style={{ marginTop: isMobile ? 16 : 0 }}>
          <Divider orientation="left" style={{ margin: isMobile ? '0 0 8px' : '0 0 12px' }}>
            ความคิดเห็น
          </Divider>
          <CommentsSection postId={String((post as any).id)} currentUserId={user?.id} />
        </Col>
      </Row>
    </Card>
  );
}
