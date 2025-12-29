'use client';
import { Card, Row, Col, Statistic, Space, Button, Badge, Typography, Table, Tag, Image } from 'antd';
import { UserOutlined, FileTextOutlined, FileImageOutlined, DatabaseOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { gql, useQuery } from '@apollo/client';
import ThumbGrid from '@/components/ThumbGrid';

const { Title } = Typography;

// ดึงรวม count + pending
/*
 pending {
      posts_awaiting_approval
      users_pending_invite
      files_unclassified
      errors_last24h
    }
*/
const Q_DASH = gql`
  query {
    stats { users posts files logs }
   
    latestPosts(limit:5){ id title status created_at images { id url } }
    latestUsers(limit:5){ id name email role created_at avatar }
  }
`;

export default function AdminDashboard() {
  const { data, loading, refetch } = useQuery(Q_DASH);
  const s = data?.stats ?? { users:0, posts:0, files:0, logs:0 };
  const p = data?.pending ?? { posts_awaiting_approval:0, users_pending_invite:0, files_unclassified:0, errors_last24h:0 };
  // const { admin: adminSession, isAuthenticated, loading: sessionLoading } = useSession()
  const quick = [
    { href:'/admin/posts',  text:'Posts', icon:<FileTextOutlined/>, badge: 2/*p.posts_awaiting_approval*/  },
    { href:'/admin/users',  text:'Users', icon:<UserOutlined/>,  badge: 1/*p.users_pending_invite */ },
    { href:'/admin/files',  text:'Files', icon:<FileImageOutlined/>, badge: 2/* p.files_unclassified */ },
    { href:'/admin/logs',   text:'Logs',  icon:<DatabaseOutlined/>, badge: 1/*p.errors_last24h*/  },
  ];

  // useEffect(()=>{
  //   if(!sessionLoading) console.log('[useSession-admin]', adminSession, isAuthenticated, sessionLoading);
  // }, [sessionLoading, adminSession, isAuthenticated]);

  // useEffect(()=>{
  //   console.log("[data]", data, data?.latestPosts);
  // }, [data])

  return (
    <>
      <Row gutter={[16,16]} style={{ marginTop:12 }}>
         <Col xs={24} sm={12} md={6}>
          <Link href="/admin/posts">
            <Card hoverable>
              <Space style={{ width:'100%', justifyContent:'space-between' }}>
                <Statistic title="Total Posts" value={s.posts} prefix={<FileTextOutlined/>}/>
                <Badge count={p.posts_awaiting_approval} style={{ backgroundColor:'#52c41a' }}/>
              </Space>
            </Card>
          </Link>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Link href="/admin/users">
            <Card hoverable>
              <Space style={{ width:'100%', justifyContent:'space-between' }}>
                <Statistic title="Total Users" value={s.users} prefix={<UserOutlined/>}/>
                <Badge count={p.users_pending_invite} style={{ backgroundColor:'#108ee9' }}/>
              </Space>
            </Card>
          </Link>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Link href="/admin/files">
            <Card hoverable>
              <Space style={{ width:'100%', justifyContent:'space-between' }}>
                <Statistic title="Files" value={s.files} prefix={<FileImageOutlined/>}/>
                <Badge count={p.files_unclassified}/>
              </Space>
            </Card>
          </Link>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Link href="/admin/logs">
            <Card hoverable>
              <Space style={{ width:'100%', justifyContent:'space-between' }}>
                <Statistic title="Logs" value={s.logs} prefix={<DatabaseOutlined/>}/>
                <Badge count={p.errors_last24h} color="red"/>
              </Space>
            </Card>
          </Link>
        </Col>
      </Row> 

      {/* ===== ตัวอย่างกล่องล่าสุด + ปุ่ม View all พร้อม Badge ===== */}
      <Row gutter={[16,16]} style={{ marginTop:24 }}>
        <Col xs={24} md={12}>
          <Card
            title="Latest Posts"
            extra={
              <Badge count={p.posts_awaiting_approval} offset={[10,0]}>
                <Link href="/admin/posts">View all</Link>
              </Badge>
            }
          >
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={data?.latestPosts}
              columns={[
                { title:'Images', dataIndex:'images', render:(imgs:any)=><ThumbGrid images={imgs} width={160} height={110} /> },
                { title: 'Title', // dataIndex: 'title',
                  render: (v: any) => (
                    <a href={`/admin/post/${v.id}/edit`}>{v.title}</a>
                  ),
                },
                { title: 'Author', dataIndex: 'author_name' },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  render: (s: string) => (
                    <Tag color={s === 'pending' ? 'orange' : s === 'public' ? 'green' : 'default'}>{s}</Tag>
                  ),
                },
                {
                  title: 'Created',
                  dataIndex: 'created_at',
                  render: (d: string) => new Date(d).toLocaleString(),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title="Latest Users"
            extra={
              <Badge count={p.users_pending_invite} offset={[10,0]}>
                <Link href="/admin/users">View all</Link>
              </Badge>
            }
          >
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={data?.latestUsers}
              columns={[
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
                // { title: 'Name', dataIndex: 'name' },
                { title: 'Email', dataIndex: 'email' },
                {
                  title: 'Role',
                  dataIndex: 'role',
                  render: (r: string) => <Tag color={r === 'Administrator' ? 'blue' : 'default'}>{r}</Tag>,
                },
                {
                  title: 'Created',
                  dataIndex: 'created_at',
                  render: (d: string) => new Date(d).toLocaleString(),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
