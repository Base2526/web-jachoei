'use client';
import React, { useEffect, useState } from 'react';
import { Card, Space, Input, Select, Button, Popconfirm, List, Tag, Divider, message } from 'antd';

type LogRow = {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error' | string;
  category: string;
  message: string;
  meta: any;
  created_by: number | null;
  created_at: string;
};

// ---- Config: ใช้ /admin/api/logs ให้ตรงกับโครงสร้างที่เราแยกไว้ฝั่ง admin
const ADMIN_API_PREFIX = '/api';

async function fetchLogs(params: {
  q?: string; level?: string; category?: string; page: number; pageSize: number;
}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.level) qs.set('level', params.level);
  if (params.category) qs.set('category', params.category);
  qs.set('page', String(params.page));
  qs.set('pageSize', String(params.pageSize));
  const res = await fetch(`${ADMIN_API_PREFIX}/logs?` + qs.toString(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load logs');
  return res.json();
}

function levelTag(level: string){
  const color =
    level === 'error' ? 'red' :
    level === 'warn' ? 'orange' :
    level === 'info' ? 'blue' :
    level === 'debug' ? 'default' : 'default';
  return <Tag color={color}>{level}</Tag>;
}

export default function AdminLogsPage() {
  const [q,setQ] = useState('');
  const [level,setLevel] = useState<string|undefined>();
  const [category,setCategory] = useState<string|undefined>();
  const [data,setData] = useState<LogRow[]>([]);
  const [total,setTotal] = useState(0);
  const [page,setPage] = useState(1);
  const [pageSize,setPageSize] = useState(50);
  const [loading,setLoading] = useState(false);

  async function load(){
    setLoading(true);
    try{
      const res = await fetchLogs({ q, level, category, page, pageSize });
      setData(res.items); setTotal(res.total);
    }catch(e:any){
      message.error(e.message||'Load logs failed');
    }finally{ setLoading(false); }
  }
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [q, level, category, page, pageSize]);

  async function addTest(){
    const res = await fetch(`${ADMIN_API_PREFIX}/logs`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ level: 'info', category: 'logs-page', message: 'Test log from /admin/logs' })
    });
    if(res.ok){ message.success('Created'); load(); } else { message.error('Create failed'); }
  }

  async function purgeByFilter(){
    const qs = new URLSearchParams();
    if(level) qs.set('level', level);
    if(category) qs.set('category', category);
    if(q) qs.set('q', q);
    const res = await fetch(`${ADMIN_API_PREFIX}/logs?` + qs.toString(), { method: 'DELETE' });
    const j = await res.json();
    if(res.ok){ message.success(`Deleted ${j.deleted} logs`); load(); } else { message.error(j.error||'Purge failed'); }
  }

  return (
    <Card
      title="System Logs"
      extra={
        <Space wrap>
          <Input.Search placeholder="Search text" onSearch={setQ} allowClear enterButton />
          <Select
            allowClear
            placeholder="Level"
            style={{ width: 140 }}
            onChange={setLevel}
            options={[ 'debug','info','warn','error' ].map(v=>({ value: v, label: v }))}
          />
          <Input
            placeholder="Category"
            allowClear
            style={{ width: 200 }}
            onChange={(e)=> setCategory(e.target.value||undefined)}
          />
          <Button onClick={addTest}>Add test</Button>
          <Popconfirm title="Delete logs by current filters?" onConfirm={purgeByFilter}>
            <Button danger>Purge by filter</Button>
          </Popconfirm>
        </Space>
      }
      styles={{ body: { paddingTop: 12 } }}
    >
      <List
        loading={loading}
        itemLayout="vertical"
        dataSource={data}
        rowKey={(x)=> String(x.id)}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange:(p,ps)=>{ setPage(p); setPageSize(ps||50); },
        }}
        renderItem={(item)=>{
          return (
            <List.Item
              key={item.id}
              actions={[
                <span key="time">{new Date(item.created_at).toLocaleString()}</span>,
                <span key="cat"><Tag>{item.category}</Tag></span>,
              ]}
            >
              <List.Item.Meta
                avatar={levelTag(item.level)}
                title={
                  <Space split={<Divider type="vertical" />} wrap>
                    <span>#{item.id}</span>
                    <strong>{item.message}</strong>
                  </Space>
                }
                description={
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }} className="text-xs">
                    {JSON.stringify(item.meta || {}, null, 2)}
                  </pre>
                }
              />
            </List.Item>
          );
        }}
      />
    </Card>
  );
}
