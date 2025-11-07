'use client';
import { gql, useQuery, useMutation } from "@apollo/client";
import { Table, Input, Space, Button, Tag, Modal, message } from "antd";
import Link from "next/link";
import { useState } from "react";

const Q_POSTS = gql`
  query($q:String){
    posts(search:$q){ id title phone status created_at }
  }
`;
const M_DEL = gql`mutation($id:ID!){ deletePost(id:$id) }`;

const statusTag = (s:string)=><Tag color={s==='public'?'green':'red'}>{s}</Tag>;

function PostsList(){
  const [q, setQ] = useState('');
  const { data, refetch, loading } = useQuery(Q_POSTS, { variables:{ q:'' } });
  const [doDel] = useMutation(M_DEL);

  const cols = [
    { title:'Title', dataIndex:'title' },
    { title:'Phone', dataIndex:'phone' },
    { title:'Status', dataIndex:'status', render:statusTag },
    { title:'Action', render:(_:any,r:any)=>
      <Space>
        <Link href={`/admin/post/${r.id}/edit`}>edit</Link>
        <a onClick={()=>{
          Modal.confirm({
            title: 'Delete this post?',
            onOk: async ()=>{
              const res = await doDel({ variables:{ id: r.id } });
              if (res.data?.deletePost) { message.success('Deleted'); refetch({ q }); }
              else message.error('Delete failed');
            }
          });
        }}>delete</a>
        <Link href={`/admin/post/${r.id}/view`}>view</Link>
      </Space>
    }
  ];

  return (
    <>
      <Space style={{marginBottom:16}} wrap>
        <Input placeholder="Search title/phone" value={q} onChange={e=>setQ(e.target.value)} onPressEnter={()=>refetch({ q })}/>
        <Button onClick={()=>refetch({ q })}>Search</Button>
        <Button type="primary">
          <Link href="/admin/post/new" style={{color:'#fff'}}>+ New Post</Link>
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data?.posts||[]}
        columns={cols as any}
      />
    </>
  );
}

export default function Page(){ return <PostsList/>; }
