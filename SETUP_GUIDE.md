# RunTrack — Full-Stack Setup Guide

From your downloaded zip to a live app on Railway.

---

## What you're setting up

```
Browser  →  server.js (Node/Express on Railway)  →  OpenRouter AI API
                     ↓
              Firebase Firestore (your existing data)
```

Your OpenRouter API key lives **only on the server** — never in the browser.

---

## Part 1 — File structure on your computer

After unzipping, your folder should look exactly like this:

```
runtrack/
├── server.js            ← Express backend (handles AI calls)
├── package.json         ← Node dependencies
├── .env.example         ← Template for your secret key
├── .gitignore           ← Keeps .env out of Git
└── public/
    ├── index.html       ← The app's HTML shell
    ├── style.css        ← All styling
    └── app.js           ← All frontend logic + Firebase
```

**Where to store it on your computer:**
Put the `runtrack` folder somewhere permanent — not in Downloads. Good options:
- `Documents/Projects/runtrack`
- `Desktop/runtrack`
- `~/code/runtrack` (if you have a code folder)

---

## Part 2 — Install Node.js (if you don't have it)

1. Go to **[nodejs.org](https://nodejs.org)**
2. Download the **LTS** version (the left button)
3. Run the installer, click through all the defaults
4. To verify it worked, open Terminal (Mac/Linux) or Command Prompt (Windows) and type:
   ```
   node --version
   ```
   You should see something like `v20.x.x`

---

## Part 3 — Get your OpenRouter API key

1. Go to **[openrouter.ai](https://openrouter.ai)** and sign up (no credit card required)
2. Go to **[openrouter.ai/keys](https://openrouter.ai/keys)**
3. Click **Create Key** — name it "RunTrack"
4. Copy the key — it starts with `sk-or-...`
5. Keep this tab open, you'll need it in the next step

---

## Part 4 — Configure your local environment

1. Open the `runtrack` folder
2. Find the file called `.env.example`
3. **Make a copy of it** and rename the copy to `.env` (just `.env`, no other extension)
4. Open `.env` in any text editor (Notepad, TextEdit, VS Code)
5. Replace the placeholder with your real key:
   ```
   OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
   PORT=3000
   ```
6. Save the file

> ⚠️ **Important:** The `.env` file is in `.gitignore` — it will never be uploaded to GitHub. That's intentional. Never share this file.

---

## Part 5 — Run the app locally (test before deploying)

1. Open Terminal / Command Prompt
2. Navigate to your project folder:
   ```bash
   cd path/to/runtrack
   ```
   For example:
   ```bash
   cd Documents/Projects/runtrack
   ```
3. Install dependencies (only needed once):
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open your browser and go to:
   ```
   http://localhost:3000
   ```

You should see RunTrack load. The AI Coach should work. If it does, you're ready to deploy.

To stop the server: press `Ctrl + C` in the terminal.

---

## Part 6 — Put your code on GitHub

Railway deploys directly from GitHub, so you need to push your code there first.

### 6a — Install Git (if you don't have it)
- Mac: Git is likely already installed. Run `git --version` to check.
- Windows: Download from **[git-scm.com](https://git-scm.com)** and install with defaults.

### 6b — Create a GitHub account
Go to **[github.com](https://github.com)** and sign up if you don't have an account.

### 6c — Create a new repository
1. Click the **+** icon (top right) → **New repository**
2. Name it `runtrack`
3. Set it to **Private** (recommended — your Firebase config is in app.js)
4. **Do NOT** check "Add a README" or "Add .gitignore"
5. Click **Create repository**

### 6d — Push your code

In your terminal, inside the `runtrack` folder, run these commands one by one:

```bash
git init
git add .
git commit -m "Initial RunTrack commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/runtrack.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

When it asks for a password, GitHub now requires a **Personal Access Token** instead. Generate one at **[github.com/settings/tokens](https://github.com/settings/tokens)** → Generate new token (classic) → check `repo` scope → copy and use it as your password.

---

## Part 7 — Deploy to Railway

### 7a — Sign up for Railway
1. Go to **[railway.app](https://railway.app)**
2. Click **Login** → **Login with GitHub**
3. Authorise Railway to access your GitHub

### 7b — Create a new project
1. From the Railway dashboard, click **New Project**
2. Select **Deploy from GitHub repo**
3. Find and select your `runtrack` repository
4. Railway will detect it's a Node.js app automatically

### 7c — Add your environment variable
This is the critical step — Railway needs your OpenRouter key.

1. In your Railway project, click on the service (the box that appeared)
2. Go to the **Variables** tab
3. Click **New Variable**
4. Add:
   - **Name:** `OPENROUTER_API_KEY`
   - **Value:** `sk-or-v1-your-actual-key-here`
5. Click **Add**
6. Railway will automatically redeploy with the new variable

> You do NOT need to set `PORT` — Railway sets that automatically.

### 7d — Get your live URL
1. Go to the **Settings** tab of your service
2. Under **Networking**, click **Generate Domain**
3. Railway gives you a URL like `runtrack-production-xxxx.up.railway.app`
4. Open that URL — your app is live 🎉

---

## Part 8 — Every time you make changes

If you edit any files locally and want to update the live app:

```bash
git add .
git commit -m "Describe what you changed"
git push
```

Railway automatically detects the push and redeploys within about 30 seconds.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails | Make sure Node.js is installed and you're in the right folder |
| App loads but AI doesn't work locally | Check your `.env` file — key must start with `sk-or-` |
| Railway deploy fails | Check the **Deploy Logs** tab in Railway for the error |
| AI doesn't work on Railway | Check the **Variables** tab — make sure `OPENROUTER_API_KEY` is set correctly |
| Page not found on Railway | Check **Settings → Networking** and make sure a domain is generated |
| Firebase not syncing | This uses your existing Firebase project — no changes needed |

---

## Summary of files to never share

| File | Why |
|---|---|
| `.env` | Contains your OpenRouter API key |

Everything else is safe to share or commit to a public repo — **except** the Firebase config in `app.js`, which is why keeping the GitHub repo **Private** is recommended.

---

*RunTrack — built with Node.js + Express + Firebase + OpenRouter*
