'use client';
import { gql, useQuery, useMutation } from "@apollo/client";
import { useState, useEffect } from "react";
import {
  List, Card, Input, Button, Space, Typography, Divider, Modal, message, Tag, Dropdown, Radio, Select
} from "antd";
import { MoreOutlined } from "@ant-design/icons";

// ===== GraphQL =====
const Q_CHATS = gql`query { myChats { id name is_group created_at members { id name } } }`;
const Q_MSGS  = gql`query($chatId:ID!){ messages(chatId:$chatId){ id chat_id text created_at sender{ id name } } }`;
const Q_USERS = gql`query($q:String){ users(search:$q){ id name } }`;

const SUB     = gql`subscription($chatId:ID!){ messageAdded(chatId:$chatId){ id chatId senderId text ts } }`;

const MUT_SEND    = gql`mutation($chatId:ID!,$text:String!){ sendMessage(chatId:$chatId,text:$text){ id } }`;
const MUT_CREATE  = gql`mutation($name:String,$isGroup:Boolean!,$memberIds:[ID!]!){ createChat(name:$name,isGroup:$isGroup,memberIds:$memberIds){ id name } }`;
const MUT_ADD     = gql`mutation($chatId:ID!,$userId:ID!){ addMember(chatId:$chatId,userId:$userId) }`;

const MUT_RENAME  = gql`mutation($chatId:ID!,$name:String!){ renameChat(chatId:$chatId,name:$name) }`;
const MUT_DELETE  = gql`mutation($chatId:ID!){ deleteChat(chatId:$chatId) }`;

function ChatUI(){
  const [sel, setSel] = useState<string|null>(null);
  const [text, setText] = useState('');

  const [openCreate, setOpenCreate] = useState(false);
  const [mode, setMode] = useState<'single'|'group'>('single');
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const [openEdit, setOpenEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState<{id:string,name?:string}|null>(null);

  const { data:chats, refetch:refetchChats } = useQuery(Q_CHATS);
  const { data:msgs, refetch:refetchMsgs, subscribeToMore } = useQuery(Q_MSGS, {
    skip: !sel, variables: { chatId: sel }
  });
  const { data:users, refetch:refetchUsers } = useQuery(Q_USERS, { variables: { q: "" } });

  const [send]      = useMutation(MUT_SEND);
  const [createChat]= useMutation(MUT_CREATE);
  const [addMember] = useMutation(MUT_ADD);
  const [renameChat]= useMutation(MUT_RENAME, { onError:()=>{} });
  const [deleteChat]= useMutation(MUT_DELETE, { onError:()=>{} });

  useEffect(()=>{
    if(!sel) return;
    const unsub = subscribeToMore({
      document: SUB, variables: { chatId: sel },
      updateQuery(prev, { subscriptionData }){
        const m = subscriptionData.data?.messageAdded;
        if (!m) return prev;
        const appended = (prev.messages || []).concat([{
          id: m.id, chat_id: m.chatId, text: m.text, created_at: m.ts, sender: { id: m.senderId, name: m.senderId }
        }]);
        return { ...prev, messages: appended };
      }
    });
    return ()=>unsub();
  }, [sel, subscribeToMore]);

  const onEdit = (c: any) => {
    setEditTarget({ id: c.id, name: c.name });
    setEditName(c.name || '');
    setOpenEdit(true);
  };

  const onDelete = (c: any) => {
    Modal.confirm({
      title: `Delete chat`,
      content: <>คุณต้องการลบห้อง <b>{c.name || (c.is_group?'(Group)':'(1:1)')}</b> ใช่ไหม?</>,
      okType: 'danger',
      onOk: async () => {
        try{
          await deleteChat({ variables: { chatId: c.id }});
          message.success('Deleted');
          if (sel === c.id) setSel(null);
          refetchChats();
        }catch(e:any){
          message.error(e.message||'Delete failed');
        }
      }
    });
  };

  const onAddMember = async (c: any) => {
    const pick = await new Promise<string|undefined>((resolve)=>{
      let localSel: string[] = [];
      Modal.confirm({
        title: 'Add member',
        content: (
          <Select
            style={{width:'100%'}}
            placeholder="Pick one user"
            options={(users?.users||[]).map((u:any)=>({ value:u.id, label:u.name }))}
            onChange={(val)=>{ localSel = Array.isArray(val)? val : [val]; }}
            showSearch
          />
        ),
        onOk: ()=> resolve(localSel[0]),
        onCancel: ()=> resolve(undefined)
      });
    });
    if (!pick) return;
    try{
      await addMember({ variables: { chatId: c.id, userId: pick }});
      message.success('Member added');
      refetchChats();
    }catch(e:any){
      message.error(e.message||'Add member failed');
    }
  };

  const menuFor = (c:any) => ({
    items: [
      {
        type: 'group' as const,
        label: 'Group',
        children: [
          { key: 'edit',   label: 'Edit name',    onClick: ()=>onEdit(c) },
          { key: 'delete', label: 'Delete chat',  onClick: ()=>onDelete(c) },
        ]
      },
      {
        type: 'group' as const,
        label: 'Members',
        children: [
          { key: 'add', label: 'Add member', onClick: ()=>onAddMember(c) },
        ]
      }
    ]
  });

  const onCreateChat = async () => {
    const ids = mode === 'single' ? selectedUsers.slice(0,1) : selectedUsers;
    if (ids.length === 0){
      message.warning('Please select at least 1 member');
      return;
    }
    await createChat({ variables: { name: mode==='group' ? (groupName || null) : null, isGroup: mode==='group', memberIds: ids } });
    setOpenCreate(false);
    setGroupName('');
    setSelectedUsers([]);
    message.success('Created');
    refetchChats();
  };

  return <div style={{display:'grid', gridTemplateColumns:'360px 1fr', gap:16}}>
    <Card
      title="Chats"
      extra={<Button onClick={()=>{ setOpenCreate(true); refetchUsers({ q:'' }); }}>+ New Chat</Button>}
    >
      <List
        dataSource={chats?.myChats||[]}
        renderItem={(c:any)=>(
          <List.Item
            onClick={()=>{ setSel(c.id); refetchMsgs({ chatId: c.id }); }}
            style={{cursor:'pointer'}}
            actions={[
              c.is_group ? <Tag color="blue" key="tag">Group</Tag> : <Tag key="tag">1:1</Tag>,
              <Dropdown key="more" menu={menuFor(c)} trigger={['click']}>
                <Button type="text" icon={<MoreOutlined />} onClick={(e)=>e.stopPropagation()} />
              </Dropdown>
            ]}
          >
            <List.Item.Meta
              title={c.name || (c.is_group ? 'Group' : '1:1')}
              description={(c.members||[]).map((m:any)=>m.name).join(', ')}
            />
          </List.Item>
        )}
      />
    </Card>

    <Card title={sel ? `Chat ${sel}` : 'Select a chat'}>
      {sel && <>
        <div style={{height: '60vh', overflow:'auto', border:'1px solid #eee', padding:12}}>
          {(msgs?.messages||[]).map((m:any)=>(
            <div key={m.id} style={{marginBottom:8}}>
              <Typography.Text strong>{m.sender?.name||'—'}:</Typography.Text> {m.text}
              <div style={{fontSize:12, color:'#888'}}>{new Date(m.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
        <Divider/>
        <Space.Compact style={{width:'100%'}}>
          <Input value={text} onChange={e=>setText(e.target.value)} placeholder="Type message..."/>
          <Button type="primary" onClick={async ()=>{
            if (!text.trim() || !sel) return;
            await send({ variables: { chatId: sel, text } });
            setText('');
          }}>Send</Button>
        </Space.Compact>
      </>}
    </Card>

    <Modal open={openCreate} title="Create chat" onCancel={()=>setOpenCreate(false)} onOk={onCreateChat}>
      <Space direction="vertical" style={{width:'100%'}}>
        <Radio.Group
          value={mode}
          onChange={(e)=>{ setMode(e.target.value); setSelectedUsers([]); }}
          options={[{ label:'Single (1:1)', value:'single' }, { label:'Group', value:'group' }]}
          optionType="button"
        />
        {mode === 'group' && (
          <Input placeholder="Group name (optional)" value={groupName} onChange={e=>setGroupName(e.target.value)} />
        )}
        <Select
          mode={mode === 'group' ? 'multiple' : undefined}
          style={{ width:'100%' }}
          placeholder={mode==='group'?'Select members':'Select one user'}
          options={(users?.users||[]).map((u:any)=>({ value:u.id, label:u.name }))}
          value={selectedUsers}
          onChange={(val)=> setSelectedUsers(Array.isArray(val)? val : [val])}
          showSearch
          onSearch={(val)=> refetchUsers({ q: val })}
          filterOption={false}
        />
      </Space>
    </Modal>

    <Modal open={openEdit} title="Edit chat name" onCancel={()=>setOpenEdit(false)} onOk={async()=>{
      if (!editTarget?.id) return;
      try{
        await renameChat({ variables: { chatId: editTarget.id, name: editName || null }});
        setOpenEdit(false);
        message.success('Renamed');
        refetchChats();
      }catch(e:any){
        message.error(e.message||'Rename failed');
      }
    }}>
      <Input placeholder="Chat name" value={editName} onChange={(e)=>setEditName(e.target.value)} />
    </Modal>
  </div>;
}

export default function Page(){ return <ChatUI/>; }
