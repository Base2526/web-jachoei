import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { typeDefs, resolvers } from "./shared.js";

const schema = makeExecutableSchema({ typeDefs, resolvers });
const PORT = Number(process.env.WS_PORT || 8080);
const PATH = process.env.WS_PATH || "/graphql";

const wss = new WebSocketServer({ port: PORT, path: PATH });
useServer({ schema }, wss);

console.log(`[WS] graphql-ws running at ws://0.0.0.0:${PORT}${PATH}`);
