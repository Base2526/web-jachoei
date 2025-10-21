"use client";
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  split,
  from
} from "@apollo/client";

import { setContext } from "@apollo/client/link/context";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";
import { onError } from "@apollo/client/link/error";

function hardLogout() {
  try { localStorage.removeItem("token"); } catch {}
  // แจ้งทั่วแอปว่าโดนบังคับออก
  window.dispatchEvent(new CustomEvent("force-logout"));
  // เคลียร์ cookie ที่เก็บ token ถ้ามี
  document.cookie = "token=; Max-Age=0; path=/";
  // ไปหน้า login
  window.location.href = "/login";
}

// ----------------------------
// HTTP link
// ----------------------------
const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_HTTP, // e.g. "http://localhost:3000/api/graphql"
  fetch,
});

// ----------------------------
// Auth link (เพิ่ม header ทุก request อัตโนมัติ)
// ----------------------------
const authLink = setContext((_, { headers }) => {
  if (typeof window === "undefined") return { headers }; // SSR ไม่มี localStorage

  const token = localStorage.getItem("token");
  return {
    headers: {
      ...headers,
      Authorization: token ? `Bearer ${token}` : "",
    },
  };
});

// -------- Error link (จับหมดอายุ/ไม่มีสิทธิ์)
const errorLink = onError(({ graphQLErrors, networkError }) => {
  // GraphQL error พร้อม code
  if (graphQLErrors?.length) {
    for (const err of graphQLErrors) {
      // @ts-ignore
      if (err?.extensions?.code === "UNAUTHENTICATED") {
        hardLogout();
        return;
      }
    }
  }
  // HTTP network error เช่น 401/403 (กรณีคุณเซ็ตสถานะ)
  // @ts-ignore
  const status = networkError?.statusCode || networkError?.response?.status;
  if (status === 401 || status === 403) {
    hardLogout();
  }
});

// ----------------------------
// WebSocket link (สำหรับ Subscription)
// ----------------------------
const wsLink =
  typeof window !== "undefined"
    ? new GraphQLWsLink(
        createClient({
          url: process.env.NEXT_PUBLIC_GRAPHQL_WS as string, // e.g. "ws://localhost:8081/graphql"
          connectionParams: () => {
            const token = localStorage.getItem("token");
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        })
      )
    : null;

// ----------------------------
// Split link (แยก path สำหรับ WS / HTTP)
// ----------------------------
const link = wsLink
  ? split(
      ({ query }) => {
        const def = getMainDefinition(query);
        return def.kind === "OperationDefinition" && def.operation === "subscription";
      },
      wsLink,
      from([errorLink, authLink, httpLink]) // ⬅️ ใส่ errorLink หน้า auth/http
    )
  : from([errorLink, authLink, httpLink]);

// ----------------------------
// Apollo Client
// ----------------------------
export const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});
