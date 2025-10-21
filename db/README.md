✅ วิธีที่ 1: รันตรงผ่าน psql (ง่ายสุด)

เหมาะกับเครื่อง Dev หรือเซิร์ฟเวอร์ที่เข้าถึง DB ตรงได้

psql -h localhost -U your_user -d your_database -f migrations/1.1__users_add_password.sql


ตัวอย่างจริง:

psql -h 127.0.0.1 -U postgres -d mydb -f migrations/1.1__users_add_password.sql


-h = host ของ PostgreSQL

-U = username

-d = ชื่อ database

-f = ชื่อไฟล์ migration

ถ้าฐานมีรหัสผ่าน จะมี prompt ให้กรอก

✅ วิธีที่ 2: รันใน Docker container (ถ้า DB อยู่ใน Docker)

เช่นใน docker-compose.yml มี service postgres

รันจากเครื่องหลักแบบนี้:

docker exec -i postgres psql -U postgres -d mydb < migrations/1.1__users_add_password.sql


หรือถ้าชื่อ service คือ db:

docker exec -i db psql -U postgres -d mydb < migrations/1.1__users_add_password.sql


-i หมายถึงรับ input จากไฟล์
อย่าลืมใส่ < (redirect) เพื่อให้ไฟล์ถูกส่งเข้า psql

✅ วิธีที่ 3: รวมไว้ในสคริปต์อัปเดต (เหมาะกับ Production)

เช่น สร้างไฟล์ update_db.sh:

#!/usr/bin/env bash
set -e

DB_HOST=localhost
DB_NAME=mydb
DB_USER=postgres

echo "🚀 Running migration 1.1__users_add_password.sql..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/1.1__users_add_password.sql

echo "✅ Migration complete!"


ให้สิทธิ์รัน:

chmod +x update_db.sh
./update_db.sh
