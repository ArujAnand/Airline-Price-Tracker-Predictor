# Flight Price Trend Predictor & Model-Driven Aggregator

A full-stack, ML-powered flight search, price forecasting, and model-driven tracking platform built for Indian domestic flight routes. The platform aggregates live flight pricing, projects price movement using statistical quantile regression (P10/P50/P90 confidence bands), evaluates festival demand spikes (e.g. Diwali, Holi), and automatically triggers model-driven booking alerts when prices hit optimal floor levels.

---

## Table of Contents
1. [System Architecture & Overview](#system-architecture--overview)
2. [Core Components & How They Work](#core-components--how-they-work)
   - [Frontend Application (React + Vite)](#1-frontend-application-src)
   - [Express Backend Server (`server.ts`)](#2-express-backend-server-serverts)
   - [Live Flight Aggregator Engine](#3-live-flight-aggregator-engine-serveraggregatorts)
   - [ML Price Prediction Engine](#4-ml-price-prediction-engine-servermlenginets--predictionts)
   - [AI Advisory & Rationale System](#5-ai-advisory--rationale-system-serverpredictionts)
   - [Model-Driven Alert Manager](#6-model-driven-alert-manager-serveralertsts)
   - [Firestore Persistence Layer](#7-firestore-persistence-layer-serverfirestoreservicets)
   - [Smart Dates & Festival Optimizer](#8-smart-dates--festival-optimizer-serversmartdatests)
   - [Ground Truth Accuracy Auditor](#9-ground-truth-accuracy-auditor-serverpredictiontrackerts)
3. [Environment Variables & Configuration](#environment-variables--configuration)
4. [Local Development & Setup](#local-development--setup)
5. [Hosting & Deployment Guide](#hosting--deployment-guide)
   - [Option 1: Full-Stack Node Hosts (Render, Railway, Fly.io, Heroku)](#option-1-full-stack-node-hosts-recommended)
   - [Option 2: Serverless Platforms (Vercel, Netlify)](#option-2-serverless-platforms-vercel-netlify)
   - [Option 3: Static Hosting + Separate API (GitHub Pages, Cloudflare Pages)](#option-3-static-hosting--separate-backend-github-pages-cloudflare-pages)
6. [API Reference](#api-reference)

---

## System Architecture & Overview

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                         React 19 Frontend (Vite)                       │
 │  [Flight Search]  [Quantile Charts]  [AI Advisor]  [Smart Dates/Alerts] │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP REST APIs
 ┌───────────────────────────────────▼────────────────────────────────────┐
 │                      Node.js / Express Backend                         │
 ├───────────────────────────────────┬────────────────────────────────────┤
 │  Flight Aggregator Service        │ ML Quantile Prediction Engine     │
 │  - Live Google Flights Collector  │ - Days-To-Departure Decay Curve    │
 │  - Snapshot In-Memory Cache       │ - Festival Surge & Demand Index    │
 ├───────────────────────────────────┼────────────────────────────────────┤
 │  Model-Driven Alert Manager       │ AI Advisory System (Gemini API)   │
 │  - Hourly Background Evaluator    │ - Single Source of Truth           │
 │  - P10 Floor & BUY_NOW Triggers   │ - Safe Deterministic Fallback     │
 ├───────────────────────────────────┴────────────────────────────────────┤
 │  Cloud Firestore Persistence Layer                                     │
 │  - Sanitized Auto-Save for Alerts, Predictions, and Fare Snapshots    │
 └────────────────────────────────────────────────────────────────────────┘
```

The system operates on **data-driven certainty**: computed ML numbers serve as the single source of truth for all pricing recommendations (`BUY_NOW` vs `WAIT`), price floor predictions (P10/P50/P90), and alert triggers. AI natural language summaries supplement the numeric model without drifting from computed values.

---

## Core Components & How They Work

### 1. Frontend Application (`src/`)
- **Technology**: React 19, Vite, Tailwind CSS v4, Lucide React, Framer Motion.
- **Purpose**: Provides an intuitive UI dashboard for users to:
  - Search live flights across domestic airport pairs (e.g. `PNQ` Pune, `LKO` Lucknow, `DEL` Delhi, `BOM` Mumbai, `BLR` Bengaluru).
  - View **Quantile Price Forecast Charts** showing current prices against P10 (floor price), P50 (expected median), and P90 (worst-case peak).
  - Read **AI Advisory Summaries** explaining price trend dynamics and risk levels.
  - Explore **Smart Dates & Festival Recommendations** for optimal holiday travel windows.
  - Track active price alerts and view alert execution history.
  - Audit historical prediction accuracy on the **Ground Truth Auditor** page.

### 2. Express Backend Server (`server.ts`)
- **Technology**: Node.js, Express, `tsx` / `esbuild`.
- **Purpose**: Acts as the central backend API server.
  - Integrates Vite development middleware in dev mode and serves compiled bundle in production (`dist/server.cjs`).
  - Initializes the hourly background flight collector and model-driven alert evaluation loops.
  - Exposes RESTful API endpoints for flight listings, price predictions, smart date finding, alert management, and prediction accuracy auditing.

### 3. Live Flight Aggregator Engine (`server/aggregator.ts`)
- **Purpose**: Fetches and caches live flight inventory and price snapshots.
  - Simulates/scrapes Google Flights data streams for specific routes and dates (`server/googleFlightsScraper.ts`).
  - Maintains route price snapshots across time to build historical fare curves.
  - Periodically refreshes flight data in the background and notifies subscriber services (e.g., the Alert Manager).

### 4. ML Price Prediction Engine (`server/mlEngine.ts` & `server/prediction.ts`)
- **Purpose**: Generates probabilistic price predictions and booking recommendations using statistical quantile modeling.
  - **Days-To-Departure Decay**: Models fare trajectories based on lead time (e.g., 60 days out vs 7 days out).
  - **Festival & Holiday Weighting**: Adjusts demand density for peak Indian travel periods (Diwali, Holi, Dussehra, year-end holidays).
  - **Quantile Outputs**:
    - **P10 (Floor Price)**: Estimated 10th percentile minimum fare.
    - **P50 (Median Price)**: Expected 50th percentile booking fare.
    - **P90 (Peak Price)**: 90th percentile upper price ceiling.
  - **Drop Probability & Action**: Calculates `dropProbabilityPercent` and sets recommendation to either `BUY_NOW` or `WAIT`.

### 5. AI Advisory & Rationale System (`server/prediction.ts`)
- **Purpose**: Translates complex ML outputs into clear, human-understandable advice using Google Gemini API (`@google/genai`).
  - **Single Source of Truth Guardrail**: Strictly validates that Gemini's generated explanation agrees numerically with the computed ML numbers.
  - **Deterministic Safe Fallback**: Automatically generates a clear mathematical rationale if Gemini is offline, rate-limited, or outputs conflicting text.

### 6. Model-Driven Alert Manager (`server/alerts.ts`)
- **Purpose**: Replaces fixed date/rule triggers with continuous model-driven evaluation.
  - **Hourly Cadence**: Connected to the flight aggregator's hourly sync hook.
  - **Optimal Firing Conditions**: An alert fires when EITHER:
    1. **Price Floor Reached**: Live price $\le$ predicted P10 floor (`currentPrice <= predictedPriceRange.min`).
    2. **Buy Recommendation**: ML model flips recommendation to `BUY_NOW` with low drop probability (`dropProbabilityPercent < 20%`).
  - **Secondary Sudden-Drop Signal**: Captures abrupt price decreases ($>5\%$ drop from baseline).
  - **Cooldown & Stateful Anti-Spam**: Marks fired alerts inactive to prevent repeated hourly notifications for the same low price.

### 7. Firestore Persistence Layer (`server/firestoreService.ts`)
- **Purpose**: Stores application data in Google Cloud Firestore.
  - Persists tracked trip alerts, prediction ground-truth audit records, notifications, and fare history snapshots.
  - **Data Sanitizer**: Contains a recursive helper (`sanitizeForFirestore`) that removes `undefined` property values before writing, eliminating Firestore SDK write errors.

### 8. Smart Dates & Festival Optimizer (`server/smartDates.ts`)
- **Purpose**: Solves vague travel queries (e.g. *"Pune to Lucknow around Diwali for a 4-5 day trip under ₹15,000"*).
  - Cross-references Indian national holidays (`server/festivals.ts`) with live price calendars to find low-fare flight dates requiring minimal work leave.

### 9. Ground Truth Accuracy Auditor (`server/predictionTracker.ts`)
- **Purpose**: Evaluates prediction quality over time.
  - Records every prediction snapshot and audits it against later actual fare outcomes to compute hit-rate percentages and quantile calibration metrics.

---

## Environment Variables & Configuration

Create a `.env` file in the project root:

```env
# Server Port Configuration
PORT=3000

# Google Gemini API Key (Optional: for AI advisory natural language generation)
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase / Firestore Configuration (Optional: for persistent database storage)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

*Note: If Firebase or Gemini API keys are not supplied, the platform automatically runs in fallback mode with in-memory persistence and deterministic rule-based advice.*

---

## Local Development & Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/flight-price-predictor.git
   cd flight-price-predictor
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Mode**:
   ```bash
   npm run dev
   ```
   The application will start on **`http://localhost:3000`**. Express serves API endpoints under `/api/*` and passes frontend requests to Vite HMR middleware.

4. **Build for Production**:
   ```bash
   npm run build
   ```
   This compiles:
   - React SPA into static files inside `dist/client/`
   - Express server into `dist/server.cjs`

5. **Run Production Server**:
   ```bash
   npm start
   ```

---

## Hosting & Deployment Guide

Different hosting platforms handle full-stack Node.js applications with background tasks differently. Below is the setup guide for each major hosting service.

---

### Option 1: Full-Stack Node Hosts (Recommended)
*Platforms: **Render**, **Railway**, **Fly.io**, **AWS App Runner**, **Heroku**, **DigitalOcean App Platform***

Because this project includes **background hourly processes** (flight aggregator and model-driven alert evaluation), deploying to a long-running Node.js container is the most seamless path.

#### Deploying on Render:
1. Connect your GitHub repository to Render.
2. Create a new **Web Service**.
3. Set the following options:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Add environment variables (`GEMINI_API_KEY`, Firebase keys) under **Environment**.
5. Click **Deploy**. Render will run the full-stack server on port 3000 (or the assigned `$PORT`).

> 💡 **Handling Render Free Tier Spin-Downs**:  
> Render's **$0 Free Plan** (512 MB RAM / 0.1 CPU) works great for this app, but free instances spin down after 15 minutes of inactivity. To keep your hourly price tracking and alert evaluations running continuously on the free plan:
> - **Method 1 (Keep-Alive Ping)**: Create a free monitor at [UptimeRobot.com](https://uptimerobot.com) or [cron-job.org](https://cron-job.org) to ping your Render app URL (`https://your-app.onrender.com/health`) every 10–14 minutes. This prevents spin-down and keeps the Node `setInterval` aggregator running 24/7.
> - **Method 2 (External Scheduled Trigger)**: Set up a free scheduled job on [cron-job.org](https://cron-job.org) or GitHub Actions to send an HTTP GET to `https://your-app.onrender.com/api/alerts/evaluate` every hour (`0 * * * *`). This wakes the instance up and evaluates all active price alerts automatically.

#### Deploying on Railway:
1. Create a new project on Railway from your GitHub repo.
2. Railway automatically detects `package.json`.
3. Configure Environment Variables.
4. Set Build Command: `npm run build` and Start Command: `npm start`.

---

### Option 2: Serverless Platforms (Vercel, Netlify)
*Platforms: **Vercel**, **Netlify***

Serverless platforms host static frontend assets on CDN and run API routes as short-lived serverless functions.

> ⚠️ **Important Technical Note for Serverless**:  
> In serverless environments, background memory timers (`setInterval`) pause when there are no active HTTP requests. To keep hourly model-driven alerts running automatically on Vercel or Netlify, set up a **scheduled cron trigger**.

#### Deploying on Vercel:

1. Create a `vercel.json` file in your root folder:
   ```json
   {
     "version": 2,
     "builds": [
       { "src": "server.ts", "use": "@vercel/node" },
       { "src": "package.json", "use": "@vercel/vite" }
     ],
     "routes": [
       { "src": "/api/(.*)", "dest": "server.ts" },
       { "src": "/(.*)", "dest": "/$1" }
     ],
     "crons": [
       {
         "path": "/api/alerts/evaluate",
         "schedule": "0 * * * *"
       }
     ]
   }
   ```
2. Import project into Vercel and set Environment Variables.
3. Deploy! Vercel Cron will trigger `/api/alerts/evaluate` every hour to run model checks.

#### Deploying on Netlify:
1. Build the Vite frontend: Build command `npm run build`, publish directory `dist`.
2. Convert Express API routes to **Netlify Functions** (`/netlify/functions/api.ts`).
3. Use **Netlify Scheduled Functions** to trigger alert evaluations hourly.

---

### Option 3: Static Hosting + Separate Backend (GitHub Pages, Cloudflare Pages)
*Platforms: **GitHub Pages**, **Cloudflare Pages***

> ⚠️ **Crucial Distinction**:  
> GitHub Pages and Cloudflare Pages (static mode) can **only** host static client-side HTML/JS/CSS assets. They **cannot** execute Node.js Express servers or background alert evaluation routines natively.

#### Recommended Architecture for GitHub Pages / Cloudflare Pages:
1. **Deploy Backend Server**: Deploy the Express server (`server.ts`) to a free/low-cost Node host (e.g. Render, Railway, or Fly.io).
2. **Deploy Frontend to GitHub Pages / Cloudflare Pages**:
   - In `vite.config.ts`, set `base: '/repo-name/'` (for GitHub Pages).
   - Configure frontend API calls to use an environment variable: `VITE_API_BASE_URL=https://your-backend.onrender.com`.
   - Run `npm run build` and deploy the contents of `dist/client` to GitHub Pages or Cloudflare Pages.

---

## API Reference

| Endpoint | Method | Description | Example Query / Body |
|---|---|---|---|
| `/api/health` | `GET` | Health check and server status | `-` |
| `/api/airports` | `GET` | List supported Indian domestic airports | `-` |
| `/api/flights` | `GET` | Fetch live/cached flight listings | `?origin=PNQ&destination=LKO&date=2026-10-18` |
| `/api/predict` | `GET` | Run ML price forecast & AI rationale | `?origin=PNQ&destination=LKO&date=2026-10-18&includeAI=true` |
| `/api/smart-dates` | `GET` | Find optimal dates around holidays | `?origin=PNQ&destination=LKO&query=Diwali` |
| `/api/alerts` | `GET` | Get all active trip alerts | `-` |
| `/api/alerts` | `POST` | Create a new model-driven alert | `{"origin":"PNQ","destination":"LKO","departureDate":"2026-11-20","targetPrice":8000}` |
| `/api/alerts/evaluate` | `POST` | Manually trigger hourly alert check | `-` |
| `/api/predictions/audit` | `GET` | View ground truth accuracy metrics | `-` |
| `/api/analytics/indices`| `GET` | Fetch route volatility & fare indices | `?routeId=PNQ-LKO` |

---

## License

MIT License. Designed and built as an AI Studio Application.
