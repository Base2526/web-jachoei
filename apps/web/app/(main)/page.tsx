'use client';
import { gql, useQuery, useMutation } from "@apollo/client";
import { Table, Input, Space, Button, Tag, Popconfirm, message } from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// import { verifyUserSession } from "@/lib/auth"

import { verifyTokenString } from "@/lib/auth/token";

const POSTS = gql`query($q:String){ posts(search:$q){ id title phone status created_at author { id name avatar } } }`;
const DELETE_POST = gql`mutation ($id: ID!) { deletePost(id: $id) } `;

import { GetServerSideProps } from "next";
import { verifyUserSessionFromReq } from "@/lib/auth/pages";

// import { verifyUserSession } from "@/lib/auth/server"; 

// export const getServerSideProps: GetServerSideProps = async ({ req }) => {
//   const user = verifyUserSessionFromReq(req);
//   if (!user) return { redirect: { destination: "/login?next=/account", permanent: false } };
//   return { props: { user } };
// };

function PostsList({ user }: any){
  const [q, setQ] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const router = useRouter();

  const { data, refetch } = useQuery(POSTS,{ variables:{ q:'' }});
  const [deletePost, { loading: deleting }] = useMutation(DELETE_POST);

  useEffect(() => {
    // ตรวจว่า login ไหม (มี token)
    const token = localStorage.getItem("token");
    setIsLogin(!!token);
    

    // const user_session =  verifyUserSession();

    // const user = verifyUserSession(); 

    // console.log("[user_session]", user);
  }, []);

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

  const cols = [
    { title:'Title', dataIndex:'title' },
    { title:'Phone', dataIndex:'phone' },
    { title:'Status', dataIndex:'status', render:(s:string)=><Tag color={s==='public'?'green':'red'}>{s}</Tag> },
    { title:'Author', render:(_:any,r:any)=>r.author?.name || '-' },
    { title:'Action', render:(_:any,r:any)=><Space>
        <Link href={`/post/${r.id}`}>view</Link>
        <Link href={`/post/${r.id}/edit`}>edit</Link>
        <Popconfirm
            title="Confirm delete?"
            onConfirm={() => handleDelete(r.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="link"
              danger
              size="small"
              loading={deleting}
            >
              delete
            </Button>
          </Popconfirm>

           {r.author?.id ? <Link href={`/chat?to=${r.author.id}`}>chat</Link> : null}
      </Space> }
  ];
  return (<>
    <Space style={{marginBottom:16}}>
      <Input placeholder="Search title/phone" value={q} onChange={e=>setQ(e.target.value)} />
      <Button onClick={()=>refetch({ q })}>Search</Button>
      {/* <Link href="/post/new"><Button type="primary">+ New Post</Button></Link> */}

      {/* <Link href="/my/profile"><Button type="primary">My Profile</Button></Link> */}
      {/* <Link href="/my/posts"><Button type="primary">My Post</Button></Link> */}

      {/* <Link href="/admin/users"><Button type="primary">Users</Button></Link> */}
      {/* <Link href="/chat"><Button type="primary">Chat UI</Button></Link> */}
      {/* <Link href="/login">Login</Link> */}

      {/* {isLogin ? (
          <Button onClick={handleLogout} danger>
            Logout
          </Button>
        ) : (
          <Link href="/login">Login</Link>
        )} */}
    </Space>
    <Table rowKey="id" dataSource={data?.posts||[]} columns={cols as any} />
  </>);
}

export default function Page(){
  return <PostsList/>
}
