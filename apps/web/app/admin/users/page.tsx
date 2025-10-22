'use client';
import { ApolloClient, InMemoryCache, HttpLink, ApolloProvider, gql, useQuery, useMutation } from "@apollo/client";
import { Table, Input, Space, Button, Popconfirm, Tag, message } from "antd";
import { useMemo, useState } from "react";

const Q_USERS = gql`
  query($search:String){
    users(search:$search){
      id name email phone role created_at avatar
    }
  }
`;
const M_DELETE = gql`mutation($id:ID!){ deleteUser(id:$id) }`;

function UsersList(){
  const [search, setSearch] = useState('');
  const { data, refetch, loading } = useQuery(Q_USERS, { variables: { search: '' }});
  const [del] = useMutation(M_DELETE, { onCompleted: ()=>{ message.success('Deleted'); refetch({search}); }});

  const columns = [
    { title:'Name', dataIndex:'name', render:(v:any,r:any)=><Space>
        {r.avatar ? <img src={r.avatar} width={24} height={24} style={{borderRadius:12}}/> : <span style={{display:'inline-block',width:24}}/>}
        <a href={`/admin/users/${r.id}`}>{v}</a>
      </Space> },
    { title:'Email', dataIndex:'email' },
    { title:'Phone', dataIndex:'phone' },
    { title:'Role', dataIndex:'role', render:(v:string)=><Tag color={v==='Administrator'?'red':v==='Author'?'blue':'default'}>{v}</Tag> },
    { title:'Created', dataIndex:'created_at' },
    { title:'Actions', render:(_:any,r:any)=><Space>
        <a href={`/admin/users/${r.id}`}>Edit</a>
        <Popconfirm title="Delete user?" onConfirm={()=>del({ variables:{ id:r.id }})}>
          <a>Delete</a>
        </Popconfirm>
      </Space>}
  ];

  return <>
    <Space style={{marginBottom:16}}>
      <Input placeholder="Search name/phone/email" value={search} onChange={e=>setSearch(e.target.value)} />
      <Button onClick={()=>refetch({search})}>Search</Button>
      <Button type="primary" href="/admin/users/new">New User</Button>
    </Space>
    <Table rowKey="id" loading={loading} dataSource={data?.users||[]} columns={columns as any}/>
  </>;
}

export default function Page(){
  const client = useMemo(()=> new ApolloClient({
    link: new HttpLink({ uri: process.env.NEXT_PUBLIC_GRAPHQL_HTTP! }),
    cache: new InMemoryCache(),
  }),[]);
  return <ApolloProvider client={client}><UsersList/></ApolloProvider>;
}
