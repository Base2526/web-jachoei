'use client';
import { gql, useMutation } from "@apollo/client";
import { Form, Input, Button, Select, Card, Space, message } from "antd";
import { useRouter } from "next/navigation";
import Link from "next/link";

const M_UPSERT = gql`
  mutation($data:PostInput!){
    upsertPost(data:$data){ id }
  }
`;

// ปรับค่า enum ให้ตรงกับ schema ของคุณ
const STATUS_OPTIONS = [
  { value:'public', label:'public' },
  { value:'unpublic', label:'unpublic' },
];

export default function NewPostPage(){
  const router = useRouter();
  const [form] = Form.useForm();
  const [save, { loading }] = useMutation(M_UPSERT);

  async function onFinish(values:any){
    const { title, body, image_url, phone, status } = values;
    const res = await save({ variables:{ data:{ title, body, image_url, phone, status } }});
    if(res.data?.upsertPost?.id){
      message.success('Created');
      router.push('/admin/posts');
    }else{
      message.error('Create failed');
    }
  }

  return (
    <Card title="Add Post" extra={<Link href="/admin/posts">Back to list</Link>}>
      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ status:'public' }}>
        <Form.Item name="title" label="Title" rules={[{ required:true }]}><Input /></Form.Item>
        <Form.Item name="body" label="Body" rules={[{ required:true }]}><Input.TextArea rows={6} /></Form.Item>
        <Form.Item name="image_url" label="Image URL"><Input /></Form.Item>
        <Form.Item name="phone" label="Phone"><Input /></Form.Item>
        <Form.Item name="status" label="Status" rules={[{ required:true }]}>
          <Select options={STATUS_OPTIONS}/>
        </Form.Item>
        <Space>
          <Link href="/admin/posts">Cancel</Link>
          <Button type="primary" htmlType="submit" loading={loading}>Create</Button>
        </Space>
      </Form>
    </Card>
  );
}
