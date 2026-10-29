# POSHub Pro - Restaurant KOT & Billing System

A modern multi-tenant restaurant POS system featuring live KOT order punching, Kitchen Display System (KDS), manager billing with GST, admin staff credential control, and real-time Firebase Firestore synchronization.

---

## 🚀 How to Publish to GitHub Pages

This repository is already configured with relative paths (`base: './'`) and a pre-configured GitHub Actions workflow.

### Option 1: Automatic Deployment via GitHub Actions (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Configure POSHub Pro for GitHub Pages"
   git push origin main
   ```

2. **Enable GitHub Pages in your repository**:
   - Open your repository on [GitHub.com](https://github.com).
   - Go to **Settings** (tab at the top).
   - In the left sidebar, click **Pages**.
   - Under **Build and deployment** > **Source**, change the dropdown to:
     👉 **GitHub Actions**
   - That's it! GitHub Actions will immediately build and deploy the app.

3. **View your live site**:
   - Once the action finishes (typically 30–60 seconds), your live URL will be:
     `https://<your-username>.github.io/<your-repo-name>/`

---

### Option 2: Manual Deploy via `gh-pages`

You can also deploy directly using npm:
```bash
npm run deploy
```
This builds the project and pushes the `/dist` folder directly to the `gh-pages` branch.

---

## 🔐 Default Admin & Staff Credentials (Pre-configured in Firestore)

| Role | Username | Password / PIN | Description |
|---|---|---|---|
| **Super Admin** | `admin` | `admin123` | Can create & manage staff logins, add restaurants & dishes |
| **Manager** | `manager` | `1234` | Running table bills, 5% GST computation, Cash/UPI settlement |
| **Waiter** | `waiter` | `1234` | Select tables, search dishes, add chef notes, punch KOT |
| **Kitchen Chef** | `kitchen` | `1234` | Kitchen Display System (KDS) live ticket progress (*Start ➔ Cooking ➔ Ready*) |

---

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Build for production
npm run build
```
