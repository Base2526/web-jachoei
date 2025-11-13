export const typeDefs = /* GraphQL */ `
  scalar Upload
  enum PostStatus { public unpublic }

  type User {
    id: ID!
    name: String!
    avatar: String
    phone: String
    email: String
    role: String!
    created_at: String!
    username: String!
    language: String!
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

    is_deleted: Boolean!
    deleted_at: String

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

  type Bookmark {
    user_id: ID!
  }

  type TelNumber {
    id: ID!
    tel: String!
  }

  type SellerAccount {
    id: ID!
    bank_id: String
    bank_name: String
    seller_account: String
  }

  type Post {
    id: ID!
    author: User
    status: PostStatus!
    created_at: String!
    updated_at: String!
    images: [Image!]! 
    bookmarks: [Bookmark!]!
    is_bookmarked: Boolean!
    first_last_name: String
    id_card: String
    title: String
    transfer_amount: Float
    transfer_date: String
    website: String
    province_id: ID
    province_name: String
    detail: String
    tel_numbers: [TelNumber!]!
    seller_accounts: [SellerAccount!]!
  }

  type Chat { id: ID!, name: String, is_group: Boolean!, created_at: String! }

  # type Message { 
  #  id: ID!, chat_id: ID!, sender_id: ID!, text: String!, created_at: String! 
  # }

  type Stats {
    users: Int!
    posts: Int!
    files: Int!
    logs: Int!
  }

  type DashboardUser {
    id: ID!
    name: String
    email: String
    role: String
    created_at: String
    avatar: String
  }

  type DashboardPost {
    id: ID!
    title: String
    status: String
    created_at: String
  }

  type PendingSummary {
    posts_awaiting_approval: Int!
    users_pending_invite: Int!
    files_unclassified: Int!
    errors_last24h: Int!
  }

  type StatsSummary {
    users: Int!
    posts: Int!
    files: Int!
    logs: Int!
  }

  type PostConnection {
    items: [Post!]!
    total: Int!
  }

  type File {
    id: ID!
    filename: String!
    original_name: String
    mimetype: String
    size: Int!
    relpath: String!
    created_at: String!
    updated_at: String!
    url: String!        # เสิร์ฟผ่าน /api/files/:id
    thumb: String       # สำหรับรูปภาพ (อาจใช้ url เดิม)
  }

  type FileConnection {
    items: [File!]!
    total: Int!
  }

  type Query {
    _health: String!
    meRole: String!
    posts(search: String): [Post!]!
    postsPaged(search: String, limit: Int!, offset: Int!): PostConnection!  
    post(id: ID!): Post
    myPosts(search: String): [Post!]!

    getOrCreateDm(user_id: ID!): Chat!

    users(search: String): [User!]!
    user(id: ID!): User

    postsByUserId(user_id: ID!): [Post!]!


    myChats: [Chat!]!
    messages(chat_id: ID!, limit: Int, offset: Int, includeDeleted: Boolean): [Message!]!

    me: User

    unreadCount(chatId: ID!): Int!
    whoRead(messageId: ID!): [User!]!


    stats: StatsSummary!
    pending: PendingSummary!
    # stats: Stats!
    latestUsers(limit: Int = 5): [DashboardUser!]!
    latestPosts(limit: Int = 5): [Post!]!

    filesPaged(search: String, limit: Int!, offset: Int!): FileConnection!

    myBookmarks(limit: Int, offset: Int): [Post!]!
  }


  input TelNumberInput {
    id: ID
    tel: String!
    mode: String # "new" | "edited" | "deleted"
  }
  input SellerAccountInput {
    id: ID
    bank_id: String!
    bank_name: String!
    seller_account: String
    mode: String
  }

  input PostInput {
    # new fields
    first_last_name: String
    id_card: String
    title: String
    transfer_amount: Float
    transfer_date: String   # ISO string
    website: String
    province_id: ID
    detail: String

    # arrays
    tel_numbers: [TelNumberInput!]
    seller_accounts: [SellerAccountInput!]
    status: PostStatus!
  }

  input MyProfileInput {
    name: String
    avatar: String
    phone: String
  }

  input RegisterInput {
    name: String!
    email: String!
    phone: String
    password: String!
    agree: Boolean
  }

  type Image {
    id: ID!
    url: String!
  }

  type ToggleBookmarkResult {
    status: Boolean!
    isBookmarked: Boolean!
    executionTime: String
  }

  input MeInput {
    name: String
    email: String
    phone: String
    username: String
    language: String
  }

  type Mutation {
    # login
    login(input: LoginInput!): LoginResult!
    loginUser(input: LoginInput!): LoginResult!
    loginAdmin(input: LoginInput!): LoginResult!
    loginMobile(email:String!, password:String!): LoginResult!

    registerUser(input: RegisterInput!): Boolean!

    upsertPost(id: ID, data: PostInput!, images: [Upload!], image_ids_delete: [ID!]): Post!
    deletePost(id: ID!): Boolean!
    deletePosts(ids: [ID!]!): Boolean! 

    upsertUser(id: ID, data: UserInput!): User!
    uploadAvatar(user_id: ID!, file: Upload!): String! 
    deleteUser(id: ID!): Boolean!
    deleteUsers(ids: [ID!]!): Boolean!

    createChat(name: String, isGroup: Boolean!, memberIds: [ID!]!): Chat!
    addMember(chat_id: ID!, user_id: ID!): Boolean!
    sendMessage(chat_id: ID!, text: String!, to_user_ids: [ID!]!): Message!

    updateMyProfile(data: MyProfileInput!): User!

    renameChat(chat_id: ID!, name: String): Boolean!
    deleteChat(chat_id: ID!): Boolean!

    markMessageRead(message_id: ID!): Boolean!
    markChatReadUpTo(chat_id: ID!, cursor: String!): Boolean!

    deleteMessage(message_id: ID!): Boolean!

    requestPasswordReset(email: String!): Boolean
    resetPassword(token: String!, newPassword: String!): Boolean

    deleteFile(id: ID!): Boolean!
    deleteFiles(ids: [ID!]!): Boolean!    
    renameFile(id: ID!, name: String!): Boolean!

    toggleBookmark(postId: ID!): ToggleBookmarkResult!

    updateMe(data: MeInput!): User!
  }
`;
