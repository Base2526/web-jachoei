export const coreTypeDefs = /* GraphQL */ `
  scalar JSON
  type User {
    id: ID!
    name: String!
    avatar: String
    phone: String
    email: String
    role: String!
    created_at: String!
  }

  type MessageReceipt {
    deliveredAt: String!
    readAt: String
    isRead: Boolean!
  }

  type Message { 
    id: ID!, 
    chat_id: ID!,
    sender: User,
    text: String!, 
    created_at: String! 
    to_user_ids: [ID!]! 

    is_deleted: Boolean!
    deleted_at: String

    myReceipt: MessageReceipt!
    readers: [User!]!
    readersCount: Int!
  }

  type Notification {
    id: ID!
    user_id: ID!
    type: String!
    title: String!
    message: String!
    entity_type: String!
    entity_id: ID!
    data: JSON
    is_read: Boolean!
    created_at: String!
  }

  type Comment {
    id: ID!
    post_id: ID!
    user_id: ID!
    parent_id: ID
    content: String!
    created_at: String!
    updated_at: String!
    user: User!
    replies: [Comment!]!
  }

  type Query { _ok: String! }
  type Mutation { 
    send(text: String!): Boolean! 
  }
  type Subscription { 
    time: String!
    messageAdded(chat_id: ID!): Message! 
    userMessageAdded(user_id: ID!): Message! 

    messageDeleted(chat_id: ID!): ID!


    notificationCreated: Notification!  # push real-time


    commentAdded(post_id: ID!): Comment!
    commentUpdated(post_id: ID!): Comment!
    commentDeleted(post_id: ID!): ID!          # ส่ง id ที่ลบ
  }
`;
