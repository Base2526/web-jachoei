import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { GraphQLError } from "graphql/error";
import { parse, type ExecutionArgs } from "graphql";
import { parse as parseCookie } from "cookie"; 
import jwt from "jsonwebtoken";

import { typeDefs, resolvers } from "./shared.js";
// import { query } from "./db/src/index.js";

const schema = makeExecutableSchema({ typeDefs, resolvers });
const PORT = 8080;// Number(process.env.WS_PORT || 8080);
const PATH = "/graphql";// process.env.WS_PATH || "/graphql";

const USER_COOKIE = "USER_COOKIE";
const JWT_SECRET = process.env.JWT_SECRET || "changeme_secret";

const wss = new WebSocketServer({ port: PORT, path: PATH });
useServer(
    { 
        schema,
        // ปรับ timeout รอ init (มิลลิวินาที) ถ้าต้องการผ่อนปรน
        connectionInitWaitTimeout: 10000,
        // เปิด ping/keepalive (ช่วยกัน idle disconnect)
        // keepAlive: 12000,

        onSubscribe: async (ctx, msg) => {
            /*
            // 1) ดึง token จาก Cookie ก่อน
            const req = ctx.extra.request; // IncomingMessage
            const cookieHeader = req.headers?.cookie || "";
            const cookies = parseCookie(cookieHeader || "");
            let token = cookies[USER_COOKIE] || "";
            */

            const req = ctx.extra.request; // IncomingMessage
            const cookieHeader = req.headers?.cookie || "";
            const cookies = parseCookie(cookieHeader || "");
            const token = cookies[USER_COOKIE] || "";

            try {
                const user = jwt.verify(token, JWT_SECRET);
                if (!user) {
                    return [
                        new GraphQLError("UNAUTHENTICATED", {
                            extensions: { 
                                code: "UNAUTHENTICATED",
                                message: "Token expired or missing.",
                                reason: "No valid Authorization header.",
                            },
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
            } catch (err) {
                console.error("invalid token", err);
            }

            // 1) ดึง token
            // const raw =
            //     (ctx.connectionParams?.Authorization ??
            //     ctx.connectionParams?.authorization ??
            //     "") as string;
            // const token = String(raw).replace(/^Bearer\s+/i, "").trim();

            // console.log("[WebSocketServer][onSubscribe] @2 = ", token);

            /*
            SELECT * FROM users
            WHERE id = $1
            LIMIT 1
            
            */

            // // 2) หา user
            // let user: any = null;
            // if (token) {
            //     const { rows } = await query(
            //     `SELECT u.id, u.name, u.email, u.role
            //     FROM sessions s
            //     JOIN users u ON u.id = s.user_id
            //     WHERE s.token = $1 AND s.expired_at > NOW()
            //     LIMIT 1`,
            //     [token]
            //     );
            //     user = rows[0] || null;
            // }

            // console.log("[WebSocketServer][onSubscribe] = ", token, user);

            // // 3) ถ้าไม่ผ่าน auth -> ส่ง GraphQLError[]
            // if (!user) {
            //     return [
            //         new GraphQLError("UNAUTHENTICATED", {
            //             extensions: { 
            //                 code: "UNAUTHENTICATED",
            //                 message: "Token expired or missing.",
            //                 reason: "No valid Authorization header.",
            //             },
            //         }),
            //     ];
            // }

            // // 4) คืน ExecutionArgs ให้ครบ
            // const execArgs: ExecutionArgs = {
            //     schema,
            //     document: parse(String(msg.payload.query)),
            //     variableValues: (msg.payload as any).variables,
            //     operationName: (msg.payload as any).operationName,
            //     contextValue: { user },
            // };

            // // console.log("[ws-onSubscribe]", execArgs);
            // return execArgs;
        },
    }, 
    wss
);

console.log(`[WS] graphql-ws running at ws://0.0.0.0:${PORT}${PATH}`);
