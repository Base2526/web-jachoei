import { pubsub } from "../../realtime/src/pubsub.js";

export const coreResolvers = {
  Query: { _ok: () => "ok" },
  Mutation: {
    send: async (_: unknown, { text }: { text: string }) => {
      const msg = { id: Date.now().toString(), text, ts: new Date().toISOString() };
      await pubsub.publish('MSG', { messageAdded: msg });
      return true;
    },
  },
  Subscription: {
    messageAdded: {
      subscribe: () => pubsub.asyncIterator('MSG'),
    },
  },
};
