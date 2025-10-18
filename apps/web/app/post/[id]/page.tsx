'use client';
import { useQuery, gql, ApolloClient, InMemoryCache, ApolloProvider, HttpLink } from "@apollo/client";
import { Descriptions, Card } from "antd";
import { useMemo } from "react";

const Q = gql`query($id:ID!){ post(id:$id){ id title body image_url phone status author{ id name avatar } } }`;

function View({ id }:{id:string}){
  const { data } = useQuery(Q,{ variables:{ id } });
  const p = data?.post;
  if (!p) return <div>Loading...</div>;
  return <Card title={p.title}>
    <Descriptions bordered column={1}>
      <Descriptions.Item label="Phone">{p.phone}</Descriptions.Item>
      <Descriptions.Item label="Status">{p.status}</Descriptions.Item>
      <Descriptions.Item label="Author"><a href={`/profile/${p.author?.id}`}>{p.author?.name}</a></Descriptions.Item>
      <Descriptions.Item label="Body">{p.body}</Descriptions.Item>
    </Descriptions>
  </Card>;
}

export default function Page({ params }:{ params:{ id:string }}){
  const client = useMemo(()=>new ApolloClient({
    link: new HttpLink({ uri: process.env.NEXT_PUBLIC_GRAPHQL_HTTP! }),
    cache: new InMemoryCache()
  }),[]);
  return <ApolloProvider client={client}><View id={params.id}/></ApolloProvider>;
}
