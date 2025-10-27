'use client';
import 'antd/dist/reset.css';
import React, { useEffect, useState, useMemo} from "react";
import { ApolloProvider } from "@apollo/client";
import { client } from "lib/apollo"

import { getStoredUser, type StoredUser } from "@/utils/storage";
import GlobalChatSub from "@/components/GlobalChatSub";

export default function RootLayout({ children }: { children: React.ReactNode }){

  const user: StoredUser | null = useMemo(() => getStoredUser(), []);
  const [meId, setMeId] = useState<string>("");

  useEffect(() => {
    setMeId(user?.id || "");

    // force-logout event ที่คุณมีอยู่เดิม
    const h = () => {
      console.log("force logout triggered!");
      localStorage.removeItem("token");
      window.location.href = "/login";
    };
    window.addEventListener("force-logout", h);
    return () => window.removeEventListener("force-logout", h);
  }, []);

  useEffect(()=>{
    console.log("[meId]", meId);
  }, [meId])

  return (
    <html lang="en"><body>
      <ApolloProvider client={client}>
        {/* subscriber ทั้งแอป */}
        {meId ? <GlobalChatSub meId={meId} client={client}/> : null}
        {children}
      </ApolloProvider>
    </body></html>
  );
}
