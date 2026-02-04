import { registerPostEventListeners } from "./register.server";

// อย่า await ที่ top-level ใน route.ts — ทำ init ที่นี่แทน
// และกัน init ซ้ำด้วย global guard ที่ register.server.ts
void registerPostEventListeners();
