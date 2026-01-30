# 🚨 PROJECT JACHOEI
### web-jachoei / next-apollo-pg-ws

> A modern full-stack monorepo for Web, API, Realtime, and Mobile applications

---

## 🌍 Language
- [English](#-english)
- [ภาษาไทย](#-ภาษาไทย)

---

## 🇬🇧 English

### 📌 Project Overview
**PROJECT JACHOEI** is a **full-stack monorepo** designed for scalable, real-world applications.  
It combines modern web, API, realtime, and mobile technologies in a single repository.

**Tech stack included:**
- ⚛️ **Next.js** – Web frontend
- 🔗 **Apollo GraphQL** – API layer
- 🐘 **PostgreSQL** – Database
- ⚡ **WebSocket (ws)** – Realtime communication
- 📱 **React Native (RN)** – Mobile application
- 🐳 **Docker Compose** – Container orchestration

This project can be used as a **production-ready boilerplate** or a foundation for extending into complex systems.

---

### 🗂️ Repository Structure

```

/
├── apps/                    # Client & Server applications
│   ├── web/                 # Next.js frontend
│   ├── ws/                  # WebSocket realtime server
│   └── rn/                  # React Native mobile app
├── db/                      # Database migrations & queries
├── packages/                # Shared libraries & utilities
├── storage/                 # Uploaded files / assets
├── docker-compose.yml       # Main Docker Compose config
├── docker-compose.dev.yml   # Development override
├── docker-compose.prod.yml  # Production override
└── .gitignore

````

---

### 🚀 Development Setup

#### 🧰 Requirements
- Docker & Docker Compose
- Node.js (optional, for non-Docker workflows)

#### 🛠️ Run Development Containers
```bash
docker compose up web ws redis --build
````

This command will:

* Build required containers
* Start:

  * Web application
  * WebSocket server
  * Redis (used for caching / pub-sub)

---

### 🧠 Key Features

* 🔗 **GraphQL API** powered by Apollo
* ⚡ **Realtime communication** via WebSockets
* 📦 **Monorepo architecture** with shared packages
* 🐘 **PostgreSQL-ready** database structure
* 📱 Easily extendable to **mobile (React Native)**

---

### 📦 Deployment

1. Configure `.env` files for each environment
2. Build production images
3. Launch using:

   ```bash
   docker compose -f docker-compose.prod.yml up
   ```

---

## 🇹🇭 ภาษาไทย

### 📌 ภาพรวมโปรเจกต์

**PROJECT JACHOEI** คือ **full-stack monorepo** สำหรับพัฒนาแอปพลิเคชันระดับ production
รองรับทั้ง Web, API, Realtime และ Mobile ใน repository เดียว

**เทคโนโลยีที่ใช้:**

* ⚛️ **Next.js** – Web frontend
* 🔗 **Apollo GraphQL** – API
* 🐘 **PostgreSQL** – ฐานข้อมูล
* ⚡ **WebSocket (ws)** – ระบบ realtime
* 📱 **React Native (RN)** – แอปมือถือ
* 🐳 **Docker Compose** – จัดการ container

เหมาะสำหรับใช้เป็น **boilerplate** หรือฐานสำหรับพัฒนาระบบขนาดใหญ่

---

### 🗂️ โครงสร้างโปรเจกต์

```
/
├── apps/                    # แอปฝั่ง client และ server
│   ├── web/                 # Next.js frontend
│   ├── ws/                  # WebSocket realtime server
│   └── rn/                  # React Native mobile app
├── db/                      # migration และ query ฐานข้อมูล
├── packages/                # shared libraries / utilities
├── storage/                 # ไฟล์ upload / assets
├── docker-compose.yml       # Docker Compose หลัก
├── docker-compose.dev.yml   # สำหรับ development
├── docker-compose.prod.yml  # สำหรับ production
└── .gitignore
```

---

### 🚀 วิธีเริ่มพัฒนา

#### 🧰 สิ่งที่ต้องติดตั้ง

* Docker + Docker Compose
* Node.js (ถ้าต้องการรันนอก Docker)

#### 🛠️ รัน Development

```bash
docker compose up web ws redis --build
```

คำสั่งนี้จะ:

* Build container ที่จำเป็น
* เริ่ม:

  * Web application
  * WebSocket server
  * Redis

---

### 🧠 ฟีเจอร์หลัก

* 🔗 **GraphQL API** ด้วย Apollo
* ⚡ **Realtime** ผ่าน WebSocket
* 📦 **Monorepo** แชร์ code ได้ง่าย
* 🐘 **PostgreSQL schema** พร้อมใช้งาน
* 📱 รองรับการต่อยอดเป็น mobile app

---

### 📦 การ Deploy

1. ตั้งค่าไฟล์ `.env` ให้เหมาะกับ environment
2. Build production image
3. รันด้วยคำสั่ง:

   ```bash
   docker compose -f docker-compose.prod.yml up
   ```
