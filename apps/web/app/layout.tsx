'use client';
import 'antd/dist/reset.css';
import { Layout } from 'antd';
import React from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }){
  return (
    <html lang="en"><body>
      <Layout style={{minHeight:'100vh'}}>
        <Layout.Header style={{color:'#fff'}}>Simple Realtime Starter</Layout.Header>
        <Layout.Content style={{padding:24}}>{children}</Layout.Content>
      </Layout>
    </body></html>
  );
}
