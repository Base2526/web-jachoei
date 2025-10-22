'use client';
import { gql, useQuery, useMutation } from "@apollo/client";
import { useParams, useRouter } from "next/navigation";
import { Form, Input, Select, Button, Card, message, Skeleton } from "antd";
import { useEffect } from "react";

const GET_POST = gql`
  query One($id: ID!) {
    post(id:$id){ id title body image_url phone status }
  }
`;
const UPSERT = gql`
  mutation Upsert($id: ID, $data: PostInput!) {
    upsertPost(id: $id, data: $data) { id title }
  }
`;

export default function EditPage(){
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const [form] = Form.useForm();

  const { data, loading:loadingQ } = useQuery(GET_POST, { variables:{ id } });
  const [save, { loading:loadingM }] = useMutation(UPSERT);

  useEffect(()=>{
    if (data?.post) form.setFieldsValue(data.post);
  }, [data, form]);

  const onFinish = async (v:any)=>{
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    await save({
      variables:{ id, data: v },    // ⬅️ มี id = edit
      context:{ headers:{ authorization: token ? `Bearer ${token}` : '' } }
    });
    message.success("Updated");
    router.push("/");
  };

  return (
    <Card title={`Edit Post`} style={{maxWidth:720}}>
      {loadingQ ? <Skeleton active paragraph={{rows:6}}/> : (
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Form.Item name="title" label="Title" rules={[{required:true}]}><Input/></Form.Item>
          <Form.Item name="body" label="Body" rules={[{required:true}]}><Input.TextArea rows={4}/></Form.Item>
          <Form.Item name="image_url" label="Image URL"><Input/></Form.Item>
          <Form.Item name="phone" label="Phone"><Input/></Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={[{value:'public',label:'public'},{value:'unpublic',label:'unpublic'}]}/>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loadingM}>Save changes</Button>
        </Form>
      )}
    </Card>
  );
}
