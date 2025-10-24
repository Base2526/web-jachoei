'use client';
import { gql, useQuery, useMutation } from "@apollo/client";
import { Card, Form, Input, Avatar, Button, Space, message, Skeleton } from "antd";
import { useEffect } from "react";

const Q_ME = gql`query { me { id name avatar phone email role created_at } }`;
const MUT  = gql`
  mutation($data: MyProfileInput!){
    updateMyProfile(data: $data){
      id name avatar phone email role created_at
    }
  }
`;

function MyProfileForm(){
  const [form] = Form.useForm();

  const { data, loading: qLoading } = useQuery(Q_ME);
  const [mut, { loading: mLoading }] = useMutation(MUT, {
    update(cache, { data }) {
      const updated = data?.updateMyProfile;
      if (updated) {
        cache.writeQuery({ query: Q_ME, data: { me: updated } });
      }
    }
  });

  const me = data?.me;

  // ✅ อัปเดตค่าในฟอร์มทุกครั้งที่ me เปลี่ยน
  useEffect(() => {
    if (me) {
      form.setFieldsValue({
        name: me.name ?? "",
        phone: me.phone ?? "",
        avatar: me.avatar ?? ""
      });
    } else {
      form.resetFields(); // เผื่อเคสเปลี่ยนผู้ใช้
    }
  }, [me, form]);

  const onFinish = async (vals: any) => {
    await mut({ variables: { data: vals } });
    message.success("Profile updated");
  };

  return (
    <Card title="My Profile" extra={<a href="/chat">Go to Chat</a>}>
      {qLoading ? (
        <Skeleton active />
      ) : (
        <Space align="start" style={{ width:'100%' }}>
          <Avatar size={96} src={me?.avatar} />
          <div style={{ flex: 1 }}>
            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Form.Item label="Email (read-only)">
                <Input value={me?.email} disabled />
              </Form.Item>
              <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please input your name' }]}>
                <Input placeholder="Your name" />
              </Form.Item>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="Phone number" />
              </Form.Item>
              <Form.Item name="avatar" label="Avatar URL">
                <Input placeholder="https://..." />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={mLoading}>Save</Button>
              </Form.Item>
            </Form>
          </div>
        </Space>
      )}
    </Card>
  );
}

export default function Page(){
  return <MyProfileForm/>;
}
