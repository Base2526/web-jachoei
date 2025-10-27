export const coreTypeDefs = /* GraphQL */ `
  type User {
    id: ID!
    name: String!
    avatar: String
    phone: String
    email: String
    role: String!
    created_at: String!
  }

  type Message { 
    id: ID!, 
    chat_id: ID!,
    sender: User,
    text: String!, 
    created_at: String! 
    to_user_ids: [ID!]! 
  }

  type Query { _ok: String! }
  type Mutation { 
    send(text: String!): Boolean! 
  }
  type Subscription { 
    messageAdded(chat_id: ID!): Message! 
    userMessageAdded(user_id: ID!): Message! 
  }
`;
