'use client';
import { gql, useMutation } from "@apollo/client";
import { Form, Input, Select, Button, Card, message } from "antd";
import { useRouter } from "next/navigation";

const UPSERT = gql`mutation ($data: PostInput!){ upsertPost(data:$data){ id title } }`;

function CreateForm(){
  const [form] = Form.useForm();
  const router = useRouter();
  const [save,{ loading }] = useMutation(UPSERT);
  const onFinish = async (v:any)=>{
    await save({ variables:{ id: null, data:v }});
    message.success("Created");
    router.push("/");

    // const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    // await save({
    //   variables:{ data:v },
    //   context: {
    //     headers: {
    //       authorization: token ? `Bearer ${token}` : ''
    //     }
    //   }
    // });
    // message.success("Created");
    // router.push("/");
  };
  return <Card title="New Post" style={{maxWidth:720}}>
    <Form layout="vertical" form={form} onFinish={onFinish} initialValues={{ status:'public' }}>
      <Form.Item name="title" label="Title" rules={[{required:true}]}><Input/></Form.Item>
      <Form.Item name="body" label="Body" rules={[{required:true}]}><Input.TextArea rows={4}/></Form.Item>
      <Form.Item name="image_url" label="Image URL"><Input/></Form.Item>
      <Form.Item name="phone" label="Phone"><Input/></Form.Item>
      <Form.Item name="status" label="Status"><Select options={[{value:'public'},{value:'unpublic'}]}/></Form.Item>
      <Button type="primary" htmlType="submit" loading={loading}>Save</Button>
    </Form>
  </Card>;
}

export default function Page(){
  return <CreateForm/>;
}
