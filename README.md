# Clarity — The Ledger Room

A self-contained, in-browser blockchain demo: real SHA-256 proof-of-work
mining, real animated P2P block propagation between three simulated wallets,
and a pick-a-wallet login screen. No backend, no database — everything runs
client-side in React.

## Run it locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Deploy to GitHub Pages

1. **Create a GitHub repo** and push this project to it (see commands below).
2. **Set the base path.** Open `vite.config.js` and set `base` to match your
   repo name:
   ```js
   base: '/your-repo-name/',
   ```
   (If this is a *user/org* Pages site — a repo literally named
   `yourusername.github.io` — set `base: '/'` instead.)
3. **Enable GitHub Pages via Actions.** In your repo: Settings → Pages →
   under "Build and deployment", set **Source** to **GitHub Actions**.
4. **Push to `main`.** The included workflow
   (`.github/workflows/deploy.yml`) builds the site and deploys it
   automatically on every push. Check the "Actions" tab for progress; your
   site will be live at `https://yourusername.github.io/your-repo-name/`
   once it finishes.

```bash
git init
git add .
git commit -m "Clarity ledger demo"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo-name.git
git push -u origin main
```

## What's real vs. simulated

- **Real:** SHA-256 hashing (Web Crypto API), proof-of-work mining, chain
  validation, the propagation-timing animation logic.
- **Simulated:** the three wallets are just randomly generated addresses
  with no real private keys or monetary value; "login" is identity
  selection, not authentication; there's no backend, so nothing persists
  between page loads or syncs between visitors — each browser tab is its
  own isolated network of three wallets.

## Project structure

```
├── index.html
├── src/
│   ├── main.jsx       # React entry point
│   ├── App.jsx        # the whole app (network graph, wallet panel, mining)
│   └── index.css      # Tailwind entry
├── vite.config.js      # set `base` here for GitHub Pages
├── tailwind.config.js
├── postcss.config.js
└── .github/workflows/deploy.yml   # auto-deploy on push to main
```
