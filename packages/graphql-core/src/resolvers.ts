import { pubsub } from "../../realtime/src/pubsub.js";

import { withFilter } from "graphql-subscriptions";

const topicChat = (chat_id: string) => `MSG_CHAT_${chat_id}`;
const topicUser = (user_id: string) => `MSG_USER_${user_id}`;

export const coreResolvers = {
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
    messageAdded: {
      subscribe: withFilter(
        (_:any, { chat_id }:{chat_id:string}) => pubsub.asyncIterator(topicChat(chat_id)),
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