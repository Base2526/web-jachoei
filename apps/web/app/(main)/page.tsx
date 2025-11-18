'use client';
import { gql, useQuery, useMutation } from "@apollo/client";
import { Table, Input, Space, Button, Tag, Popconfirm, message, Tooltip, Typography, Badge } from "antd";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CommentOutlined,
  EditOutlined,
  DeleteOutlined,
  MessageOutlined
} from "@ant-design/icons";

import ThumbGrid from '@/components/ThumbGrid';
import BookmarkButton from "@/components/BookmarkButton";
import { useSessionCtx } from '@/lib/session-context';

const DELETE_POST = gql`mutation ($id: ID!) { deletePost(id: $id) } `;
const Q_POSTS_PAGED = gql`
  query($q:String, $limit:Int!, $offset:Int!){
    postsPaged(search:$q, limit:$limit, offset:$offset){
      total
      items{
        id 
        title 
        detail 
        status 
        is_bookmarked
        created_at
        images { id url }
        author { id name avatar }
        tel_numbers { id tel }
        seller_accounts { id bank_name seller_account }

        comments_count
      }
    }
  }
`;

// helper: แสดงเป็นรายการ <li> สูงสุด 3 รายการ ที่เหลือซ่อนใน Tooltip
const TelList = ({ items }: { items: Array<{id:string; tel:string}> | undefined }) => {
  const list = (items || []).filter(Boolean);
  if (!list.length) return <>-</>;

  const visible = list.slice(0, 3);
  const hidden = list.slice(3);

  return (
    <>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {visible.map((t) => (
          <li key={t.id || t.tel} style={{ lineHeight: 1.3 }}>
            <Typography.Text copyable>{t.tel}</Typography.Text>
          </li>
        ))}
      </ul>

      {hidden.length > 0 && (
        <Tooltip
          placement="bottom"
          title={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {hidden.map((t) => (
                <li key={t.id || t.tel} style={{ lineHeight: 1.3 }}>
                  <Typography.Text copyable>{t.tel}</Typography.Text>
                </li>
              ))}
            </ul>
          }
        >
          <span style={{ fontSize: 12, color: '#999' }}>
            +{hidden.length} more
          </span>
        </Tooltip>
      )}
    </>
  );
};

function PostsList() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const router = useRouter();

  const { user, loading: sessionLoading } = useSessionCtx();

  const { data, loading, refetch } = useQuery(Q_POSTS_PAGED, {
    variables: { q, limit: pageSize, offset: (page - 1) * pageSize },
    fetchPolicy: "cache-and-network",
  });

  const [deletePost, { loading: deleting }] = useMutation(DELETE_POST);

  useEffect(()=>{
    console.log("[data]", data);
  }, [data])

  const handleDelete = async (id: string) => {
    try {
      const { data: res } = await deletePost({ variables: { id } });
      if (res?.deletePost) {
        message.success("Deleted successfully");
        refetch();
      } else {
        message.warning("Delete failed");
      }
    } catch (err: any) {
      message.error(err?.message || "Delete error");
    }
  };

  const cols = [
    { title: 'Images', dataIndex: 'images', render: (imgs: any) => <ThumbGrid images={imgs} width={160} height={110} /> },
    { title:'Title',  
      onCell: () => ({ style: { verticalAlign: 'top' } }), 
      render: (_:any, r:any)=>{return <Link href={`/post/${r.id}`}>{r.title}</Link> }},
    { title: 'Detail', 
      onCell: () => ({ style: { verticalAlign: 'top' } }), 
      dataIndex: 'detail' },
    { title: 'Tel', 
      width: 200,  
      onCell: () => ({ style: { verticalAlign: 'top' } }), 
      dataIndex: 'tel_numbers', 
      render: (tels: any) => <TelList items={tels} /> }, 
    { title: 'Seller Accounts',
      onCell: () => ({ style: { verticalAlign: 'top' } }), 
      dataIndex: 'seller_accounts',
      render: (list: Array<{ id: string; bank_name?: string; seller_account?: string }> = []) => {
        if (!Array.isArray(list) || list.length === 0) return '-';
        return (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {list.map((acc) => (
              <li key={acc.id}>
                {(acc.bank_name || '-')} : <Typography.Text copyable>{(acc.seller_account || '-')}</Typography.Text>
              </li>
            ))}
          </ul>
        );
      },
    },
    { title: 'Author', 
      onCell: () => ({ style: { verticalAlign: 'top' } }), 
      render: (_: any, r: any) => <Link href={`/profile/${r.author.id}`} prefetch={false}>{r.author?.name}</Link> },
    {
      title: 'Action', render: (_: any, r: any) =>
        <Space>
          { user?.id !== r.author?.id && <BookmarkButton postId={r.id} defaultBookmarked={r?.is_bookmarked ?? false} /> }
          {user?.id === r.author.id && (
            <>
              <Tooltip title="Edit">
                <Link href={`/post/${r.id}/edit`} prefetch={false}>
                  <Button type="text" size="small" icon={<EditOutlined />} />
                </Link>
              </Tooltip>

              <Popconfirm
                title="Confirm delete?"
                okText="Yes"
                cancelText="No"
                onConfirm={() => handleDelete(r.id)}
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

          {user?.id !== r.author?.id && (
            <Tooltip title="Chat">
              <Link href={`/chat?to=${r.author.id}`} prefetch={false}>
                <Button type="text" size="small" icon={<MessageOutlined />} />
              </Link>
            </Tooltip>
          )}

         <Tooltip title={`Comments (${r.comments_count || 0})`}>
          <Link href={`/post/${r.id}`} prefetch={false}>
            <Badge
              count={r.comments_count || 0}
              size="small"
              // ไม่อยากโชว์ถ้าเป็น 0 ก็ลบ showZero ทิ้ง
              showZero={false}
              offset={[0, 4]} // ขยับตำแหน่ง badge นิดหน่อย
            >
              <Button
                type="text"
                size="small"
                icon={<CommentOutlined />}
              />
            </Badge>
          </Link>
        </Tooltip>

          {/* < /> */}
        </Space>
    }
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search title/phone"
          allowClear
          value={q}
          onChange={e => setQ(e.target.value)}
          onPressEnter={() => refetch({ q, limit: pageSize, offset: 0 })}
        />
        <Button onClick={() => refetch({ q, limit: pageSize, offset: 0 })}>Search</Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data?.postsPaged?.items || []}
        columns={cols as any}
        pagination={{
          current: page,
          pageSize,
          total: data?.postsPaged?.total || 0,
          showSizeChanger: true,
          showTotal: (total, range) =>`${range[0]}-${range[1]} of ${total} items`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
            refetch({ q, limit: ps, offset: (p - 1) * ps });
          },
        }}
      />
    </>
  );
}

export default function Page() {
  return <PostsList />;
}
