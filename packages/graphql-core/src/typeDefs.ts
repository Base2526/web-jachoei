export const coreTypeDefs = /* GraphQL */ `
  type Message { 
    id: ID!, 
    chat_id: ID!,
    sender_id: ID!,
    text: String!, 
    ts: String! 
  }

  type Query { _ok: String! }
  type Mutation { send(text: String!): Boolean! }
  type Subscription { messageAdded(chatId: ID!): Message! }
`;
