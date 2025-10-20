'use client';
import 'antd/dist/reset.css';
import { Layout } from 'antd';
import React from 'react';
import { ApolloProvider } from "@apollo/client";
import { client } from "lib/apollo"

export default function RootLayout({ children }: { children: React.ReactNode }){
  return (
    <html lang="en"><body>
      <ApolloProvider client={client}>
        <Layout style={{minHeight:'100vh'}}>
          <Layout.Header style={{color:'#fff'}}>Simple Realtime Starter [x]</Layout.Header>
          <Layout.Content style={{padding:24}}>{children}</Layout.Content>
        </Layout>
      </ApolloProvider>
    </body></html>
  );
}
