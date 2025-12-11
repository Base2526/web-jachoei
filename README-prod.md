ได้เลย เดี๋ยวช่วยจัด structure แบบ **base + override (dev/prod)** ให้ พร้อมตัวอย่างคำสั่ง run

---

## 1) `docker-compose.yml` (base – ของกลาง ใช้ร่วมกันทั้ง dev/prod)

โฟกัสเก็บของที่ **เหมือนกันทุก environment**: DB, Redis, pgAdmin, env ที่ใช้ร่วมกัน, depends_on ฯลฯ
ส่วน command / volumes / NODE_ENV ค่อยไปใส่ใน override

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-app}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-app}
      POSTGRES_DB: ${POSTGRES_DB:-appdb}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro

  pgadmin:
    image: dpage/pgadmin4:8.14
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  ws:
    image: node:20-alpine
    working_dir: /app/apps/ws
    environment:
      WS_PORT: "8080"
      WS_PATH: "/graphql"
      REDIS_URL: ${REDIS_URL}
      DATABASE_URL: postgres://app:app@postgres:5432/appdb
    depends_on:
      - postgres
      - redis

  web:
    image: node:20-alpine
    working_dir: /app/apps/web
    environment:
      NEXT_PUBLIC_BASE_URL: ${NEXT_PUBLIC_BASE_URL}
      NEXT_PUBLIC_GRAPHQL_HTTP: ${NEXT_PUBLIC_GRAPHQL_HTTP}
      NEXT_PUBLIC_GRAPHQL_WS: ${NEXT_PUBLIC_GRAPHQL_WS}
      POSTGRES_HOST: ${POSTGRES_HOST}
      POSTGRES_PORT: ${POSTGRES_PORT}
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      REDIS_URL: ${REDIS_URL}
      STORAGE_DIR: /app/storage
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: ${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
    depends_on:
      - postgres
      - redis
      - ws

volumes:
  pgdata:
```

---

## 2) `docker-compose.dev.yml` (override สำหรับ development)

อันนี้จะใส่:

* `command` แบบเดิม: `npm ci && npm run dev`
* `volumes` bind mount โค้ด
* `NODE_ENV=development`
* port mapping

```yaml
services:
  ws:
    command: >
      sh -c "npm ci &&
             npm --prefix ../../packages/realtime ci &&
             npm --prefix ../../packages/graphql-core ci &&
             npm run dev"
    environment:
      NODE_ENV: development
    ports:
      - "8081:8080"
    volumes:
      - ./apps/ws:/app/apps/ws
      - ./packages:/app/packages

  web:
    command: >
      sh -c "npm ci && npm run dev"
    environment:
      NODE_ENV: development
    ports:
      - "3000:3000"
    volumes:
      - ./apps/web:/app/apps/web
      - ./packages:/app/packages
      - ./storage:/app/storage
```

**รัน dev:**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

---

## 3) `docker-compose.prod.yml` (override สำหรับ production build Next.js)

ใน prod เราไม่อยากให้ container รัน `npm ci` ตลอดเวลา → ควร build image ก่อนด้วย `Dockerfile`
ดังนั้นใน override นี้จะ:

* ใช้ `build:` แทน image node ดิบ
* `NODE_ENV=production`
* command เป็น `npm run start` (หลัง build แล้ว)
* ไม่ bind mount โค้ด (ใช้ไฟล์ใน image)

```yaml
services:
  ws:
    build:
      context: .
      dockerfile: ./apps/ws/Dockerfile
    image: myapp-ws:latest
    environment:
      NODE_ENV: production
    ports:
      - "8081:8080"
    # ไม่มี volumes ใน prod

  web:
    build:
      context: .
      dockerfile: ./apps/web/Dockerfile
    image: myapp-web:latest
    environment:
      NODE_ENV: production
    ports:
      - "3000:3000"
    # ไม่มี volumes ใน prod
```

---

## 4) ตัวอย่าง `Dockerfile` สำหรับ Next.js (apps/web)

สมมติ monorepo แบบที่ใช้อยู่ (`apps` + `packages`) ตัวอย่าง multi-stage:

**`apps/web/Dockerfile`**

```dockerfile
# --- builder stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# copy root dependencies (ปรับตามจริงว่าคุณใช้ npm / pnpm / yarn)
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages

# install dependencies ทั้ง monorepo
RUN npm ci

WORKDIR /app/apps/web

# build Next.js
RUN npm run build

# --- runner stage ---
FROM node:20-alpine AS runner

WORKDIR /app/apps/web

ENV NODE_ENV=production

# copy app ที่ build แล้ว + node_modules จาก builder
COPY --from=builder /app/apps/web ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]
```

(ถ้ามี `next.config.mjs`, custom folder อะไรเพิ่ม ก็ ensure ว่าถูก COPY มาด้วยจาก builder)

---

## 5) ตัวอย่าง `Dockerfile` สำหรับ `ws` (apps/ws)

แบบง่าย ๆ:

**`apps/ws/Dockerfile`**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci

WORKDIR /app/apps/ws
RUN npm run build # ถ้าใช้ ts ให้ build เป็น js ก่อน

FROM node:20-alpine AS runner

WORKDIR /app/apps/ws
ENV NODE_ENV=production

COPY --from=builder /app/apps/ws ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/ws/node_modules ./node_modules

EXPOSE 8080

CMD ["npm", "run", "start"]
```

---

## 6) วิธีรัน production

```bash
# build + run prod
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

---

ถ้าต้องการ เดี๋ยวผมช่วยปรับ Dockerfile ให้ตรงกับโครงสร้าง monorepo จริง ๆ ของโปรเจคคุณ (เช่น ถ้าใช้ `pnpm` หรือ `turbo` อยู่) ได้อีกที แต่ config base + override ตอนนี้ใช้ได้เลย 👍


dev
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml up


prod
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml build web ws

docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d