'use client';
import { gql, useQuery, useMutation } from "@apollo/client";
import { Table, Input, Space, Button, Tag, Popconfirm, message, Tooltip } from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  MessageOutlined,
  BookOutlined
} from "@ant-design/icons";

// import { useSession } from '@/lib/useSession'
// import { verifyUserSession } from "@/lib/auth"
// import { verifyTokenString } from "@/lib/auth/token";

import ThumbGrid from '@/components/ThumbGrid';
import { useSessionCtx } from '@/lib/session-context';

const POSTS = gql`query($q:String){ posts(search:$q){ id title body phone status created_at author { id name avatar } images { id url } } }`;
const DELETE_POST = gql`mutation ($id: ID!) { deletePost(id: $id) } `;

// import { GetServerSideProps } from "next";
// import { verifyUserSessionFromReq } from "@/lib/auth/pages";
// import { verifyUserSession } from "@/lib/auth/server"; 
// export const getServerSideProps: GetServerSideProps = async ({ req }) => {
//   const user = verifyUserSessionFromReq(req);
//   if (!user) return { redirect: { destination: "/login?next=/account", permanent: false } };
//   return { props: { user } };
// };



function PostsList(){
  const [q, setQ] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const router = useRouter();

  const { data, refetch } = useQuery(POSTS,{ variables:{ q:'' }});
  const [deletePost, { loading: deleting }] = useMutation(DELETE_POST);

  // const { user, isAuthenticated, loading } = useSession('web')

  const { user, admin, isAuthenticated, loading } = useSessionCtx();

  useEffect(() => {
    // ตรวจว่า login ไหม (มี token)
    // const token = localStorage.getItem("token");
    // setIsLogin(!!token);
    

    // const user_session =  verifyUserSession();

    // const user = verifyUserSession(); 

    // console.log("[user_session]", user, isAuthenticated, loading);
  }, []);

  // useEffect(()=>{
  //   if(!loading) console.log('[user_session-web]', user, isAuthenticated, loading);
  // }, [loading, user, isAuthenticated]);

  useEffect(()=>{
    console.log("PostsList : [data] =", data);
  }, [data]);

  const handleDelete = async (id: string) => {
    try {
      const { data: res } = await deletePost({
        variables: { id },
      });
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    document.cookie = "token=; Max-Age=0; path=/";
    setIsLogin(false);
    message.info("You have been logged out");
    router.push("/login");
  };

  function handleClick(e: React.MouseEvent) {
    if (loading) return; // ยังเช็ก session ไม่เสร็จ
    if (!isAuthenticated) {
      e.preventDefault(); // ยกเลิกการเปิด Link ปกติ
      message.info('Please login first');
      // router.push('/login?next=' + encodeURIComponent(`/chat?to=${toId}`));
      router.push('/login');
    }
  }

  const cols = [
    { title:'Images', dataIndex:'images', render:(imgs:any)=><ThumbGrid images={imgs} width={160} height={110} /> },
    { title:'Title', render:(s:any)=><Link href={`/post/${s.id}`} prefetch={false}>{s.title}</Link> },
    { title:'Detail', dataIndex:'body' },
    { title:'Phone', dataIndex:'phone' },
    // { title:'Status', dataIndex:'status', render:(s:string)=><Tag color={s==='public'?'green':'red'}>{s}</Tag> },
    { title:'Author', render:(_:any,r:any)=>r.author?.name || '-' },
    { title:'Action', render:(_:any,r:any)=>
      <Space>
        <Tooltip title="View">
          <Link href={`/post/${r.id}`} prefetch={false}>
            <Button
              type="text"
              size="small"
              icon={<BookOutlined />}
            />
          </Link>
        </Tooltip>

        <Tooltip title="View">
          <Link href={`/post/${r.id}`} prefetch={false}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
            />
          </Link>
        </Tooltip>

        {
          user && 
          <Tooltip title="Edit">
            <Link href={`/post/${r.id}/edit`} prefetch={false}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
              />
            </Link>
          </Tooltip>
        }
        
        {
          user && 
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
        }
        
        {r.author?.id ? (
          <Tooltip title="Chat">
            <Link href={`/chat?to=${r.author.id}`} prefetch={false} >
              <Button
                type="text"
                size="small"
                icon={<MessageOutlined />}
              />
            </Link>
          </Tooltip>
        ) : null}
      </Space>
    }
  ];
  return (<>
    <Space style={{marginBottom:16}}>
      <Input placeholder="Search title/phone" value={q} onChange={e=>setQ(e.target.value)} />
      <Button onClick={()=>refetch({ q })}>Search</Button>
    </Space>
    <Table rowKey="id" dataSource={data?.posts||[]} columns={cols as any} />
  </>);
}

export default function Page(){
  return <PostsList/>
}
