// notificationTypes.ts
export const NotificationTypes = {
  // Chat related
  CHAT_CREATED: 'CHAT_CREATED',
  CHAT_NEW_MESSAGE: 'CHAT_NEW_MESSAGE',
  CHAT_MENTION: 'CHAT_MENTION',

  // Post related
  POST_COMMENT: 'POST_COMMENT',
  POST_FOLLOWED: 'POST_FOLLOWED',
  POST_FOLLOWED_COMMENT: 'POST_FOLLOWED_COMMENT',
  POST_LIKED: 'POST_LIKED',

  // System / Admin
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',
} as const;


// ในอนาคตถ้าอยากเพิ่ม:
// TASK_ASSIGNED – มีคน assign task ให้เรา
// BOOKING_STATUS_CHANGED – สถานะ booking เปลี่ยน
// PAYMENT_RECEIVED – มีการชำระเงินเข้ามา
// DRIVER_ASSIGNED – driver ถูก assign งาน
