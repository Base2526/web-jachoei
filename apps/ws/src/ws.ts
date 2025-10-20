import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { typeDefs, resolvers } from "./shared.js";

const schema = makeExecutableSchema({ typeDefs, resolvers });
const PORT = 8080;// Number(process.env.WS_PORT || 8080);
const PATH = "/graphql";// process.env.WS_PATH || "/graphql";

const wss = new WebSocketServer({ port: PORT, path: PATH });
useServer(
    { 
        schema,
        // ปรับ timeout รอ init (มิลลิวินาที) ถ้าต้องการผ่อนปรน
        connectionInitWaitTimeout: 10000,
        // เปิด ping/keepalive (ช่วยกัน idle disconnect)
        // keepAlive: 12000,
    }, 
    wss
);

console.log(`[WS] graphql-ws running at ws://0.0.0.0:${PORT}${PATH}`);
