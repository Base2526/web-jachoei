'use client';
import { Card, Form, Input, Button, message, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage(){
  const [loading,setLoading] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin";

  
  async function onFinish(v:any){

    setLoading(true);
    try{
      const res = await fetch("/api/login", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(v),
      });

      console.log("[res]", res, next);
      if(!res.ok){
        const j = await res.json().catch(()=>({error:"Login failed"}));
        message.error(j.error||"Login failed");
        return;
      }
      message.success("Welcome, admin");
      router.replace(next);
    }finally{ setLoading(false); }
  }

  return (
      <Card title="Admin Login" style={{width:420, margin: '0 auto', marginTop: 50 }}>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="Username or Email" rules={[{required:true}]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{required:true}]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Sign in
          </Button>
        </Form>
        <Typography.Paragraph type="secondary" style={{marginTop:8,fontSize:12}}>
          Admin only area — you’ll need Administrator role.
        </Typography.Paragraph>
      </Card>
  );
}
