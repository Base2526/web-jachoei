'use client';
import { Card, Form, Input, Button, message } from 'antd';
import { gql, useMutation } from '@apollo/client';

const MUT_REQ = gql`
  mutation RequestPasswordReset($email:String!){
    requestPasswordReset(email:$email)
  }
`;

export default function ForgotPage(){
  const [mut, { loading }] = useMutation(MUT_REQ);

  const onFinish = async (values:{ email:string })=>{
    try{
      const res = await mut({ variables:{ email: values.email }});
      if(res.data?.requestPasswordReset){
        message.success('ถ้าอีเมลนี้อยู่ในระบบ เราจะส่งลิงก์สำหรับเปลี่ยนรหัสผ่านให้ภายในไม่กี่นาที');
      }else{
        message.success('ถ้าอีเมลนี้อยู่ในระบบ เราจะส่งลิงก์สำหรับเปลี่ยนรหัสผ่านให้ภายในไม่กี่นาที');
      }
    }catch(e:any){
      message.error(e.message||'เกิดข้อผิดพลาด');
    }
  };

  return (
    <div style={{ display:'flex', justifyContent:'center', padding: '40px 16px' }}>
      <Card title="Forgot Password" style={{ width:400 }}>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label="Email" rules={[{ required:true, type:'email' }]}>
            <Input placeholder="you@example.com"/>
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Send reset link
          </Button>
        </Form>
      </Card>
    </div>
  );
}
