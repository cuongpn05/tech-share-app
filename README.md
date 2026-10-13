# 🌐 TECHSHARE - CLIENT / SERVER PLATFORM

> **Nền tảng Chia sẻ/Cho thuê Thiết bị Công nghệ**  
> **Kiến trúc Công nghệ**: Fullstack MERN (MongoDB, Express.js, React.js 18+ Vite, Node.js) - **100% Pure JavaScript (No TypeScript)**

---

## 📁 CẤU TRÚC DỰ ÁN (CLIENT - SERVER MONOREPO)

```
tech-share/
├── client/                     # [FRONTEND] ReactJS (Vite + Tailwind CSS + React Router v7)
│   ├── public/
│   ├── src/
│   │   ├── assets/             # Logo vector, hình ảnh tĩnh
│   │   ├── components/         # Components giao diện dùng chung (Navbar, Footer...)
│   │   ├── context/            # Global State (AuthContext...)
│   │   ├── hooks/              # Custom hooks (useFetch...)
│   │   ├── layouts/            # Layouts (PublicLayout...)
│   │   ├── pages/              # Khung màn hình (HomePage, CatalogPage, LoginPage...)
│   │   ├── routes/             # AppRoutes, routes.js
│   │   ├── services/           # API client kết nối backend Express
│   │   └── utils/              # Helper functions (formatters...)
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                     # [BACKEND] Node.js Express + MongoDB
│   ├── src/
│   │   ├── config/             # Kết nối MongoDB Atlas (db.js)
│   │   ├── controllers/        # Controllers xử lý nghiệp vụ (auth, device...)
│   │   ├── middlewares/        # Middlewares (auth JWT, error handler)
│   │   ├── models/             # Mongoose Schemas (User, Device...)
│   │   ├── routes/             # RESTful API endpoints (/api/auth, /api/devices...)
│   │   └── index.js            # Điểm khởi chạy Express server (Port 5000)
│   ├── .env.example
│   └── package.json
│
├── docs/                       # Tài liệu thiết kế hệ thống, DB & phân công
├── .gitignore
├── README.md
└── package.json                # Quản lý script khởi chạy đồng bộ cả Client & Server
```

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & CHẠY DỰ ÁN

### 1. Cài đặt toàn bộ dependencies

Tại thư mục gốc của dự án, chạy:

```bash
npm run install:all
```

_(Lệnh này sẽ tự động cài dependencies cho cả root, `client/` và `server/`)_

### 2. Cấu hình biến môi trường Server

Tạo file `server/.env` dựa theo mẫu `server/.env.example`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/techshare
JWT_SECRET=your_jwt_secret_key_here
CLIENT_URL=http://localhost:5173
```

### 3. Khởi chạy phát triển (Development)

- **Chạy đồng thời cả Frontend và Backend (1 lệnh duy nhất):**

  ```bash
  npm run dev
  ```

  - Backend: `http://localhost:5000`
  - Frontend: `http://localhost:5173`

- **Hoặc chạy riêng lẻ:**

  ```bash
  # Chỉ chạy Frontend:
  npm run dev:client

  # Chỉ chạy Backend:
  npm run dev:server
  ```
