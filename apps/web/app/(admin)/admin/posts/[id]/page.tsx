'use client';
import { gql, useQuery, useMutation } from "@apollo/client";
import { Form, Input, Button, Select, Card, Space, message, Skeleton } from "antd";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

const Q_POST = gql`
  query($id:ID!){
    post(id:$id){ id title body image_url phone status created_at updated_at }
  }
`;
const M_UPSERT = gql`
  mutation($id:ID!, $data:PostInput!){
    upsertPost(id:$id, data:$data){ id }
  }
`;
const STATUS_OPTIONS = [
  { value:'public', label:'public' },
  { value:'unpublic', label:'unpublic' },
];

export default function EditPostPage(){
  const params = useParams();
  const id = String(params?.id);
  const router = useRouter();
  const [form] = Form.useForm();

  const { data, loading } = useQuery(Q_POST, { variables:{ id } });
  const [save, { loading: saving }] = useMutation(M_UPSERT);

  useEffect(()=>{
    const p = data?.post;
    if(p){
      form.setFieldsValue({
        title: p.title, body: p.body, image_url: p.image_url, phone: p.phone, status: p.status
      });
    }
  }, [data, form]);

  async function onFinish(values:any){
    const res = await save({ variables:{ id, data: values }});
    if(res.data?.upsertPost?.id){
      message.success('Saved');
      router.push('/admin/posts');
    }else{
      message.error('Save failed');
    }
  }

  return (
    <Card title="Edit Post" extra={<Link href="/admin/posts">Back to list</Link>}>
      {loading ? <Skeleton active/> : (
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="title" label="Title" rules={[{ required:true }]}><Input /></Form.Item>
          <Form.Item name="body" label="Body" rules={[{ required:true }]}><Input.TextArea rows={6} /></Form.Item>
          <Form.Item name="image_url" label="Image URL"><Input /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required:true }]}>
            <Select options={STATUS_OPTIONS}/>
          </Form.Item>
          <Space>
            <Link href="/admin/posts">Cancel</Link>
            <Button type="primary" htmlType="submit" loading={saving}>Save</Button>
          </Space>
        </Form>
      )}
    </Card>
  );
}
