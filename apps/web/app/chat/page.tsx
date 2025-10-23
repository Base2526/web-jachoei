'use client';
import { gql, useQuery, useMutation } from "@apollo/client";
import { useState, useEffect } from "react";
import { List, Card, Input, Button, Space, Typography, Divider, Modal, message } from "antd";


const Q_CHATS = gql`query { myChats { id name is_group created_at members { id name } } }`;
const Q_MSGS  = gql`query($chatId:ID!){ messages(chatId:$chatId){ id chat_id text created_at sender{ id name } } }`;
const MUT_SEND= gql`mutation($chatId:ID!,$text:String!){ sendMessage(chatId:$chatId,text:$text){ id } }`;
const MUT_CREATE = gql`mutation($name:String,$isGroup:Boolean!,$memberIds:[ID!]!){ createChat(name:$name,isGroup:$isGroup,memberIds:$memberIds){ id name } }`;
const MUT_ADD = gql`mutation($chatId:ID!,$userId:ID!){ addMember(chatId:$chatId,userId:$userId) }`;
const SUB = gql`subscription($chatId:ID!){ messageAdded(chatId:$chatId){ id chatId senderId text ts } }`;

function ChatUI(){
  const [sel, setSel] = useState<string|null>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [memberIds, setMemberIds] = useState(''); // comma separated

  const { data:chats, refetch:refetchChats } = useQuery(Q_CHATS);
  const { data:msgs, refetch:refetchMsgs, subscribeToMore } = useQuery(Q_MSGS, {
    skip: !sel, variables: { chatId: sel }
  });
  const [send] = useMutation(MUT_SEND);
  const [createChat] = useMutation(MUT_CREATE);

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

  return <div style={{display:'grid', gridTemplateColumns:'320px 1fr', gap:16}}>
    <Card title="Chats" extra={<Button onClick={()=>setOpen(true)}>+ New Group</Button>}>
      <List
        dataSource={chats?.myChats||[]}
        renderItem={(c:any)=>(
          <List.Item onClick={()=>{ setSel(c.id); refetchMsgs({ chatId: c.id }); }} style={{cursor:'pointer'}}>
            <List.Item.Meta title={c.name || (c.is_group?'Group':'1:1')} description={(c.members||[]).map((m:any)=>m.name).join(', ')} />
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

    <Modal open={open} title="Create group chat" onCancel={()=>setOpen(false)} onOk={async()=>{
      const ids = memberIds.split(',').map(s=>s.trim()).filter(Boolean);
      await createChat({ variables: { name: groupName || null, isGroup: true, memberIds: ids } });
      setOpen(false); setGroupName(''); setMemberIds(''); message.success('Created');
      refetchChats();
    }}>
      <Space direction="vertical" style={{width:'100%'}}>
        <Input placeholder="Group name" value={groupName} onChange={e=>setGroupName(e.target.value)} />
        <Input placeholder="Member IDs (comma separated UUIDs)" value={memberIds} onChange={e=>setMemberIds(e.target.value)} />
      </Space>
    </Modal>
  </div>;
}

export default function Page(){
  return <ChatUI/>;
}
