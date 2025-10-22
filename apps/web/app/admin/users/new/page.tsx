'use client';
import { ApolloClient, InMemoryCache, HttpLink, ApolloProvider, gql, useMutation } from "@apollo/client";
import { Card, Form, Input, Select, Button, message } from "antd";
import React from "react";

const M_UPSERT = gql`
mutation($data:UserInput!){
  upsertUser(data:$data){ id }
}
`;

async function sha256Hex(input: string) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function FormNew(){
  const [form] = Form.useForm();
  const watchName = Form.useWatch('name', form);   // 👈 debug helper
  const watchEmail = Form.useWatch('email', form); // 👈 debug helper

  const [save,{loading}] = useMutation(M_UPSERT,{
    onCompleted:()=>{ message.success('Created'); window.location.href='/admin/users'; }
  });

  const onFinish = async (v:any) => {
    const pwd: string = v.password?.trim() || '';
    const pwd2: string = v.confirmPassword?.trim() || '';
    if (!pwd) { message.error('Password is required'); return; }
    if (pwd !== pwd2) { message.error('Confirm password not match'); return; }
    const passwordHash = await sha256Hex(pwd);

    await save({ variables:{ 
      data: {
        name: v.name,
        email: v.email,
        phone: v.phone || null,
        avatar: v.avatar || null,
        role: v.role,
        passwordHash
      }
    }});
  };

  const onFinishFailed = (info:any) => {
    console.warn('[onFinishFailed]', info.errorFields);
    message.error('กรุณากรอกฟิลด์ที่จำเป็นให้ครบ');
  };

  return (
    <Card title="New User" style={{maxWidth:640}}>
      {/* สำคัญ: ไม่มี <form> ซ้อนทับ, ปุ่ม submit อยู่ "ใน" Form, ใช้ htmlType="submit" */}
      <Form
        name="user_new"
        form={form}
        layout="vertical"
        autoComplete="off"
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, message:'Name is required' }]}>
          <Input placeholder="Full name" />
        </Form.Item>

        <Form.Item name="email" label="Email" rules={[{ required: true, message:'Email is required' }, { type: 'email', message:'Invalid email' }]}>
          <Input placeholder="email@example.com" />
        </Form.Item>

        <Form.Item name="phone" label="Phone"><Input /></Form.Item>
        <Form.Item name="avatar" label="Avatar URL"><Input /></Form.Item>

        <Form.Item name="role" label="Role" initialValue="Subscriber" rules={[{ required: true }]}>
          <Select
            options={[
              {value:'Subscriber', label:'Subscriber'},
              {value:'Author', label:'Author'},
              {value:'Administrator', label:'Administrator'},
            ]}
          />
        </Form.Item>

        {/* Password + Confirm */}
        <Form.Item
          name="password"
          label="Password"
          rules={[{ required:true, message:'Please input password' }, { min:8, message:'At least 8 characters' }]}
          hasFeedback
        >
          <Input.Password placeholder="Enter password"/>
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirm Password"
          dependencies={['password']}
          hasFeedback
          rules={[
            { required:true, message:'Please confirm password' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('Confirm password not match'));
              },
            }),
          ]}
        >
          <Input.Password placeholder="Confirm password"/>
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={loading}>Create</Button>
      </Form>

      {/* debug ดูค่าในฟอร์ม */}
      <pre style={{marginTop:16, opacity:.6}}>
        name: {String(watchName || '')} | email: {String(watchEmail || '')}
      </pre>
    </Card>
  );
}

export default function Page(){
  return <FormNew/>;
}
