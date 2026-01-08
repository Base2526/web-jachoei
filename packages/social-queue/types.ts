export type SocialPlatform = "facebook";
export type SocialAction = "create" | "update" | "delete";

export type SocialJob = {
  platform: SocialPlatform;
  action: SocialAction;
  eventId: string;
  post: {
    postId: string;
    title?: string;
    summary?: string;
    url?: string;
  };
  meta?: {
    actorId?: string;
    revisionId?: string;
  };

  attempts?: number;     // เริ่ม 0
  maxAttempts?: number;  // default 8
};
