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
    const h = () => {
      console.log('force logout triggered!');
      window.location.href = '/login';
    };
    window.addEventListener('force-logout', h);
    return () => window.removeEventListener('force-logout', h);
  }, []);

  return meId ? <GlobalChatSub meId={meId} client={client} /> : null;
}

export default function RootLayout({ children }: { children: React.ReactNode }){
  // const { user, admin } = useSession();
  // const meId = user?.id?.toString() || admin?.id?.toString() || "";

  // useEffect(() => {
  //   const h = () => {
  //     console.log("force logout triggered!");
  //     // ไม่ต้องยุ่งกับ localStorage แล้ว ถ้าใช้ cookie httpOnly
  //     window.location.href = "/login";
  //   };
  //   window.addEventListener("force-logout", h);
  //   return () => window.removeEventListener("force-logout", h);
  // }, []);

  return (
    <html lang="en"><body>
      <ApolloProvider client={client}>
        {/* {meId ? <GlobalChatSub meId={meId} client={client}/> : null}
        {children} */}

        <SessionProvider>
          <GlobalWires />
          {children}
        </SessionProvider>
      </ApolloProvider>
    </body></html>
  );
}
