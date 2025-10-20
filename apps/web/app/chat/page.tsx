'use client';
import { gql, useQuery, useMutation, useSubscription } from "@apollo/client";
import { List, Input, Button, Space, Card } from "antd";
import { useState, useEffect } from "react";

const GET_OR_CREATE_DM = gql`query($userId:ID!){ getOrCreateDm(userId:$userId){ id } }`;
const MESSAGES = gql`query($chatId:ID!){ messages(chatId:$chatId){ id sender_id text created_at } }`;
const SEND = gql`mutation($chatId:ID!,$text:String!){ sendMessage(chatId:$chatId, text:$text){ id text created_at sender_id } }`;
const SUB = gql`subscription($chatId:ID!){ messageAdded(chatId:$chatId){ id text ts chat_id sender_id } }`;

function ChatUI({ to }:{ to:string }){
  const [chatId, setChatId] = useState<string|undefined>(undefined);
  const [text, setText] = useState("");

  const { data:dm } = useQuery(GET_OR_CREATE_DM, { variables:{ userId: to }, skip: !to });

  useEffect(()=>{
    // console.log("ChatUI ", chatId, httpUri, dm, to)
  }, [chatId, dm, to]);

  useEffect(()=>{ if (dm?.getOrCreateDm?.id) setChatId(dm.getOrCreateDm.id); },[dm?.getOrCreateDm?.id]);

  const { data:msgData, refetch } = useQuery(MESSAGES, { variables:{ chatId }, skip: !chatId });
  const [send] = useMutation(SEND, { variables:{ chatId, text }, onCompleted: ()=>setText("") });

  useSubscription(SUB, { variables:{ chatId }, skip: !chatId, onData: ()=>{
    console.log("SUB >> " );
    refetch() 
  }});

  return <Card title={"Chat " + (chatId||"")} style={{ maxWidth: 720 }}>
    <List
      size="small"
      bordered
      dataSource={msgData?.messages || []}
      renderItem={(m:any)=>(<List.Item>
        <Space><b>{m.sender_id.slice(0,6)}</b>: {m.text}</Space>
      </List.Item>)}
      style={{ marginBottom: 12 }}
    />
    <Space.Compact style={{ width: '100%' }}>
      <Input value={text} onChange={e=>setText(e.target.value)} onPressEnter={()=>text && send()} placeholder="Type message..."/>
      <Button type="primary" onClick={()=>text && send()}>Send</Button>
    </Space.Compact>
  </Card>;
}

export default function Page({ searchParams }:{ searchParams:{ to?:string }}){
  const to = searchParams?.to || "";
  return <ChatUI to={to}/>;
}
