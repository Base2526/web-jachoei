import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { GraphQLError } from "graphql/error";
import { parse, type ExecutionArgs } from "graphql";

import { typeDefs, resolvers } from "./shared.js";
import { query } from "./db/src/index.js";

// import { pubsub } from "../../packages/realtime/";

import { pubsub } from "../../../packages/realtime/src/pubsub.js";


const schema = makeExecutableSchema({ typeDefs, resolvers });
const PORT = 8080;// Number(process.env.WS_PORT || 8080);
const PATH = "/graphql";// process.env.WS_PATH || "/graphql";

const wss = new WebSocketServer({ port: PORT, path: PATH });

// ✅ ตัวอย่าง ticker ง่าย ๆ - ยิงทุก 1 วินาที
const TOPIC_TIME = "TIME_TICK";
setInterval(() => {
  const now = new Date().toISOString();
  pubsub.publish(TOPIC_TIME, { time: now });
}, 1000);

useServer(
    { 
        schema,
        // ปรับ timeout รอ init (มิลลิวินาที) ถ้าต้องการผ่อนปรน
        connectionInitWaitTimeout: 10000,
        // เปิด ping/keepalive (ช่วยกัน idle disconnect)
        // keepAlive: 12000,

        onSubscribe: async (ctx, msg) => {
            console.log("[ws][onSubscribe]");
            // 1) ดึง token
            const raw =
                (ctx.connectionParams?.Authorization ??
                ctx.connectionParams?.authorization ??
                "") as string;
            const token = String(raw).replace(/^Bearer\s+/i, "").trim();

            // 2) หา user
            let user: any = null;
            if (token) {
                const { rows } = await query(
                `SELECT u.id, u.name, u.email, u.role
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.token = $1 AND s.expired_at > NOW()
                LIMIT 1`,
                [token]
                );
                user = rows[0] || null;
            }

            // 3) ถ้าไม่ผ่าน auth -> ส่ง GraphQLError[]
            if (!user) {
                return [
                new GraphQLError("UNAUTHENTICATED", {
                    extensions: { code: "UNAUTHENTICATED" },
                }),
                ];
            }

            // 4) คืน ExecutionArgs ให้ครบ
            const execArgs: ExecutionArgs = {
                schema,
                document: parse(String(msg.payload.query)),
                variableValues: (msg.payload as any).variables,
                operationName: (msg.payload as any).operationName,
                contextValue: { user },
            };

            // console.log("[ws-onSubscribe]", execArgs);
            return execArgs;
        },
    }, 
    wss
);

console.log(`[WS] graphql-ws running at ws://0.0.0.0:${PORT}${PATH}`);
