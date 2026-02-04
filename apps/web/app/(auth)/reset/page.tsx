'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, Form, Input, Button, message } from 'antd';
import { gql, useMutation } from '@apollo/client';

const MUT_RESET = gql`
  mutation ResetPassword($token:String!, $newPassword:String!){
    resetPassword(token:$token, newPassword:$newPassword)
  }
`;

export default function ResetPage(){
  const params = useSearchParams();
  const token = params.get('token') || '';
  const router = useRouter();
  const [mut, { loading }] = useMutation(MUT_RESET);

  const onFinish = async (values:{ password:string; confirm:string })=>{
    if(values.password !== values.confirm){
      message.error('รหัสผ่านไม่ตรงกัน'); return;
    }
    try{
      const res = await mut({ variables:{ token, newPassword: values.password }});
      if(res.data?.resetPassword){
        message.success('เปลี่ยนรหัสผ่านสำเร็จ! ลองล็อกอินใหม่ได้เลย');
        router.push('/login');
      }
    }catch(e:any){
      message.error(e.message||'เกิดข้อผิดพลาด');
    }
  };

  if(!token){
    return <div style={{padding:40}}><i>ไม่พบ token กรุณาตรวจสอบลิงก์ในอีเมลอีกครั้ง</i></div>;
  }

  return (
    <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
      <Card title="Reset Password" style={{ width:420 }}>
        <Form layout="vertical" onSubmitCapture={(e)=>e.preventDefault()} onFinish={onFinish}>
          <Form.Item name="password" label="รหัสผ่านใหม่" rules={[{ required:true, min:8 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="ยืนยันรหัสผ่านใหม่"
            dependencies={['password']}
            rules={[
              { required:true },
              ({getFieldValue})=>({
                validator(_, v){
                  return (!v || getFieldValue('password') === v) ? Promise.resolve() : Promise.reject(new Error('รหัสผ่านไม่ตรงกัน'));
                }
              })
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            เปลี่ยนรหัสผ่าน
          </Button>
        </Form>
      </Card>
    </div>
  );
}
