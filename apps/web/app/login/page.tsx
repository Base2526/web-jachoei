'use client';
import React from 'react';
import { Card, Radio, Button, Space, message } from "antd";

export default function Page(){
  const [value, setValue] = React.useState('Subscriber');
  return <Card title="Demo Login (Client-side only)">
    <Space direction="vertical">
      <Radio.Group value={value} onChange={e=>setValue(e.target.value)}>
        <Radio value="Subscriber">Subscriber</Radio>
        <Radio value="Author">Author</Radio>
        <Radio value="Administrator">Administrator</Radio>
      </Radio.Group>
      <Button type="primary" onClick={()=>{
        document.cookie = `role=${value}; path=/`;
        message.success(`Role set to ${value}`);
      }}>Set Role</Button>
    </Space>
  </Card>;
}
