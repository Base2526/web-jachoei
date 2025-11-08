'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Space, Input, Select, Button, Popconfirm, List, Tag, Divider, message, Checkbox } from 'antd';
import Link from 'next/link';

type LogRow = {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error' | string;
  category: string;
  message: string;
  meta: any;
  created_by: number | null;
  created_at: string;
};

const ADMIN_API_PREFIX = '/api';

// ========== API helpers ==========
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
  return res.json(); // { items: LogRow[], total: number }
}

async function deleteLogsByIds(ids: (string|number)[]) {
  const qs = new URLSearchParams();
  qs.set('ids', ids.join(','));
  const res = await fetch(`${ADMIN_API_PREFIX}/logs?` + qs.toString(), { method: 'DELETE' });
  const j = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(j.error || 'Bulk delete failed');
  return j; // { deleted: number }
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

  // ========== NEW: selections ==========
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const pageIds = useMemo(()=> data.map(d => d.id), [data]);
  const allChecked = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
  const indeterminate = selectedIds.length > 0 && !allChecked;

  function toggleSelectAllPage(checked: boolean) {
    if (checked) {
      // รวม id ที่ยังไม่ได้เลือก + ของหน้านี้
      const merged = Array.from(new Set([...selectedIds, ...pageIds]));
      setSelectedIds(merged);
    } else {
      // ลบ id ของหน้านี้ออกจาก selections
      const remain = selectedIds.filter(id => !pageIds.includes(id));
      setSelectedIds(remain);
    }
  }
  function toggleOne(id: number, checked: boolean) {
    if (checked) setSelectedIds(prev => Array.from(new Set([...prev, id])));
    else setSelectedIds(prev => prev.filter(x => x !== id));
  }

  async function load(){
    setLoading(true);
    try{
      const res = await fetchLogs({ q, level, category, page, pageSize });
      setData(res.items || []); setTotal(res.total || 0);
      // เคลียร์ selections ที่ไม่อยู่ในผลลัพธ์แล้ว (กันค้าง)
      setSelectedIds(prev => prev.filter(id => (res.items || []).some((x:LogRow)=> x.id === id)));
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

  async function bulkDeleteSelected() {
    if (!selectedIds.length) return;
    try {
      const j = await deleteLogsByIds(selectedIds);
      message.success(`Deleted ${j.deleted ?? selectedIds.length} logs`);
      setSelectedIds([]);
      load();
    } catch (e:any) {
      message.error(e.message || 'Bulk delete failed');
    }
  }

  return (
    <Card
      title="System Logs"
      extra={
        <Space wrap>
          <Input.Search placeholder="Search text" onSearch={(val)=>{ setPage(1); setQ(val); }} allowClear enterButton />
          <Select
            allowClear
            placeholder="Level"
            style={{ width: 140 }}
            value={level}
            onChange={(v)=>{ setPage(1); setLevel(v); }}
            options={[ 'debug','info','warn','error' ].map(v=>({ value: v, label: v }))}
          />
          <Input
            placeholder="Category"
            allowClear
            style={{ width: 200 }}
            value={category}
            onChange={(e)=> { setPage(1); setCategory(e.target.value||undefined); }}
          />
          <Button onClick={addTest}>Add test</Button>
          <Popconfirm title="Delete logs by current filters?" onConfirm={purgeByFilter}>
            <Button danger>Purge by filter</Button>
          </Popconfirm>

          {/* NEW: select-all (current page) + bulk delete */}
          <Checkbox
            indeterminate={indeterminate}
            checked={allChecked}
            onChange={e => toggleSelectAllPage(e.target.checked)}
          >
            Select page
          </Checkbox>
          <Popconfirm
            title={`Delete ${selectedIds.length} selected log(s)?`}
            onConfirm={bulkDeleteSelected}
            okButtonProps={{ danger:true }}
            disabled={!selectedIds.length}
          >
            <Button danger disabled={!selectedIds.length}>
              Delete selected ({selectedIds.length})
            </Button>
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
        // renderItem={(item)=>{
        //   const checked = selectedIds.includes(item.id);
        //   return (
        //     <List.Item
        //       key={item.id}
        //       actions={[
        //         <span key="time">{new Date(item.created_at).toLocaleString()}</span>,
        //         <span key="cat"><Tag>{item.category}</Tag></span>,
        //       ]}
        //       extra={
        //         // NEW: checkbox per row
        //         <Checkbox checked={checked} onChange={e => toggleOne(item.id, e.target.checked)} />
        //       }
        //     >
        //       <List.Item.Meta
        //         avatar={levelTag(item.level)}
        //         title={
        //           <Space split={<Divider type="vertical" />} wrap>
        //             <span>#{item.id}</span>
        //             {/* NEW: link to detail page */}
        //             <Link href={`/admin/logs/${item.id}`}><strong>{item.message}</strong></Link>
        //           </Space>
        //         }
        //         description={
        //           <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }} className="text-xs">
        //             {JSON.stringify(item.meta || {}, null, 2)}
        //           </pre>
        //         }
        //       />
        //     </List.Item>
        //   );
        // }}

        renderItem={(item)=>{
          const checked = selectedIds.includes(item.id);
          return (
            <List.Item
              key={item.id}
              actions={[
                <span key="time">{new Date(item.created_at).toLocaleString()}</span>,
                <span key="cat"><Tag>{item.category}</Tag></span>,
              ]}
            >
              <Space align="start" style={{ width: '100%' }}>
                {/* ✅ Checkbox ด้านหน้า */}
                <Checkbox
                  checked={checked}
                  onChange={e => toggleOne(item.id, e.target.checked)}
                  style={{ marginTop: 4 }}
                />

                {/* เนื้อหาหลัก */}
                <List.Item.Meta
                  avatar={levelTag(item.level)}
                  title={
                    <Space split={<Divider type="vertical" />} wrap>
                      <span>#{item.id}</span>
                      <Link href={`/admin/logs/${item.id}/view`}>
                        <strong>{item.message}</strong>
                      </Link>
                    </Space>
                  }
                  description={
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }} className="text-xs">
                      {JSON.stringify(item.meta || {}, null, 2)}
                    </pre>
                  }
                />
              </Space>
            </List.Item>
          );
        }}

      />
    </Card>
  );
}
