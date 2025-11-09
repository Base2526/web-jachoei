'use client';
import 'antd/dist/reset.css';
import React, { useEffect, useState, useMemo} from "react";
import { ApolloProvider } from "@apollo/client";
import { client } from "lib/apollo"

// import { getStoredUser, type StoredUser } from "@/utils/storage";
import GlobalChatSub from "@/components/GlobalChatSub";
import { SessionProvider, useSessionCtx } from '@/lib/session-context';
// import { useSession } from '@/lib/useSession'

function GlobalWires() {
  const { user, admin } = useSessionCtx();
  const meId = user?.id?.toString() || admin?.id?.toString() || '';

  useEffect(() => {
    const frontendLogout = () => {
      console.log('soft logout triggered!');
      window.location.href = '/login';
    };
    const backendLogout = () => {
      console.log('soft logout triggered!');
      window.location.href = '/admin/login';
    };

    window.addEventListener('frontend-logout', frontendLogout);
    window.addEventListener('backend-logout', backendLogout);
    return () =>{
      window.removeEventListener('frontend-logout', frontendLogout);
      window.removeEventListener('backend-logout', backendLogout);
    } 
  }, []);

  return meId ? <GlobalChatSub meId={meId} client={client} /> : null;
}

export default function RootLayout({ children }: { children: React.ReactNode }){
  return (
    <html lang="en"><body>
      <ApolloProvider client={client}>
        <SessionProvider>
          <GlobalWires />
          {children}
        </SessionProvider>
      </ApolloProvider>
    </body></html>
  );
}
