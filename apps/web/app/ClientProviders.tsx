"use client";

import React from "react";
import { ApolloProvider } from "@apollo/client";
import { client } from "@/lib/apollo";

import { I18nProvider } from "@/lib/i18nContext";
import type { Lang } from "@/i18n";

import { SessionProvider } from "@/lib/session-context";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GlobalChatListener } from "@/components/GlobalChatListener";

import { useSessionCtx } from "@/lib/session-context";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// Component ใช้ useEffect ได้ที่นี่
function GlobalWiresWrapper() {
  const { user, admin } = useSessionCtx();
  const meId = user?.id || admin?.id;

  React.useEffect(() => {
    const frontendLogout = () => (window.location.href = "/login");
    const backendLogout = () => (window.location.href = "/admin/login");

    window.addEventListener("frontend-logout", frontendLogout);
    window.addEventListener("backend-logout", backendLogout);

    return () => {
      window.removeEventListener("frontend-logout", frontendLogout);
      window.removeEventListener("backend-logout", backendLogout);
    };
  }, []);

  return meId ? <GlobalChatListener /> : null;
}

export default function ClientProviders({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return (
    <ApolloProvider client={client}>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <SessionProvider>
          <I18nProvider lang={lang}>
            <GlobalWiresWrapper />
            {children}
          </I18nProvider>
        </SessionProvider>
      </GoogleOAuthProvider>
    </ApolloProvider>
  );
}
