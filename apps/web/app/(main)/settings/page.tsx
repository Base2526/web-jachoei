'use client';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Layout, Menu, Card, Form, Input, Button, Switch, Upload, Avatar,
  Select, message, Space, Typography, Divider, List, Popconfirm, Tag, Table
} from 'antd';
import {
  MenuUnfoldOutlined, MenuFoldOutlined, UserOutlined, LockOutlined,
  BellOutlined, SettingOutlined, CloudUploadOutlined, LogoutOutlined,
  FileImageOutlined, FileOutlined, DeleteOutlined, EditOutlined, DownloadOutlined,
  DatabaseOutlined, FileTextOutlined, TeamOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import { gql, useQuery, useMutation } from "@apollo/client";

const { Header, Sider, Content } = Layout;

type MenuKey = 'profile' | 'security' | 'notifications' | 'account' | 'files' | 'logs' | 'posts' | 'users';

type FileRow = {
  id: number;
  filename: string;
  original_name: string | null;
  mimetype: string | null;
  size: number;
  checksum: string;
  relpath: string;
  created_at: string;
  updated_at: string;
};

type LogRow = {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error' | string;
  category: string;
  message: string;
  meta: any;
  created_by: number | null;
  created_at: string;
};

// ===== Users (GraphQL) =====
const Q_USERS = gql`query($search:String){ users(search:$search){ id name email phone role created_at avatar } }`;
const Q_USER  = gql`query($id:ID!){ user(id:$id){ id name email phone avatar role } }`;
const M_DELETE_USER = gql`mutation($id:ID!){ deleteUser(id:$id) }`;
const M_UPSERT_USER = gql`
mutation($id:ID, $data:UserInput!){
  upsertUser(id:$id, data:$data){ id }
}`;

// sha256 for optional password handling
async function sha256Hex(input: string) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function UsersPanel(){
  const [mode, setMode] = useState<'list'|'new'|'edit'>('list');
  const [editId, setEditId] = useState<string>('');

  return (
    <div>
      {mode==='list' && <UsersList onNew={()=>setMode('new')} onEdit={(id)=>{ setEditId(id); setMode('edit'); }} />}
      {mode==='new'  && <UserFormNew onBack={()=>setMode('list')} />}
      {mode==='edit' && <UserFormEdit id={editId} onBack={()=>setMode('list')} />}
    </div>
  );
}

function UsersList({ onNew, onEdit }:{ onNew: ()=>void; onEdit:(id:string)=>void; }){
  const [search, setSearch] = useState('');
  const { data, refetch } = useQuery(Q_USERS, { variables:{ search:'' } });
  const [doDelete] = useMutation(M_DELETE_USER);

  const cols = [
    { title:'Name', dataIndex:'name' },
    { title:'Email', dataIndex:'email' },
    { title:'Phone', dataIndex:'phone' },
    { title:'Role', dataIndex:'role', render:(r:string)=><Tag>{r}</Tag> },
    { title:'Actions', render: (_:any, r:any)=>(
      <Space>
        <a onClick={()=> onEdit(String(r.id))}>edit</a>
        <Popconfirm title="Delete this user?" onConfirm={async ()=>{
          const res = await doDelete({ variables:{ id: r.id }});
          if(res.data?.deleteUser){ message.success('Deleted'); refetch(); } else { message.error('Delete failed'); }
        }}>
          <a>delete</a>
        </Popconfirm>
      </Space>
    )}
  ];

  return (
    <Card title="Users" extra={
      <Space>
        <Input.Search placeholder="Search name/email/phone" onSearch={(q)=>refetch({ search:q })} allowClear enterButton />
        <Button type="primary" onClick={onNew}>+ New User</Button>
      </Space>
    }>
      <Table rowKey="id" dataSource={data?.users||[]} columns={cols as any} />
    </Card>
  );
}

function UserFormNew({ onBack }:{ onBack:()=>void }){
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [upsert] = useMutation(M_UPSERT_USER);

  async function onFinish(values:any){
    try{
      setLoading(true);
      const { name, email, phone, avatar, role, password } = values;
      const data:any = { name, email, phone, avatar, role };
      if(password){ data.password_hash = await sha256Hex(password); }
      const res = await upsert({ variables:{ data } });
      if(res.data?.upsertUser?.id){ message.success('User created'); onBack(); }
      else message.error('Create failed');
    }finally{ setLoading(false); }
  }

  return (
    <Card title={<Space><Button icon={<ArrowLeftOutlined/>} onClick={onBack} /> <span>New User</span></Space>}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="name" label="Name" rules={[{ required:true }]}><Input /></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required:true, type:'email' }]}><Input /></Form.Item>
        <Form.Item name="phone" label="Phone"><Input /></Form.Item>
        <Form.Item name="avatar" label="Avatar URL"><Input /></Form.Item>
        <Form.Item name="role" label="Role" initialValue="Subscriber" rules={[{ required: true }]}>
          <Select options={[
            {value:'Subscriber', label:'Subscriber'},
            {value:'Author', label:'Author'},
            {value:'Administrator', label:'Administrator'},
          ]} />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required:true, min:8 }]}><Input.Password /></Form.Item>
        <Form.Item
          name="confirm"
          label="Confirm Password"
          dependencies={['password']}
          rules={[
            { required:true },
            ({ getFieldValue }) => ({
              validator(_, v) {
                if (!v || getFieldValue('password') === v) return Promise.resolve();
                return Promise.reject(new Error('Passwords do not match'));
              },
            }),
          ]}
        >
          <Input.Password />
        </Form.Item>

        <Space>
          <Button icon={<ArrowLeftOutlined/>} onClick={onBack}>Back</Button>
          <Button type="primary" htmlType="submit" loading={loading}>Create</Button>
        </Space>
      </Form>
    </Card>
  );
}

function UserFormEdit({ id, onBack }:{ id:string; onBack:()=>void }){
  const [form] = Form.useForm();
  const { data, loading:loadingQ } = useQuery(Q_USER, { variables:{ id } });
  const [upsert] = useMutation(M_UPSERT_USER);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    const u = data?.user;
    if(u){
      form.setFieldsValue({ name:u.name, email:u.email, phone:u.phone, avatar:u.avatar, role:u.role });
    }
  }, [data, form]);

  async function onFinish(values:any){
    try{
      setLoading(true);
      const { name, phone, avatar, role, password } = values;
      const data:any = { name, phone, avatar, role };
      if(password){ data.password_hash = await sha256Hex(password); }
      const res = await upsert({ variables:{ id, data } });
      if(res.data?.upsertUser?.id){ message.success('Saved'); onBack(); }
      else message.error('Save failed');
    }finally{ setLoading(false); }
  }

  return (
    <Card title={<Space><Button icon={<ArrowLeftOutlined/>} onClick={onBack} /> <span>Edit User</span></Space>}>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="name" label="Name" rules={[{ required:true }]}><Input /></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required:true, type:'email' }]}><Input disabled /></Form.Item>
        <Form.Item name="phone" label="Phone"><Input /></Form.Item>
        <Form.Item name="avatar" label="Avatar URL"><Input /></Form.Item>
        <Form.Item name="role" label="Role" rules={[{ required: true }]}>
          <Select options={[
            {value:'Subscriber', label:'Subscriber'},
            {value:'Author', label:'Author'},
            {value:'Administrator', label:'Administrator'},
          ]} />
        </Form.Item>
        <Form.Item name="password" label="New Password" tooltip="ใส่เมื่ออยากเปลี่ยน">
          <Input.Password />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="Confirm New Password"
          dependencies={['password']}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, v) {
                if (!getFieldValue('password') || getFieldValue('password') === v) return Promise.resolve();
                return Promise.reject(new Error('Passwords do not match'));
              },
            }),
          ]}
        >
          <Input.Password />
        </Form.Item>

        <Space>
          <Button icon={<ArrowLeftOutlined/>} onClick={onBack}>Back</Button>
          <Button type="primary" htmlType="submit" loading={loading}>Save</Button>
        </Space>
      </Form>
    </Card>
  );
}

// ===== My Posts (optional, keep if present) =====
const Q_MY_POSTS = gql`query($q:String){ myPosts(search:$q){ id title phone status created_at } }`;
const MUT_DEL_POST = gql`mutation($id:ID!){ deletePost(id:$id) }`;

function PostsPanel(){
  const [q, setQ] = useState('');
  const { data, refetch } = useQuery(Q_MY_POSTS,{ variables:{ q:'' } });
  const [doDel] = useMutation(MUT_DEL_POST);

  const cols = [
    { title:'Title', dataIndex:'title' },
    { title:'Phone', dataIndex:'phone' },
    { title:'Status', dataIndex:'status', render:(s:string)=><Tag color={s==='public'?'green':'red'}>{s}</Tag> },
    { title:'Action', render:(_:any,r:any)=>(
        <Space>
          <a href={`/post/${r.id}/edit`}>edit</a>
          <a onClick={()=>{
            if(confirm('Delete this post?')){
              (async ()=>{
                const res = await doDel({ variables:{ id: r.id } });
                if (res.data?.deletePost) { message.success('Deleted'); refetch(); }
                else message.error('Delete failed');
              })();
            }
          }}>delete</a>
          <a href={`/post/${r.id}/view`}>view</a>
        </Space>
      )
    }
  ];

  return (
    <Card title="My Posts" extra={
      <Space>
        <Input placeholder="Search title/phone" value={q} onChange={e=>setQ(e.target.value)} />
        <Button onClick={()=>refetch({ q })}>Search</Button>
        <Button type="primary"><a href="/post/new" style={{color:'#fff'}}>+ New Post</a></Button>
      </Space>
    }>
      <Table rowKey="id" dataSource={data?.myPosts||[]} columns={cols as any} />
    </Card>
  );
}

// ===== Files & Logs helpers =====
async function fetchList(q:string, page:number, pageSize:number){
  const url = `/api/files?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`;
  const res = await fetch(url, { cache:'no-store' });
  if(!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

async function fetchLogs(params: { q?: string; level?: string; category?: string; page: number; pageSize: number; }){
  const qs = new URLSearchParams();
  if(params.q) qs.set('q', params.q);
  if(params.level) qs.set('level', params.level);
  if(params.category) qs.set('category', params.category);
  qs.set('page', String(params.page));
  qs.set('pageSize', String(params.pageSize));
  const res = await fetch('/api/logs?' + qs.toString(), { cache: 'no-store' });
  if(!res.ok) throw new Error('Failed to load logs');
  return res.json();
}

export default function SettingsPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState<MenuKey>('profile');
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  const items = [
    { key: 'profile', icon: <UserOutlined />, label: 'Profile' },
    { key: 'account', icon: <SettingOutlined />, label: 'Account' },
    { key: 'posts', icon: <FileTextOutlined />, label: 'My Posts' },
    // { key: 'users', icon: <TeamOutlined />, label: 'Users' },
    { key: 'security', icon: <LockOutlined />, label: 'Security' },
    { key: 'notifications', icon: <BellOutlined />, label: 'Notifications' },
    // { key: 'files', icon: <FileImageOutlined />, label: 'Files' },
    // { key: 'logs', icon: <DatabaseOutlined />, label: 'Logs' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sider Menu */}
      <Sider
        width={240}
        collapsedWidth={0}
        collapsible
        collapsed={collapsed}
        trigger={null}
        breakpoint="lg"
        style={{ background: 'transparent', borderRight: '1px solid #f0f0f0' }}
      >
        <Card style={{ padding: 0 }}>
          <Menu
            mode="inline"
            selectedKeys={[active]}
            items={items}
            onClick={(e) => setActive(e.key as MenuKey)}
          />
        </Card>
      </Sider>

      <Layout>

        <Content style={{ paddingLeft: 10, background: '#fff' }}>
          {active === 'profile' && (
            <Card title="Profile Settings" style={{ maxWidth: 720 }}>
              <Space align="start" size="large">
                <Avatar size={96} src={avatarUrl} icon={<UserOutlined />} />
                <div>
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      const reader = new FileReader();
                      reader.onload = () => setAvatarUrl(String(reader.result));
                      reader.readAsDataURL(file);
                      message.success('Preview updated');
                      return false;
                    }}
                  >
                    <Button icon={<CloudUploadOutlined />}>Upload Avatar</Button>
                  </Upload>
                </div>
              </Space>

              <Divider />

              <Form
                layout="vertical"
                initialValues={{ name: 'Alice Example', phone: '080-000-0001', language: 'en' }}
                onFinish={() => message.success('Profile saved')}
              >
                <Form.Item name="name" label="Display name" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="phone" label="Phone">
                  <Input />
                </Form.Item>
                <Form.Item name="language" label="Language">
                  <Select
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'th', label: 'ไทย' },
                    ]}
                  />
                </Form.Item>
                <Button type="primary" htmlType="submit">
                  Save changes
                </Button>
              </Form>
            </Card>
          )}

          {active === 'account' && (
            <Card title="Account" style={{ maxWidth: 720 }}>
              <Form
                layout="vertical"
                initialValues={{ email: 'alice@example.com', username: 'alice' }}
                onFinish={() => message.success('Account updated')}
              >
                <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Button type="primary" htmlType="submit">
                  Update
                </Button>
              </Form>
            </Card>
          )}

          {active === 'security' && (
            <Card title="Security" style={{ maxWidth: 720 }}>
              <Form layout="vertical" onFinish={() => message.success('Password changed')}>
                <Form.Item name="current" label="Current password" rules={[{ required: true }]}>
                  <Input.Password />
                </Form.Item>
                <Form.Item name="new" label="New password" rules={[{ required: true, min: 8 }]}>
                  <Input.Password />
                </Form.Item>
                <Form.Item
                  name="confirm"
                  label="Confirm new password"
                  dependencies={['new']}
                  rules={[
                    { required: true },
                    ({ getFieldValue }) => ({
                      validator(_, v) {
                        if (!v || getFieldValue('new') === v) return Promise.resolve();
                        return Promise.reject(new Error('Passwords do not match'));
                      },
                    }),
                  ]}
                >
                  <Input.Password />
                </Form.Item>
                <Button type="primary" htmlType="submit">
                  Change Password
                </Button>
              </Form>
            </Card>
          )}

          {active === 'notifications' && (
            <Card title="Notifications" style={{ maxWidth: 720 }}>
              <Form
                layout="vertical"
                initialValues={{ email: true, push: true }}
                onFinish={() => message.success('Notifications updated')}
              >
                <Form.Item label="Email Notifications" name="email" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item label="Push Notifications" name="push" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Button type="primary" htmlType="submit">
                  Save
                </Button>
              </Form>
            </Card>
          )}

          {active === 'users' && <UsersPanel />}
          {active === 'posts' && <PostsPanel />}
          {active === 'files' && <FilesPanel />}
          {active === 'logs' && <LogsPanel />}
        </Content>
      </Layout>
    </Layout>
  );
}

function isImage(m?: string | null){
  return !!m && m.toLowerCase().startsWith('image/');
}

function fmtSize(n: number){
  if(n < 1024) return n + ' B';
  if(n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
  return (n/1024/1024).toFixed(1) + ' MB';
}

function FilesPanel(){
  const [q,setQ] = useState('');
  const [data,setData] = useState<FileRow[]>([]);
  const [total,setTotal] = useState(0);
  const [page,setPage] = useState(1);
  const [pageSize,setPageSize] = useState(20);
  const [loading,setLoading] = useState(false);

  async function load(){
    setLoading(true);
    try{
      const res = await fetchList(q, page, pageSize);
      setData(res.items); setTotal(res.total);
    }catch(e:any){
      message.error(e.message||'Load failed');
    }finally{ setLoading(false); }
  }
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [q,page,pageSize]);

  function onUploaded(info:any){
    if(info.file.status === 'done'){ message.success('Uploaded'); load(); }
    else if(info.file.status === 'error'){ message.error('Upload failed'); }
  }

  async function delFile(id:number){
    const res = await fetch(`/api/files/${id}`, { method:'DELETE' });
    if(res.ok){ message.success('Deleted'); load(); } else { message.error('Delete failed'); }
  }
  async function renameFile(r:FileRow){
    const name = prompt('Rename to:', r.filename);
    if(!name) return;
    const res = await fetch(`/api/files/${r.id}`, {
      method:'PATCH', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ name })
    });
    if(res.ok){ message.success('Renamed'); load(); } else { message.error('Rename failed'); }
  }

  return (
    <Card title="Files" extra={
      <Space>
        <Input.Search placeholder="Search name" onSearch={setQ} allowClear enterButton />
        <Upload name="file" action="/api/files" onChange={onUploaded} showUploadList={false}>
          <Button icon={<CloudUploadOutlined/>}>Upload</Button>
        </Upload>
      </Space>
    }>
      <List
        loading={loading}
        itemLayout="horizontal"
        dataSource={data}
        rowKey={(x)=> String(x.id)}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange:(p,ps)=>{ setPage(p); setPageSize(ps); },
        }}
        renderItem={(item)=>{
          const thumbSrc = isImage(item.mimetype)
            ? `/api/files/${item.id}`
            : undefined;
          return (
            <List.Item
              actions={[
                <a key="dl" href={`/api/files/${item.id}?dl=1`}><DownloadOutlined/> Download</a>,
                <a key="ed" onClick={()=> renameFile(item)}><EditOutlined/> Rename</a>,
                <Popconfirm key="rm" title="Delete this file?" onConfirm={()=> delFile(item.id)}>
                  <a><DeleteOutlined/> Delete</a>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  thumbSrc
                    ? <img src={thumbSrc} alt={item.original_name||item.filename} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                    : <Avatar shape="square" size={56} icon={<FileOutlined/>} />
                }
                title={<Space split={<Divider type="vertical" />} wrap>
                  <span>{item.original_name || item.filename}</span>
                  {isImage(item.mimetype) && <Tag>image</Tag>}
                  {!!item.mimetype && !isImage(item.mimetype) && <Tag>{item.mimetype}</Tag>}
                </Space>}
                description={<Space size="small" wrap>
                  <span>{fmtSize(item.size)}</span>
                  <span>•</span>
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                </Space>}
              />
            </List.Item>
          );
        }}
      />
    </Card>
  );
}

function levelTag(level: string){
  const color =
    level === 'error' ? 'red' :
    level === 'warn' ? 'orange' :
    level === 'info' ? 'blue' :
    level === 'debug' ? 'default' : 'default';
  return <Tag color={color}>{level}</Tag>;
}

function LogsPanel(){
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
    const res = await fetch('/api/logs', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ level: 'info', category: 'settings', message: 'Test log from Settings > Logs' })
    });
    if(res.ok){ message.success('Created'); load(); } else { message.error('Create failed'); }
  }

  async function purgeByFilter(){
    const qs = new URLSearchParams();
    if(level) qs.set('level', level);
    if(category) qs.set('category', category);
    if(q) qs.set('q', q);
    const res = await fetch('/api/logs?' + qs.toString(), { method: 'DELETE' });
    const j = await res.json();
    if(res.ok){ message.success(`Deleted ${j.deleted} logs`); load(); } else { message.error(j.error||'Purge failed'); }
  }

  return (
    <Card title="System Logs" extra={
      <Space wrap>
        <Input.Search placeholder="Search text" onSearch={setQ} allowClear enterButton />
        <Select allowClear placeholder="Level" style={{ width: 140 }}
          onChange={setLevel} options={[ 'debug','info','warn','error' ].map(v=>({ value: v, label: v }))} />
        <Input placeholder="Category" allowClear style={{ width: 200 }} onChange={(e)=> setCategory(e.target.value||undefined)} />
        <Button onClick={addTest}>Add test</Button>
        <Popconfirm title="Delete logs by current filters?" onConfirm={purgeByFilter}>
          <Button danger>Purge by filter</Button>
        </Popconfirm>
      </Space>
    }>
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
                title={<Space split={<Divider type="vertical" />} wrap>
                  <span>#{item.id}</span>
                  <strong>{item.message}</strong>
                </Space>}
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
