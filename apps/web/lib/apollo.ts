// apps/web/lib/apollo.ts
import { ApolloClient, InMemoryCache, split, HttpLink } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";

const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_HTTP,
  fetch,
});

const wsLink =
  typeof window !== "undefined"
    ? new GraphQLWsLink(
        createClient({
          url: process.env.NEXT_PUBLIC_GRAPHQL_WS as string,
          // connectionParams: { Authorization: "Bearer ..." }, // ถ้ามี auth
        })
      )
    : null;

const link = wsLink
  ? split(
      ({ query }) => {
        const def = getMainDefinition(query);
        return def.kind === "OperationDefinition" && def.operation === "subscription";
      },
      wsLink,
      httpLink
    )
  : httpLink;

export const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});
