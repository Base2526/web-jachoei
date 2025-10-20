'use client';
import { gql, useQuery } from "@apollo/client";
import { Table, Input, Space, Button, Tag } from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";

const POSTS = gql`query($q:String){ posts(search:$q){ id title phone status created_at author { id name avatar } } }`;

function PostsList(){
  const [q, setQ] = useState('');
  const { data, refetch } = useQuery(POSTS,{ variables:{ q:'' }});

  useEffect(()=>{
    console.log("PostsList : [data] =", data);
  }, [data]);

  const cols = [
    { title:'Title', dataIndex:'title' },
    { title:'Phone', dataIndex:'phone' },
    { title:'Status', dataIndex:'status', render:(s:string)=><Tag color={s==='public'?'green':'red'}>{s}</Tag> },
    { title:'Author', render:(_:any,r:any)=>r.author?.name || '-' },
    { title:'Action', render:(_:any,r:any)=><Space>
        <Link href={`/post/${r.id}`}>view</Link>
        {r.author?.id ? <Link href={`/chat?to=${r.author.id}`}>chat</Link> : null}
      </Space> }
  ];
  return (<>
    <Space style={{marginBottom:16}}>
      <Input placeholder="Search title/phone" value={q} onChange={e=>setQ(e.target.value)} />
      <Button onClick={()=>refetch({ q })}>Search</Button>
      <Link href="/post/new"><Button type="primary">New Post</Button></Link>
      <Link href="/login">Login</Link>
    </Space>
    <Table rowKey="id" dataSource={data?.posts||[]} columns={cols as any} />
  </>);
}

export default function Page(){
  return <PostsList/>
}
