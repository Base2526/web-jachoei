ดู job ทีมีอยู่ใน redis

เช็ค queue ใน redis (ถ้า “ยังไม่รัน worker”)
docker compose --env-file .env.dev exec redis redis-cli
LLEN social:publish:queue
LRANGE social:publish:queue 0 -1



run แยก
docker compose  --env-file .env.dev exec web npm run worker:social 





options
ถ้าคุณอยาก:

ทำหน้า admin ดู queue

ทำ GraphQL query queueStatus

auto retry / delay / backoff


8️⃣ Next step (ถ้าจะ production จริง)

สิ่งที่คุณอาจอยากเพิ่มต่อ:

🔹 service social-worker ใน docker-compose (auto-restart)

🔹 table social_posts (เก็บ post_id ↔ facebook_id / x_id)

🔹 retry count / backoff ต่อ job

🔹 toggle เปิด–ปิด auto-publish ต่อ post



ยิง event หรือ debug enqueue
/api/admin/queue/debug?postId=<UUID จริง>

/admin/queue > DB History

