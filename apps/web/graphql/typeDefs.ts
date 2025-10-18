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

  type Query {
    _health: String!
    meRole: String!
    posts(search: String): [Post!]!
    post(id: ID!): Post
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
  }
`;
