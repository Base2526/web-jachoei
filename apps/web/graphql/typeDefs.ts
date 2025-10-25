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
  
  type MessageReceipt {
    deliveredAt: String!
    readAt: String
    isRead: Boolean!
  }

  type Message {
    id: ID!
    chat_id: ID!
    sender: User
    text: String!
    created_at: String!
    to_user_ids: [ID!]!

    myReceipt: MessageReceipt!
    readers: [User!]!
    readersCount: Int!
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

  # type Message { 
  #  id: ID!, chat_id: ID!, sender_id: ID!, text: String!, created_at: String! 
  # }

  type Query {
    _health: String!
    meRole: String!
    posts(search: String): [Post!]!
    post(id: ID!): Post
    myPosts(search: String): [Post!]!

    getOrCreateDm(user_id: ID!): Chat!

    users(search: String): [User!]!
    user(id: ID!): User

    postsByUserId(user_id: ID!): [Post!]!


    myChats: [Chat!]!
    messages(chat_id: ID!, limit: Int, offset: Int): [Message!]!

    me: User

    unreadCount(chatId: ID!): Int!
    whoRead(messageId: ID!): [User!]!
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
    addMember(chat_id: ID!, user_id: ID!): Boolean!
    sendMessage(chat_id: ID!, text: String!, to_user_ids: [ID!]!): Message!

    updateMyProfile(data: MyProfileInput!): User!

    renameChat(chat_id: ID!, name: String): Boolean!
    deleteChat(chat_id: ID!): Boolean!

    markMessageRead(messageId: ID!): Boolean!
    markChatReadUpTo(chatId: ID!, cursor: String!): Boolean!
  }
`;
