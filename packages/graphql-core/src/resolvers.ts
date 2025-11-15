import { pubsub, dbgPublish } from "../../realtime/src/pubsub.js";

import { withFilter } from "graphql-subscriptions";

const topicChat = (chat_id: string) => `MSG_CHAT_${chat_id}`;
const topicUser = (user_id: string) => `MSG_USER_${user_id}`;

const TOPIC_TIME = "TIME_TICK";

// const pubsub = createPubSub();

// setInterval(() => {
//   const now = new Date().toISOString();

//     console.log("[resolvers][TIME_TICK]", now);
//     pubsub.publish('TIME_TICK', now);
//   }, 5000
// );

console.log('withFilter typeof =', typeof withFilter); 

// // MSG_CHAT_268d2d9f-2242-4751-af50-a7ca8bc9b2ff
// setInterval(() => {
//   const now = new Date().toISOString();
//   dbgPublish('MSG_CHAT_268d2d9f-2242-4751-af50-a7ca8bc9b2ff', { time: now });  // << payload ต้อง match กับ resolve ด้านบน
// }, 10000);

export const coreResolvers: any = {
  Query: { _ok: () => "ok" },
  Mutation: {
    send: async (_: unknown, { text }: { text: string }) => {
      const msg = { id: Date.now().toString(), text, ts: new Date().toISOString() };
      await pubsub.publish('MSG', { messageAdded: msg });

      console.log("[ graphql-core send ]", text);
      return true;
    },
  },
  Subscription: {
    time: {
      // ต้องคืน AsyncIterator เสมอ
      subscribe: () => {
        console.log("[Subscription.time] subscribe");
        return pubsub.asyncIterator(TOPIC_TIME);
      },
      // payload ที่ถูก publish มา → แปลงเป็น String ตาม typeDefs
      resolve: (payload: any) => {
        console.log("[Subscription.time] resolve");
        // กรณี publish เป็น string ตรง ๆ
        if (typeof payload === "string") return payload;
        // กรณี publish เป็น object เช่น { time: "..." }
        if (payload && typeof payload.time === "string") return payload.time;
        return new Date().toISOString();
      },
    },
    messageAdded: {
      subscribe: withFilter(
        (_:any, { chat_id }:{chat_id:string}) =>{
          console.log("[graphql-core withFilter : messageAdded] @1");
          return pubsub.asyncIterator(topicChat(chat_id))
        } ,
        (payload, variables) => {
          console.log("[graphql-core withFilter : messageAdded] ", payload?.messageAdded, variables?.chat_id);
          return payload?.messageAdded?.chat_id === variables?.chat_id;
        }
      )
    },
    userMessageAdded: {
      subscribe: withFilter(
        (_:any, { user_id }:{user_id:string}) => pubsub.asyncIterator(topicUser(user_id)),
        (payload, variables) => {
          console.log("[graphql-core withFilter : userMessageAdded]");
          return payload?.userMessageAdded?.to_user_ids.includes(variables?.user_id);
        }
      )
    },
    messageDeleted: {
      subscribe: withFilter(
        (_:any, { chat_id }:{chat_id:string}) => pubsub.asyncIterator(topicUser(chat_id)),
        (payload, variables) => {
          console.log("[graphql-core withFilter : messageDeleted]");
          // return payload?.userMessageAdded?.to_user_ids.includes(variables?.user_id);

          return payload.asyncIterator(topicChat(variables?.chat_id));
        }
      )
    },
  },
};