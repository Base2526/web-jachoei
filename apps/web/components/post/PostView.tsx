'use client';
import React from 'react';
import { Card, Descriptions, Image } from 'antd';
import type { PostRecord } from './PostForm';

type Props = { post: PostRecord | null; loading?: boolean; title?: string; };

export default function PostView({ post, loading, title }: Props){

  console.log("[PostView]", post);
  return (
    <Card title={title ?? 'Post'} loading={loading}>
      {post && <>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Title">{post.title}</Descriptions.Item>
          <Descriptions.Item label="Phone">{post.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="Status">{post.status}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 16, display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:12 }}>
          {(post.images||[]).map((img)=>(
            <Image key={String(img.id)} src={img.url} width={160} height={160} style={{ objectFit:'cover' }} />
          ))}
        </div>
      </>}
    </Card>
  );
}
