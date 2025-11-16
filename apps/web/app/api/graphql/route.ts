import { ApolloServer } from "@apollo/server";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { mergedTypeDefs as typeDefs, mergedResolvers as resolvers } from "@/graphql";
import { query } from "@/lib/db"; // <- ฟังก์ชัน query pg ของคุณ

import { verifyAdminSession, verifyUserSession } from '@/lib/auth/server';

const schema = makeExecutableSchema({ typeDefs, resolvers });

const server = new ApolloServer({
  schema,
  introspection: process.env.NODE_ENV !== "production",
  csrfPrevention: false,
});

const handler = startServerAndCreateNextHandler(server, {
  context: async (request:any, res:any) => {
    let scope = request.headers.get('x-scope') || '';
    if (!scope) {
      const ref = request.headers.get('referer') || '';
      if (ref.includes('/admin')) scope = 'admin';
    }
    if (!scope) scope = 'web';
    const admin = verifyAdminSession();
    const user  = verifyUserSession();
    return { scope, admin, user };
  },
});

export { handler as GET, handler as POST };

