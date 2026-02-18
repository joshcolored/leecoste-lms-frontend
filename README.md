# 🚀 LeeCoste – Listing Management System

![React](https://img.shields.io/badge/Frontend-React-blue?logo=react)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)
![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js)
![Firebase](https://img.shields.io/badge/Auth-Firebase-FFCA28?logo=firebase)
![Express](https://img.shields.io/badge/API-Express-black?logo=express)
![License](https://img.shields.io/badge/License-MIT-green)

🔗 **Live Demo:** https://leecoste.vercel.app

---

A modern full-stack SaaS-style **Listing Management System** with real-time chat messaging and customizable appearance settings.

Built to simulate a production-ready admin dashboard with secure authentication, protected APIs, analytics visualization, and scalable architecture.

---

# 💼 Project Overview

LeeCoste demonstrates real-world full-stack engineering:

- Secure Firebase Authentication (Email Verification Required)
- Backend Token Verification via Firebase Admin SDK
- Protected API Routes
- Persistent Session Handling (Remember Me – 30 Days)
- Real-Time Chat Messaging Structure
- Modern SaaS Dashboard UI
- Customizable Appearance (Dark/Light Mode + Collapsible Sidebar)

This project reflects how modern SaaS platforms are structured in production environments.

---

# 🛠 Tech Stack

## 🎨 Frontend
- React (Vite + TypeScript)
- Tailwind CSS
- Recharts (Data Visualization)
- Lucide React (Icons)
- Firebase Client SDK
- React Router
- Axios

## 🚀 Backend
- Node.js
- Express.js
- Firebase Admin SDK
- REST API Architecture

## ☁️ Database
- Firebase Firestore

---

# 🏗 Architecture Overview

User → Firebase Authentication  
↓  
Frontend receives Firebase ID Token (JWT)  
↓  
Token sent to backend via Authorization header  
↓  
Backend verifies token using Firebase Admin SDK  
↓  
Protected API response  

No custom JWT implementation — fully handled by Firebase for security and scalability.

---

# ✨ Core Features

## 🔐 Authentication
- Email & Password Login
- Email Verification Required
- Secure Backend Token Verification
- Persistent Login (30-day option)
- Auto-expiring session logic

## 📊 Dashboard
- Interactive analytics chart
- KPI summary cards
- Total / Verified / Unverified Users
- Session status tracking
- System status indicators
- Recent activity section

## 💬 Chat Messaging
- User-based message structure
- Secure session-bound messaging
- Designed for scalable real-time integration

## 🎨 Customizable Appearance
- Light / Dark mode
- Collapsible sidebar navigation
- Smooth UI animations
- Responsive layout

---

# 🧪 How to Test Locally

## 1️⃣ Clone Repository

git clone https://github.com/yourusername/leecoste.git  
cd leecoste

---

## 2️⃣ Backend Setup

cd backend  
npm install  

Create `.env`:

PORT=5000

Add Firebase Admin `serviceAccountKey.json` inside backend folder.

Start backend:

npm run dev

Backend runs on:

http://localhost:5000

---

## 3️⃣ Frontend Setup

cd frontend  
npm install  
npm run dev  

Add Firebase config inside:

src/firebase.ts

Frontend runs on:

http://localhost:5173

---

# 🌍 Deployment Guide

## 🚀 Frontend → Vercel

1. Import repository in Vercel
2. Set Root Directory to `frontend`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Add Firebase environment variables

---

## 🚀 Backend → Render

1. Create New Web Service
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Add environment variable:

PORT=10000

6. Upload Firebase Admin credentials (Secret Files recommended)

---

# 🔐 Security Notes

- Firebase manages authentication JWT tokens
- Backend verifies tokens using Firebase Admin SDK
- Email verification enforced
- Protected API routes
- Secure session handling

---

# 📈 Future Improvements

- Role-based access control
- Real-time Firestore chat sync
- Notification system
- Activity logging
- CI/CD automation
- Cloud scaling

---

# 👨‍💻 Author

Joshua Grijaldo  
Full-Stack Developer

---

# 📄 License

MIT License
