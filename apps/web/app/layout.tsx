'use client';
import 'antd/dist/reset.css';
import { Layout } from 'antd';
import React, { useEffect } from "react";
import { ApolloProvider } from "@apollo/client";
import { client } from "lib/apollo"

export default function RootLayout({ children }: { children: React.ReactNode }){

  useEffect(() => {
    const h = () => {
      console.log("force logout triggered!");
      localStorage.removeItem("token");
      window.location.href = "/login";
    };
    window.addEventListener("force-logout", h);
    return () => window.removeEventListener("force-logout", h);
  }, []);

  return (
    <html lang="en"><body>
      <ApolloProvider client={client}>
        <Layout style={{minHeight:'100vh'}}>
          <Layout.Header style={{color:'#fff'}} onClick={()=>window.location.href = "/"}>Simple Realtime Starter [x]</Layout.Header>
          <Layout.Content style={{padding:24}}>{children}</Layout.Content>
        </Layout>
      </ApolloProvider>
    </body></html>
  );
}
