# 21 Card South Indian Open Rummy Setup

## Option A: One-Click Free Remote Deployment (Render.com)

1. Put all these files into a new GitHub repository named `rummy21-game`.
2. Sign in to [Render.com](https://render.com) (free).
3. Click **New +** -> **Web Service**.
4. Link your `rummy21-game` GitHub repo.
5. In the configuration:
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
6. Click **Deploy Web Service**.
7. Share the generated URL (e.g. `https://rummy21-game.onrender.com`) with family.
8. Everyone types the same Room Code (e.g. `FAMILY`) and joins directly from their phone/tablet/PC browser.

*Note: The built-in 25-second WebSocket ping interval keeps the connection active during play.*

## Option B: Deploying on Railway or Fly.io
This codebase conforms to standard containerless Node.js execution:
```bash
npm install
npm start