PROJECT JACHOEI

```markdown
# web-jachoei / next-apollo-pg-ws

## 🇬🇧 English

### 📌 Project Overview
This repository is a **full-stack monorepo** that includes:
- A **Next.js** web application
- **Apollo GraphQL** server
- **PostgreSQL** database schema
- **WebSocket (ws)** real-time server
- **React Native (RN)** mobile components
- Container orchestration via **Docker Compose**

The purpose of this project is to provide a modern scalable template for full-stack web + mobile development using Next.js, Apollo GraphQL, Postgres, and WebSockets.

### 🗂️ Repository Structure
```

/
├── apps/           # Client & Server apps
│   ├── web/        # Next.js frontend
│   ├── ws/         # WebSocket real-time server
│   └── rn/         # React Native app
├── db/             # Database migrations & queries
├── packages/       # Shared libraries & util packages
├── storage/        # Uploaded files / assets
├── docker-compose.yml          # Main compose config
├── docker-compose.dev.yml      # Dev environment override
├── docker-compose.prod.yml     # Prod environment override
└── .gitignore

````

### 🚀 Development Setup
#### 🧰 Requirements
- Docker & Docker Compose installed
- Node.js (for local non-docker work)

#### 🛠️ Run Dev Containers
```bash
docker compose up web ws redis --build
````

This command will:

* Build containers
* Start web app, ws server, and Redis (used for caching or WS pub/sub)

### 🧠 Features

* **GraphQL API** using Apollo
* **Real-time** support via WebSockets
* **Monorepo** architecture for shared code
* **Database** structured for Postgres
* Easily extensible to mobile (React Native)

### 📦 Deployment

1. Configure `.env` files for each environment
2. Build production images
3. Use `docker compose -f docker-compose.prod.yml up` to launch

---

## 🇹🇭 ภาษาไทย

### 📌 ภาพรวมโปรเจกต์

Repository นี้คือ **full-stack monorepo** ที่รวม:

* Web frontend ด้วย **Next.js**
* API ด้วย **Apollo GraphQL**
* ฐานข้อมูล **PostgreSQL**
* Server แบบ **WebSocket (ws)** สำหรับ realtime
* ส่วนของมือถือด้วย **React Native (RN)**
* และใช้ **Docker Compose** สำหรับจัดการ container ต่าง ๆ

โครงสร้างนี้เหมาะสำหรับเป็น boilerplate / template สำหรับงานจริงที่ต้องการระบบ realtime + GraphQL + web + mobile

### 🗂️ โครงสร้างไฟล์

```
/
├── apps/           # แอปที่เกี่ยวข้อง
│   ├── web/        # Next.js frontend
│   ├── ws/         # WebSocket realtime server
│   └── rn/         # React Native app
├── db/             # migration / queries ของฐานข้อมูล
├── packages/       # shared code / utilities
├── storage/        # ไฟล์ upload / assets
├── docker-compose.yml          # config หลักของ Docker
├── docker-compose.dev.yml      # config สำหรับ dev
├── docker-compose.prod.yml     # config สำหรับ prod
└── .gitignore
```

### 🚀 วิธีเริ่มพัฒนา

#### 🧰 สิ่งที่ต้องติดตั้ง

* Docker + Docker Compose
* Node.js (ถ้าจะทำงานนอก Docker)

#### 🛠️ สั่งรัน Development

```bash
docker compose up web ws redis --build
```

คำสั่งนี้จะ:

* Build container ที่จำเป็น
* เริ่ม web app, ws server และ Redis

### 🧠 ฟีเจอร์หลัก

* **GraphQL API** ด้วย Apollo
* **Realtime** ผ่าน WebSocket
* **โครงสร้าง monorepo** สำหรับแชร์ code
* **PostgreSQL** schema พร้อมสำหรับพัฒนาต่อ
* รองรับทั้ง web และ mobile

### 📦 การ deploy

1. ตั้งค่าไฟล์ `.env` ให้เหมาะกับแต่ละสภาพแวดล้อม
2. Build production image
3. ใช้คำสั่ง `docker compose -f docker-compose.prod.yml up` เพื่อรัน

---

