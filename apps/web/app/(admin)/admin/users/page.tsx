'use client';
import { gql, useQuery, useMutation } from "@apollo/client";
import { Table, Input, Space, Button, Tag, Popconfirm, Modal, message, Image } from "antd";
import { useMemo, useState } from "react";

const Q_USERS = gql`query($search:String){ users(search:$search){ id name email phone role created_at avatar } }`;
const M_DELETE = gql`mutation($id:ID!){ deleteUser(id:$id) }`;
const M_DELETE_MANY = gql`mutation($ids:[ID!]!){ deleteUsers(ids:$ids) }`;

const roleTag = (v:string) => (
  <Tag color={v==='Administrator'?'red':v==='Author'?'blue':'default'}>
    {v}
  </Tag>
);

function UsersList(){
  const [search, setSearch] = useState('');
  const { data, refetch, loading } = useQuery(Q_USERS, { variables: { search:'' }});
  const [deleteOne] = useMutation(M_DELETE);
  const [deleteMany] = useMutation(M_DELETE_MANY);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const selectedCount = selectedRowKeys.length;

  const handleBulkDelete = async () => {
    if (!selectedCount) return;
    Modal.confirm({
      title: `Delete ${selectedCount} user(s)?`,
      content: 'This action cannot be undone.',
      okButtonProps: { danger: true },
      onOk: async () => {
        const ids = selectedRowKeys.map(String);
        const res = await deleteMany({ variables:{ ids } });
        if (res.data?.deleteUsers) {
          message.success(`Deleted ${selectedCount} users`);
          setSelectedRowKeys([]);
          refetch({ search });
        } else {
          message.error('Delete failed');
        }
      }
    });
  };

  const columns = useMemo(()=>[
    {
      title:'User',
      dataIndex:'name',
      render:(v:any,r:any)=>(
        <Space>
          {r.avatar
            ? <Image src={r.avatar} alt={r.name} width={50} height={50}
                   style={{borderRadius:'50%',objectFit:'cover'}}/>
            : <div style={{
                width:50,height:50,borderRadius:'50%',
                background:'#ddd',display:'inline-flex',
                alignItems:'center',justifyContent:'center',fontSize:12
              }}>
                {r.name?.[0]?.toUpperCase() || '?'}
              </div>}
          <a href={`/admin/users/${r.id}/edit`}>{v}</a>
        </Space>
      )
    },
    { title:'Email', dataIndex:'email' },
    { title:'Phone', dataIndex:'phone' },
    { title:'Role', dataIndex:'role', render:roleTag },
    { title:'Created', dataIndex:'created_at' },
    {
      title:'Actions',
      render:(_:any,r:any)=>(
        <Space>
          <a href={`/admin/users/${r.id}/edit`}>Edit</a>
          <Popconfirm title="Delete this user?" onConfirm={async()=>{
            const res = await deleteOne({ variables:{ id:r.id } });
            if(res.data?.deleteUser){ message.success('Deleted'); refetch({search}); }
            else message.error('Delete failed');
          }}>
            <a>Delete</a>
          </Popconfirm>
        </Space>
      )
    }
  ], [deleteOne, search, refetch]);

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
  };

  return (
    <>
      <Space style={{marginBottom:16}} wrap>
        <Input
          placeholder="Search name/phone/email"
          value={search}
          onChange={e=>setSearch(e.target.value)}
          onPressEnter={()=>refetch({search})}
        />
        <Button onClick={()=>refetch({search})}>Search</Button>
        <Button danger disabled={!selectedCount} onClick={handleBulkDelete}>
          Delete selected ({selectedCount})
        </Button>
        <Button type="primary" href="/admin/users/new">
          + New User
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data?.users || []}
        columns={columns as any}
        rowSelection={rowSelection}
        pagination={{ pageSize:10 }}
      />
    </>
  );
}

export default function Page(){ return <UsersList/>; }
