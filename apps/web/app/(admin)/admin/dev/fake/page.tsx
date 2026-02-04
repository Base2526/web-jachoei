'use client';
import React, { useState } from 'react';
import { Card, InputNumber, Select, Button, Space, Table, message, Divider } from 'antd';

type CreatedRow = any;

export default function DevFakePage() {
  const [kind, setKind] = useState<'posts'|'users'>('posts');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedRow[]>([]);

  async function doFake() {
    setLoading(true);
    try {
      const res = await fetch(`/api/dev/fake/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
        // ถ้าต้องการส่ง cookie ให้แน่ใจว่า server-side จะอ่าน cookie ได้
        credentials: 'include'
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Failed');
      message.success(`Created ${j.created?.length || 0} ${kind}`);
      setCreated(prev => [...j.created, ...prev].slice(0, 200));
    } catch (e: any) {
      message.error(e.message || 'Error');
    } finally { setLoading(false); }
  }

  async function cleanup() {
    setLoading(true);
    try {
      const res = await fetch('/api/dev/fake/cleanup', { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Cleanup failed');
      message.success(`Deleted ${j.deleted} records`);
      setCreated([]);
    } catch (e:any) {
      message.error(e.message || 'Error');
    } finally { setLoading(false); }
  }

  const cols = [
    { title: 'id', dataIndex:'id', key:'id', width:120 },
    { title: 'title / name', dataIndex:'title', key:'title', render: (_:any, r:any) => r.title || r.name },
    { title: 'phone', dataIndex:'phone', key:'phone' },
    { title: 'status', dataIndex:'status', key:'status' },
    { title: 'created_at', dataIndex:'created_at', key:'created_at' },
  ];

  return (
    <Card title="Dev: Fake Data Generator" extra={<Space>
      <Select value={kind} onChange={(v)=>setKind(v as any)} options={[{label:'Posts',value:'posts'},{label:'Users',value:'users'}]} />
      <InputNumber min={1} max={500} value={count} onChange={(v)=>setCount(v||1)} />
      <Button type="primary" onClick={doFake} loading={loading}>Create</Button>
      <Button danger onClick={cleanup} disabled={loading}>Cleanup</Button>
    </Space>}>
      <p>Use this page only on development/test environments. Must be admin or internal caller.</p>
      <Divider />
      <Table dataSource={created} columns={cols} rowKey="id" />
    </Card>
  );
}
