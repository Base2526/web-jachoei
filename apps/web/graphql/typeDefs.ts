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

  type Chat {
    id: ID!
    name: String
    is_group: Boolean!
    created_by: User
    created_at: String!
    members: [User!]!
  }

  type Message {
    id: ID!
    chat_id: ID!
    sender: User
    text: String!
    created_at: String!
  }

  input UserInput {
    name: String!
    avatar: String
    phone: String
    email: String
    role: String!
    passwordHash: String
  }

  type LoginResult {
    ok: Boolean!
    message: String
    token: String
    user: User
  }

  input LoginInput {
    email: String
    username: String
    password: String!
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
    myPosts(search: String): [Post!]!

    getOrCreateDm(userId: ID!): Chat!
    # messages(chatId: ID!): [Message!]!

    users(search: String): [User!]!
    user(id: ID!): User

    postsByUserId(userId: ID!): [Post!]!


    myChats: [Chat!]!
    messages(chatId: ID!, limit: Int, offset: Int): [Message!]!

    me: User
  }

  input PostInput {
    title: String!
    body: String!
    image_url: String
    phone: String
    status: PostStatus!
  }

  input MyProfileInput {
    name: String
    avatar: String
    phone: String
  }

  type Mutation {
    login(input: LoginInput!): LoginResult!
    upsertPost(id: ID, data: PostInput!): Post!
    deletePost(id: ID!): Boolean!

    upsertUser(id: ID, data: UserInput!): User!
    deleteUser(id: ID!): Boolean!

    createChat(name: String, isGroup: Boolean!, memberIds: [ID!]!): Chat!
    addMember(chatId: ID!, userId: ID!): Boolean!
    sendMessage(chatId: ID!, text: String!): Message!

    updateMyProfile(data: MyProfileInput!): User!

    renameChat(chatId: ID!, name: String): Boolean!
    deleteChat(chatId: ID!): Boolean!
  }
`;
