'use client';
import { gql, useQuery, useMutation } from "@apollo/client";
import { useState, useEffect, useMemo } from "react";
import {
  List, Card, Input, Button, Space, Typography, Divider, Modal, message, Tag, Dropdown, Radio, Select
} from "antd";
import { MoreOutlined } from "@ant-design/icons";

import SendMessageSection from "@/components/chat/SendMessageSection";

// ===== GraphQL =====
const Q_CHATS = gql`query{ myChats { id name is_group created_at members { id name } } }`;
const Q_MSGS  = gql`query($chat_id:ID!){ messages(chat_id:$chat_id){ id chat_id text created_at sender{ id name } myReceipt { deliveredAt isRead readAt } readers{ id name } readersCount } }`;
const Q_USERS = gql`query($q:String){ users(search:$q){ id name } }`;

// id chat_id sender{id name phone email} text created_at to_user_ids
const SUB     = gql`subscription($chat_id:ID!){ messageAdded(chat_id:$chat_id){ id chat_id sender text created_at to_user_ids } }`;

const MUT_SEND    = gql`mutation($chat_id:ID!,$text:String!,$to_user_ids: [ID!]!){ sendMessage(chat_id:$chat_id,text:$text,to_user_ids:$to_user_ids){ id } }`;
const MUT_CREATE  = gql`mutation($name:String,$isGroup:Boolean!,$memberIds:[ID!]!){ createChat(name:$name,isGroup:$isGroup,memberIds:$memberIds){ id name } }`;
const MUT_ADD     = gql`mutation($chat_id:ID!,$user_id:ID!){ addMember(chat_id:$chat_id,user_id:$user_id) }`;

const MUT_RENAME  = gql`mutation($chat_id:ID!,$name:String!){ renameChat(chat_id:$chat_id,name:$name) }`;
const MUT_DELETE  = gql`mutation($chat_id:ID!){ deleteChat(chat_id:$chat_id) }`;

type Member = { id: string; name?: string };
type Chat = { id: string; name: string; is_group: string; members?: Member[] };

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
    skip: !sel, variables: { chat_id: sel }
  });
  const { data:users, refetch:refetchUsers } = useQuery(Q_USERS, { variables: { q: "" } });

  const [send]      = useMutation(MUT_SEND);
  const [createChat]= useMutation(MUT_CREATE);
  const [addMember] = useMutation(MUT_ADD);
  const [renameChat]= useMutation(MUT_RENAME, { onError:()=>{} });
  const [deleteChat]= useMutation(MUT_DELETE, { onError:()=>{} });

  useEffect(()=>{
    console.log("[msgs]" , msgs);
  }, [msgs])

  useEffect(()=>{
    if(!sel) return;
    const unsub = subscribeToMore({
      document: SUB, variables: { chat_id: sel },
      updateQuery(prev, { subscriptionData }){
        const m = subscriptionData.data?.messageAdded;
        if (!m) return prev;
        const appended = (prev.messages || []).concat([{
          id: m.id, chat_id: m.chat_id, text: m.text, created_at: m.created_at, sender: { id: m.sender_id, name: m.name }
        }]);

        console.log("SUB : ", m, appended);
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
          await deleteChat({ variables: { chat_id: c.id }});
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
      await addMember({ variables: { chat_id: c.id, user_id: pick }});
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

  const chat: Chat | undefined = useMemo(
      () => chats?.myChats?.find((i: any) => i.id === sel),
      [chats, sel]
  );

  return <div style={{display:'grid', gridTemplateColumns:'360px 1fr', gap:16}}>
    <Card
      title="Chats"
      extra={<Button onClick={()=>{ setOpenCreate(true); refetchUsers({ q:'' }); }}>+ New Chat</Button>}
    >
      <List
        dataSource={chats?.myChats||[]}
        renderItem={(c:any)=>(
          <List.Item
            onClick={()=>{ 
              setSel(c.id); 
              refetchMsgs({ chat_id: c.id }); 
            }}
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

    <Card title={sel ? `Chat ${chat?.name}` : 'Select a chat'}>
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
          <SendMessageSection
            chats={chats}
            sel={sel || "1"}
            text={text}
            setText={setText}
            send={send}
          />
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
        await renameChat({ variables: { chat_id: editTarget.id, name: editName || null }});
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
