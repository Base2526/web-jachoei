'use client';
import React from 'react';
import { Card, Descriptions, Image, Divider, Table, Typography } from 'antd';
import type { PostRecord } from './PostForm';
import dayjs from 'dayjs';

const { Text } = Typography;

type Props = {
  post: PostRecord | null;
  loading?: boolean;
  title?: string;
};

export default function PostView({ post, loading, title }: Props) {
  console.log("[PostView]", post);

  if (!post) {
    return <Card loading={loading} title={title ?? 'Post'}>No data.</Card>;
  }

  // เตรียมข้อมูล array ย่อย (เผื่อ backend ส่งมาเป็น null)
  const telNumbers = (post as any).tel_numbers || [];
  const sellerAccounts = (post as any).seller_accounts || [];

  return (
    <Card title={title ?? 'รายละเอียดโพสต์'} loading={loading}>
      <Descriptions column={1} bordered size="small">
        {/* ฟิลด์หลัก */}
        {/* 
        <Descriptions.Item label="ชื่อโพสต์ (Title)">
          {post.title || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="รายละเอียด (Detail)">
          {post.body || '-'}
        </Descriptions.Item> 
        */}
        {/* <Descriptions.Item label="เบอร์โทร / ไอดีไลน์ (Phone)">
          {post.phone || '-'}
        </Descriptions.Item> */}

        {/* ฟิลด์ใหม่ */}
        <Descriptions.Item label="ชื่อ-นามสกุล คนขาย">
          {(post as any).first_last_name || '-'}
        </Descriptions.Item>

        <Descriptions.Item label="เลขบัตรประชาชน / พาสปอร์ต">
          {(post as any).id_card || '-'}
        </Descriptions.Item>

        <Descriptions.Item label="สินค้า/บริการ ที่สั่งซื้อ">
          {(post as any).title || '-'}
        </Descriptions.Item>

        <Descriptions.Item label="ยอดโอน">
          {(post as any).transfer_amount
            ? Number((post as any).transfer_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })
            : '-'}
        </Descriptions.Item>

        <Descriptions.Item label="วันโอนเงิน">
          {(post as any).transfer_date
            ? dayjs((post as any).transfer_date).format('DD/MM/YYYY HH:mm')
            : '-'}
        </Descriptions.Item>

        <Descriptions.Item label="เว็บประกาศขายของ">
          {(post as any).website || '-'}
        </Descriptions.Item>

        <Descriptions.Item label="จังหวัดของคนสร้างรายงาน">
          {(post as any).province_name || (post as any).province_id || '-'}
        </Descriptions.Item>

        <Descriptions.Item label="รายละเอียดเพิ่มเติม">
          {(post as any).detail || '-'}
        </Descriptions.Item>
      </Descriptions>

      {/* ======================= */}
      {/* เบอร์โทร/ไอดีไลน์ */}
      {/* ======================= */}
      {telNumbers.length > 0 && (
        <>
          <Divider orientation="left">เบอร์โทรศัพท์ / ไอดีไลน์</Divider>
          <Table
            dataSource={telNumbers}
            pagination={false}
            rowKey={(r: any) => r.id}
            size="small"
            columns={[
              { title: 'ลำดับ', render: (_: any, __: any, i: number) => i + 1 },
              { title: 'เบอร์โทร / ไอดีไลน์', dataIndex: 'tel' },
            ]}
          />
        </>
      )}

      {/* ======================= */}
      {/* บัญชีคนขาย */}
      {/* ======================= */}
      {sellerAccounts.length > 0 && (
        <>
          <Divider orientation="left">บัญชีคนขาย</Divider>
          <Table
            dataSource={sellerAccounts}
            pagination={false}
            rowKey={(r: any) => r.id}
            size="small"
            columns={[
              { title: 'ลำดับ', render: (_: any, __: any, i: number) => i + 1 },
              { title: 'ชื่อบัญชีคนขาย', dataIndex: 'bank_name' },
              { title: 'เลขที่บัญชี', dataIndex: 'seller_account' },
              { title: 'ธนาคาร', dataIndex: 'bank_id' },
            ]}
          />
        </>
      )}

      {/* ======================= */}
      {/* รูปภาพแนบ */}
      {/* ======================= */}
      {(post.images || []).length > 0 && (
        <>
          <Divider orientation="left">ไฟล์แนบ / รูปภาพ</Divider>
          <div
            style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
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

      <Descriptions.Item label="สถานะ (Status)">
        {post.status || '-'}
      </Descriptions.Item>
    </Card>
  );
}
