export const typeDefs = /* GraphQL */ `
  scalar JSON
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

  type UserConnection {
    items: [User!]!
    total: Int!
  }

  type Chat {
    id: ID!
    name: String
    is_group: Boolean!
    created_by: User
    created_at: String!
    members: [User!]!

    last_message: Message
    last_message_at: String
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

    images: [MessageImage!]! 

    is_deleted: Boolean!
    deleted_at: String

    myReceipt: MessageReceipt!
    readers: [User!]!
    readersCount: Int!

    reply_to_id: ID
    reply_to: Message
  }

  type MessageImage {
    id: ID!
    file_id: ID!    # ← ใช้ bind กับ files.id
    url: String!
    mime: String
    width: Int
    height: Int
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

  input SocialLoginInput {
    provider: String!      # "google" | "facebook"
    accessToken: String!   # จาก Google/Facebook
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

    comments_count: Int
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

  # ==== Types แยกตาม entity ====
  type SearchPostResult {
    id: ID!
    entity_id: ID!        # = post id
    title: String!
    snippet: String
    created_at: String
  }

  type SearchUserResult {
    id: ID!
    entity_id: ID!        # = user id
    name: String!
    email: String
    phone: String
    avatar: String
  }

  type SearchPhoneReportResult {
    id: ID!
    entity_id: String!    # = หมายเลขโทรตรง ๆ ไว้ /phone/[number]
    ids: [ID!]! 
    phone: String!
    report_count: Int!
    last_report_at: String
  }

  type SearchBankAccountResult {
    id: ID!
    entity_id: ID!        # เอาไว้ /bank/[id] หรือ /account/[id]
    ids: [ID!]! 
    bank_name: String!
    account_no_masked: String!
    report_count: Int!
    last_report_at: String
  }

  type GlobalSearchResult {
    posts: [SearchPostResult!]!
    users: [SearchUserResult!]!
    phones: [SearchPhoneReportResult!]!
    bank_accounts: [SearchBankAccountResult!]!
  }

  type ScamPhone {
    phone: String!
    report_count: Int!
    last_report_at: String
    risk_level: Int!        # 0-100, คำนวณจาก report_count / weight อื่น ๆ
    tags: [String!]!
    updated_at: String!     # iso time, ใช้สำหรับ sync
    is_deleted: Boolean!
    post_ids: [ID!]!        # post ที่เกี่ยวข้องกับเบอร์นี้
  }

  type ScamPhoneSnapshotPage {
    cursor: String
    items: [ScamPhone!]!
  }

  type ScamPhoneDeltaPage {
    cursor: String
    items: [ScamPhone!]!
  }

  type Query {
    _health: String!
    meRole: String!
    posts(search: String): [Post!]!
    postsPaged(search: String, limit: Int!, offset: Int!): PostConnection!  
    post(id: ID!): Post
    myPosts(search: String): [Post!]!

    getOrCreateDm(user_id: ID!): Chat!

    users(search: String, limit: Int = 10, offset: Int = 0): UserConnection!
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

    myNotifications(limit: Int, offset: Int): [Notification!]!
    myUnreadNotificationCount: Int!

    comments(post_id: ID!): [Comment!]!

    globalSearch(q: String!): GlobalSearchResult!


    # ใช้ initial sync
    scamPhonesSnapshot(cursor: String, limit: Int! = 1000): ScamPhoneSnapshotPage!
    # ใช้ delta sync
    scamPhonesDelta(sinceVersion: String!, cursor: String, limit: Int! = 1000): ScamPhoneDeltaPage!
    # ใช้ manual search (เหมือน globalSearch แต่เฉพาะเบอร์)
    searchScamPhones(q: String!, limit: Int! = 20): [ScamPhone!]!
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
    username: String!
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

  input ReportScamPhoneInput {
    phone: String!
    note: String
    local_blocked: Boolean!
    client_id: String!         # UUID v4
    device_model: String       # เช่น Pixel 7
    os_version: String         # Android 14
    app_version: String        # 1.0.3
  }

  type BasicResponse {
    ok: Boolean!
    message: String!
  }

  input SupportTicketInput {
    name: String!
    email: String!
    phone: String
    topic: String!
    subject: String!
    message: String!
    ref: String
    pageUrl: String
    userAgent: String
  }

  type SupportTicketPayload {
    ok: Boolean!
    message: String
    ticketId: String
  }

  type Mutation {
    # login
    login(input: LoginInput!): LoginResult!
    loginUser(input: LoginInput!): LoginResult!
    loginWithSocial(input: SocialLoginInput!): LoginResult!
    loginAdmin(input: LoginInput!): LoginResult!
    loginMobile(email:String!, password:String!): LoginResult!

    registerUser(input: RegisterInput!): Boolean!
    verifyEmail(token: String!): BasicResponse!

    upsertPost(id: ID, data: PostInput!, images: [Upload!], image_ids_delete: [ID!]): Post!
    deletePost(id: ID!): Boolean!
    deletePosts(ids: [ID!]!): Boolean! 
    clonePost(id: ID!): String!

    upsertUser(id: ID, data: UserInput!): User!
    uploadAvatar(user_id: ID!, file: Upload!): String! 
    deleteUser(id: ID!): Boolean!
    deleteUsers(ids: [ID!]!): Boolean!

    createChat(name: String, isGroup: Boolean!, memberIds: [ID!]!): Chat!
    addMember(chat_id: ID!, user_id: ID!): Boolean!
    sendMessage(chat_id: ID!, text: String!, to_user_ids: [ID!]!, images: [Upload!], reply_to_id: ID): Message!

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

    markNotificationRead(id: ID!): Boolean!
    markAllNotificationsRead: Boolean!

    addComment(post_id: ID!, content: String!): Comment!
    replyComment(comment_id: ID!, content: String!): Comment!
    updateComment(id: ID!, content: String!): Comment!
    deleteComment(id: ID!): Boolean!

    reportScamPhone(input: ReportScamPhoneInput!): ScamPhone!

    createSupportTicket(input: SupportTicketInput!): SupportTicketPayload!
  }
`;
