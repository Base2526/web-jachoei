import { ApolloServer } from "@apollo/server";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import { mergedTypeDefs as typeDefs, mergedResolvers as resolvers } from "@/graphql";

const schema = makeExecutableSchema({ typeDefs, resolvers });

const server = new ApolloServer({
  schema,
  introspection: process.env.NODE_ENV !== "production", // ✅ dev เท่านั้น
  csrfPrevention: false,
});

const handler = startServerAndCreateNextHandler(server, {
  context: async (req) => {
    // const role = req?.cookies?.get?.("role")?.value || "Subscriber";
    // return { role };
    return "Subscriber";
  }
});

export { handler as GET, handler as POST };
