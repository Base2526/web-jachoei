// packages/events/emit.server.ts
import type { PostEventPayload, PostEventName } from "./postBus";
import { postBus } from "./postBus";
import { registerPostEventListeners } from "./register.server";

export async function emitPostEvent(event: PostEventName, payload: PostEventPayload) {
  console.error("[events] emitPostEvent() begin", event, payload.eventId, "postId=", payload.postId);

  await registerPostEventListeners();

  console.error("[events] emitPostEvent() listeners=", {
    created: postBus.listenerCount("post.created"),
    updated: postBus.listenerCount("post.updated"),
    deleted: postBus.listenerCount("post.deleted"),
  });

  postBus.emit(event, payload); // ✅ ถูกต้อง: emit ตาม event
  console.error("[events] emitPostEvent() emitted", event, payload.eventId);
}