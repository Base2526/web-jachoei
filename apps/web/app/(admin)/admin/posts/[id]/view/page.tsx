'use client';
import { gql, useQuery } from "@apollo/client";
import { Card, Descriptions, Tag, Skeleton, Space, Typography } from "antd";
import { useParams } from "next/navigation";
import Link from "next/link";

const { Title, Paragraph } = Typography;

const Q_POST = gql`
  query($id:ID!){
    post(id:$id){
      id title body image_url phone status created_at updated_at
      author { id name email role }
    }
  }
`;

export default function ViewPostPage(){
  const params = useParams();
  const id = String(params?.id);
  const { data, loading } = useQuery(Q_POST, { variables:{ id }});
  const p = data?.post;

  return (
    <Card title="View Post" extra={<Link href="/admin/posts">Back to list</Link>}>
      {loading || !p ? <Skeleton active/> : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={3} style={{ marginBottom: 0 }}>{p.title}</Title>
          <Space split="•">
            <Tag color={p.status==='public'?'green':'red'}>{p.status}</Tag>
            <span>Created: {new Date(p.created_at).toLocaleString()}</span>
            <span>Updated: {new Date(p.updated_at).toLocaleString()}</span>
          </Space>

          {p.image_url && (
            <img
              src={p.image_url}
              alt={p.title}
              style={{ maxWidth: '100%', borderRadius: 8 }}
            />
          )}

          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Phone">{p.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="Author">
              {p.author ? `${p.author.name} (${p.author.role})` : '-'}
            </Descriptions.Item>
          </Descriptions>

          <div>
            <Title level={5}>Body</Title>
            <Paragraph style={{ whiteSpace:'pre-wrap' }}>{p.body}</Paragraph>
          </div>
        </Space>
      )}
    </Card>
  );
}
