import { pubsub } from "../../realtime/src/pubsub.js";

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
      subscribe(_: unknown, { chatId }: { chatId: string }): AsyncIterableIterator<unknown> {
        console.log("[ graphql-core subscribe ]", chatId);

        return pubsub.asyncIterator('MSG:' + chatId) as AsyncIterableIterator<unknown>;
      },
    },
  },
};
