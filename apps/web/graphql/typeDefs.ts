export const typeDefs = /* GraphQL */ `
  enum PostStatus { public unpublic }

  type User {
    id: ID!
    name: String!
    avatar: String
    phone: String
    email: String
    role: String!
    created_at: String!
  }

  type Post {
    id: ID!
    title: String!
    body: String!
    image_url: String
    phone: String
    author: User
    status: PostStatus!
    created_at: String!
    updated_at: String!
  }

  type Chat { id: ID!, name: String, is_group: Boolean!, created_at: String! }

  type Message { 
    id: ID!, chat_id: ID!, sender_id: ID!, text: String!, created_at: String! 
  }

  type Query {
    _health: String!
    meRole: String!
    posts(search: String): [Post!]!
    post(id: ID!): Post

    getOrCreateDm(userId: ID!): Chat!
    messages(chatId: ID!): [Message!]!
  }

  input PostInput {
    title: String!
    body: String!
    image_url: String
    phone: String
    status: PostStatus!
  }

  type Mutation {
    upsertPost(id: ID, data: PostInput!): Post!
    deletePost(id: ID!): Boolean!

    sendMessage(chatId: ID!, text: String!): Message!
  }
`;
