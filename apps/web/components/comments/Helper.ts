// ======================
// helper: แทรก comment ใหม่เข้า tree
// ======================
export function insertCommentIntoTree(
  prevComments: any[],
  newComment: any
): any[] {
  // กัน duplicate
  const exists = (comments: any[]): boolean => {
    for (const c of comments) {
      if (c.id === newComment.id) return true;
      if (c.replies && c.replies.length && exists(c.replies)) return true;
    }
    return false;
  };

  if (exists(prevComments)) {
    return prevComments;
  }

  // ถ้าไม่มี parent → เป็น root comment ใหม่
  if (!newComment.parent_id) {
    return [
      ...prevComments,
      {
        ...newComment,
        replies: newComment.replies ?? [],
      },
    ];
  }

  // ถ้ามี parent → หา parent แล้ว push เข้า replies
  const deepInsert = (comments: any[]): any[] => {
    return comments.map((c) => {
      if (c.id === newComment.parent_id) {
        const currentReplies = c.replies ?? [];
        return {
          ...c,
          replies: [
            ...currentReplies,
            {
              ...newComment,
              replies: newComment.replies ?? [],
            },
          ],
        };
      }

      if (c.replies && c.replies.length) {
        return {
          ...c,
          replies: deepInsert(c.replies),
        };
      }

      return c;
    });
  };

  return deepInsert(prevComments);
}

export function formatTimeAgo(createdAt: any) {
  if (!createdAt) return '';

  // ถ้าเป็น string ของตัวเลข เช่น "1763478008860"
  // ให้ parse เป็น Number
  const timestamp = typeof createdAt === 'string'
    ? parseInt(createdAt, 10)
    : createdAt;

  // ถ้าตัวเลขเป็น 10 หลัก (seconds) ให้แปลงเป็น ms
  const ms = timestamp < 20000000000 ? timestamp * 1000 : timestamp;

  const date = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min > 1 ? 's' : ''} ago`;

  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} hour${hour > 1 ? 's' : ''} ago`;

  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} day${day > 1 ? 's' : ''} ago`;

  const month = Math.floor(day / 30);
  if (month < 12) return `${month} month${month > 1 ? 's' : ''} ago`;

  const year = Math.floor(month / 12);
  return `${year} year${year > 1 ? 's' : ''} ago`;
}


