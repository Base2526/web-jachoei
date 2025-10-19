'use client';
import { ApolloClient, InMemoryCache, split, HttpLink, ApolloProvider, gql, useQuery, useSubscription } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";
import { Table, Input, Space, Button, Tag, message } from "antd";
import { useMemo, useState } from "react";

const httpUri = process.env.NEXT_PUBLIC_GRAPHQL_HTTP!;
const wsUri   = process.env.NEXT_PUBLIC_GRAPHQL_WS!;

function makeClient(){
  const httpLink = new HttpLink({ uri: httpUri });
  const wsLink = typeof window !== "undefined"
    ? new GraphQLWsLink(createClient({ url: wsUri }))
    : null as any;

  const link = typeof window !== "undefined"
    ? split(
        ({ query }) => {
          const def = getMainDefinition(query);
          return def.kind === 'OperationDefinition' && def.operation === 'subscription';
        },
        wsLink!, httpLink
      )
    : httpLink;

  return new ApolloClient({ link, cache: new InMemoryCache() });
}

const POSTS = gql`
  query($q:String){
    posts(search:$q){ id title phone status created_at author { id name avatar } }
  }
`;
const SUB = gql`subscription { messageAdded { id text ts } }`;

function PostsList(){
  const [q, setQ] = useState('');
  const { data, refetch } = useQuery(POSTS,{ variables:{ q:'' }});

  // ✅ ใช้ useSubscription สำหรับ Subscription
  useSubscription(SUB, {
    onData: ({ data }) => {
      const msg = data.data?.messageAdded?.text;
      if (msg) message.info("WS: " + msg);
    }
  });

  const cols = [
    { title:'Title', dataIndex:'title' },
    { title:'Phone', dataIndex:'phone' },
    { title:'Status', dataIndex:'status', render:(s:string)=><Tag color={s==='public'?'green':'red'}>{s}</Tag> },
    { title:'Author', render:(_:any,r:any)=>r.author?.name || '-' },
    { title:'Action', render:(_:any,r:any)=><Space>
        <a href={`/post/${r.id}`}>view</a>
        <a href={`/chat?to=${r.author?.id||''}`}>chat</a>
      </Space> }
  ];
  return (<>
    <Space style={{marginBottom:16}}>
      <Input placeholder="Search title/phone" value={q} onChange={e=>setQ(e.target.value)} />
      <Button onClick={()=>refetch({ q })}>Search</Button>
      <a href="/login">Login</a>
    </Space>
    <Table rowKey="id" dataSource={data?.posts||[]} columns={cols as any} />
  </>);
}

export default function Page(){
  const client = useMemo(()=>makeClient(),[]);
  return <ApolloProvider client={client}><PostsList/></ApolloProvider>;
}