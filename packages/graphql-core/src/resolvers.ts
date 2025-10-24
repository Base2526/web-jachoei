import { pubsub } from "../../realtime/src/pubsub.js";

import { withFilter } from "graphql-subscriptions";

export const coreResolvers = {
  Query: { _ok: () => "ok" },
  Mutation: {
    send: async (_: unknown, { text }: { text: string }) => {
      const msg = { id: Date.now().toString(), text, ts: new Date().toISOString() };
      await pubsub.publish('MSG', { messageAdded: msg });

      console.log("[ graphql-core send ]", text);
      return true;
    },
    // sendMessage: async (_: unknown, { chatId, text }: { chatId: string; text: string }, ctx: any) => {
      
    //   console.log("[package graphql-core sendMessage]", chatId, text);
    //   const msg = {
    //     id: Date.now().toString(),
    //     chatId,
    //     senderId: ctx?.userId || "demo",
    //     text,
    //     ts: new Date().toISOString()
    //   };
    //   await pubsub.publish("MSG", { messageAdded: msg });
    //   return true;
    // },
  },
  Subscription: {
    // messageAdded: {
    //   subscribe(_: unknown, { chatId }: { chatId: string }): AsyncIterableIterator<unknown> {
    //     console.log("[ graphql-core subscribe ]", chatId);

    //     return pubsub.asyncIterator('MSG:' + chatId) as AsyncIterableIterator<unknown>;
    //   },
    // },

messageAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterator("MSG"),
        (payload, variables) => {
          console.log("[withFilter]", variables);
          return payload?.messageAdded?.chatId === variables?.chatId;
        }
      )
    }


  },
};
