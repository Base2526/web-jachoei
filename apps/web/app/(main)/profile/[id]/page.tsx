'use client';
import { gql, useQuery } from "@apollo/client";
import { Card, Descriptions, Avatar, List, Tag } from "antd";

const Q = gql`
  query($id:ID!){
    user(id:$id){ id name avatar phone email role created_at }
    postsByUserId(user_id:$id){ id title status created_at }
  }
`;

function Profile({ id }:{ id:string }){
  const { data } = useQuery(Q,{ variables:{ id } });
  const u = data?.user;
  const posts = data?.postsByUserId || [];

  if (!u) return <div>Loading...</div>;

  return <div style={{display:'grid', gap:16}}>
    <Card title="User Profile">
      <Descriptions bordered column={1}>
        <Descriptions.Item label="Avatar">
          <Avatar src={u.avatar} size={64}>{u.name?.[0]||'U'}</Avatar>
        </Descriptions.Item>
        <Descriptions.Item label="Name">{u.name}</Descriptions.Item>
        <Descriptions.Item label="Email">{u.email||'-'}</Descriptions.Item>
        <Descriptions.Item label="Phone">{u.phone||'-'}</Descriptions.Item>
        <Descriptions.Item label="Role">{u.role}</Descriptions.Item>
        <Descriptions.Item label="Joined">{new Date(u.created_at).toLocaleString()}</Descriptions.Item>
      </Descriptions>
    </Card>

    <Card title="Posts by this user">
      <List
        itemLayout="horizontal"
        dataSource={posts}
        renderItem={(p:any)=>(
          <List.Item actions={[<a key="view" href={`/post/${p.id}`}>view</a>, <a key="chat" href={`/chat?to=${u.id}`}>chat</a>]}>
            <List.Item.Meta
              title={<a href={`/post/${p.id}`}>{p.title}</a>}
              description={<>
                <span style={{marginRight:8}}>Phone: {p.phone||'-'}</span>
                <Tag color={p.status==='public'?'green':'red'}>{p.status}</Tag>
              </>}
            />
          </List.Item>
        )}
      />
    </Card>
  </div>;
}

export default function Page({ params }:{ params:{ id:string }}){
  return <Profile id={params.id}/>;
}
