'use client';
import { gql, useQuery, useMutation } from "@apollo/client";
import { Table, Input, Space, Button, Tag, Modal, message } from "antd";
import Link from "next/link";
import { useMemo, useState } from "react";
import ThumbGrid from '@/components/ThumbGrid';

const Q_POSTS_PAGED = gql`
  query($q:String, $limit:Int!, $offset:Int!){
    postsPaged(search:$q, limit:$limit, offset:$offset){
      total
      items{
        id 
        title 
        detail 
        status 
        created_at
        images { id url }
        author { id name avatar }
      }
    }
  }
`;
const M_DEL = gql`mutation($id:ID!){ deletePost(id:$id) }`;
const M_DEL_MANY = gql`mutation($ids:[ID!]!){ deletePosts(ids:$ids) }`;

const statusTag = (s:string)=><Tag color={s==='public'?'green':'red'}>{s}</Tag>;

function PostsList(){
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, refetch, loading } = useQuery(Q_POSTS_PAGED, {
    variables: { q:'', limit: pageSize, offset: (page-1)*pageSize }
  });

  const [doDel] = useMutation(M_DEL);
  const [doDelMany] = useMutation(M_DEL_MANY);

  // multi-select
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const selectedCount = selectedRowKeys.length;

  const onSearch = () => {
    setPage(1);
    refetch({ q, limit: pageSize, offset: 0 });
  };

  const onBulkDelete = async () => {
    if (!selectedCount) return;
    Modal.confirm({
      title: `Delete ${selectedCount} post(s)?`,
      content: 'This action cannot be undone.',
      okButtonProps: { danger: true },
      onOk: async () => {
        const ids = selectedRowKeys.map(String);
        const res = await doDelMany({ variables: { ids } });
        if (res.data?.deletePosts) {
          message.success(`Deleted ${selectedCount} item(s)`);
          setSelectedRowKeys([]);
          refetch({ q, limit: pageSize, offset: (page-1)*pageSize });
        } else {
          message.error('Delete failed');
        }
      }
    });
  };

  const cols = useMemo(()=>[
    { title:'Images', dataIndex:'images', render:(imgs:any)=><ThumbGrid images={imgs} width={160} height={110} /> },
    { title:'Title',  render: (_:any, r:any)=>{
      return <Link href={`/admin/post/${r.id}`}>{r.title}</Link>
    } },
    { title:'Detail', dataIndex:'detail' },
    { title:'Author', render:(_:any,r:any)=><Link href={`/admin/users/${r.author.id}/edit`} prefetch={false}>{r.author?.name}</Link> },
    { title:'Status', dataIndex:'status', render:statusTag },
    { title:'Action', render:(_:any,r:any)=>
      <Space>
        <Link href={`/admin/post/${r.id}/edit`}>edit</Link>
        <a onClick={()=>{
          Modal.confirm({
            title: 'Delete this post?',
            onOk: async ()=>{
              const res = await doDel({ variables:{ id: r.id } });
              if (res.data?.deletePost) {
                message.success('Deleted');
                refetch({ q, limit: pageSize, offset: (page-1)*pageSize });
              } else {
                message.error('Delete failed');
              }
            }
          });
        }}>delete</a>
        <Link href={`/admin/post/${r.id}`}>view</Link>
      </Space>
    }
  ], [doDel, q, page, pageSize, refetch]);

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
  };

  const items = data?.postsPaged?.items || [];
  const total = data?.postsPaged?.total || 0;

  return (
    <>
      <Space style={{marginBottom:16}} wrap>
        <Input
          placeholder="Search title/phone"
          value={q}
          onChange={e=>setQ(e.target.value)}
          onPressEnter={onSearch}
        />
        <Button onClick={onSearch}>Search</Button>

        <Button danger disabled={!selectedCount} onClick={onBulkDelete}>
          Delete selected ({selectedCount})
        </Button>

        <Button type="primary">
          <Link href="/admin/post/new" style={{color:'#fff'}}>+ New Post</Link>
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={cols as any}
        rowSelection={rowSelection}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => {
            const changedPageSize = ps !== pageSize;
            setPage(p);
            setPageSize(ps);
            refetch({
              q,
              limit: ps,
              offset: (p-1)*ps
            });
            if (changedPageSize) setSelectedRowKeys([]); // เคลียร์ selection เมื่อเปลี่ยน pageSize
          }
        }}
      />
    </>
  );
}

export default function Page(){ return <PostsList/>; }
