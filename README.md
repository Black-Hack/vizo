# Vizo 📱

A modern, real-time QR code scanning application built with SvelteKit and Cloudflare Workers. Perfect for inventory management, event check-ins, and secure transaction tracking with multi-tenant support.

## ✨ Features

- **📷 Real-time QR Code Detection** – Uses the BarcodeDetector API with automatic fallback for broader browser support
- **🔐 Signature Verification** – Cryptographically signed QR codes ensure authenticity and security
- **⚡ Offline-First Architecture** – Local IndexedDB storage with automatic syncing when online
- **🔗 WebSocket Sync** – Real-time data synchronization between clients and server
- **🏢 Multi-Tenant Support** – Built for managing multiple organizations with complete data isolation
- **📱 Progressive Web App** – Works on mobile and desktop, installable without app stores
- **🚀 Serverless Backend** – Deployed on Cloudflare Workers for global edge performance
- **💾 Local Data Persistence** – Dexie-backed IndexedDB for offline functionality

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                      │
│  ┌────────────────┐        ┌────────────────┐               │
│  │  Scan Route    │        │  View Route    │               │
│  │  - Camera      │        │  - Display     │               │
│  │  - Detection   │        │  - Results     │               │
│  └────────────────┘        └────────────────┘               │
│         │                         │                          │
│  ┌────────────────────────────────────────┐                 │
│  │   Dexie IndexedDB                      │                 │
│  │   - Local Storage                      │                 │
│  │   - Offline Support                    │                 │
│  └────────────────────────────────────────┘                 │
└────────────┬──────────────────────────────────┬──────────────┘
             │ HTTP/WebSocket                   │ API Calls
             │                                  │
┌────────────▼──────────────────────────────────▼──────────────┐
│          Backend (Cloudflare Workers)                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Hono REST API                                         │  │
│  │  - WebSocket Handler                                  │  │
│  │  - Data Persistence                                   │  │
│  │  - Multi-Tenant Logic                                 │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

### Frontend
- **[SvelteKit](https://kit.svelte.dev/)** – Modern reactive web framework
- **[Svelte](https://svelte.dev/)** – Compiler-first component framework
- **[TypeScript](https://www.typescriptlang.org/)** – Type-safe development
- **[Vite](https://vitejs.dev/)** – Lightning-fast build tool

### Data & Storage
- **[Dexie](https://dexie.org/)** – Elegant wrapper for IndexedDB
- **[Barcode Detector API](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector)** – Native QR code detection
- **[barcode-detector](https://github.com/ourcodeworld/barcode-detector)** – Ponyfill for broader support

### Backend & Deployment
- **[Cloudflare Workers](https://workers.cloudflare.com/)** – Serverless execution at the edge
- **[Hono](https://hono.dev/)** – Lightweight web framework
- **[Wrangler](https://developers.cloudflare.com/workers/wrangler/)** – Cloudflare Workers CLI

### Validation & Security
- **[Zod](https://zod.dev/)** – TypeScript-first schema validation
- **WebSocket** – Real-time bidirectional communication

## 📦 Project Structure

```
vizo-final/
├── svelte/                          # Frontend source code
│   ├── app.html                    # Main HTML template
│   ├── app.css                     # Global styles
│   ├── service-worker.ts           # Service worker for PWA
│   ├── lib/
│   │   └── sig.ts                  # Signature verification logic
│   ├── routes/
│   │   ├── +layout.ts              # Root layout
│   │   ├── scan/                   # QR code scanning page
│   │   │   ├── +page.svelte        # Scan UI component
│   │   │   ├── +page.ts            # Route logic
│   │   │   ├── db.ts               # Dexie database schema
│   │   │   └── ws.ts               # WebSocket client
│   │   └── view/                   # Results view page
│   │       └── +page.svelte        # View UI component
│   └── static/                     # Static assets
├── src/                            # Shared source (build outputs)
├── build/                          # Production build output
├── wrangler.jsonc                  # Cloudflare Workers config
├── vite.config.ts                  # Vite configuration
├── svelte.config.js                # SvelteKit configuration
├── tsconfig.json                   # TypeScript configuration
├── package.json                    # Dependencies & scripts
└── README.md                       # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Cloudflare account (for deployment)

### Development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the frontend dev server**
   ```bash
   npm run dev-frontend
   ```
   Opens at `http://localhost:5173`

3. **Start the backend dev server** (in another terminal)
   ```bash
   npm run dev-backend
   ```
   Backend available at `http://localhost:8787`

The Vite proxy automatically routes `/api/` requests to the backend.

### Building for Production

```bash
npm run build
```

Generates optimized frontend in the `build/` directory.

### Previewing the Build

```bash
npm preview
```

## 🚢 Deployment

### Deploy to Cloudflare

```bash
npm run deploy
```

This command:
1. Builds the frontend
2. Deploys to Cloudflare Workers
3. Makes your app globally available on the edge

### Generate TypeScript Types for Cloudflare Bindings

```bash
npm run cf-typegen
```

## 📋 How It Works

### Scanning Flow

1. **User opens the scan page** → BarcodeDetector initializes with camera access
2. **Camera captures video** → Real-time QR code detection using native API
3. **QR code detected** → URL extracted and validated
4. **Signature verification** → Ensures QR code authenticity using cryptographic signature
5. **Data stored locally** → Tenant data saved to IndexedDB with offline support
6. **Real-time sync** → WebSocket sends pending data to server
7. **Server processes** → Backend updates persistent storage

### Data Model

Each scanned item is a `Tenant` record:
```typescript
interface Tenant {
  tenant: string          // Multi-tenant identifier
  sid: number            // Server-side ID (0 = pending sync)
  cid: string            // Client-generated unique ID
  sts: number | null     // Server timestamp
  cts: number            // Client timestamp
  actor: string | null   // User identifier (UUID)
  sub: string            // Scanned subject identifier
  val: number            // Associated value
}
```

### Offline Support

- **Pending data** stored with `sid=0` in IndexedDB
- **WebSocket sync** automatically uploads pending records
- **Service Worker** enables app functionality without internet
- **Fallback ponyfill** provides QR detection on unsupported browsers

## 🔐 Security Features

- **Cryptographic Signatures** – QR codes signed with tenant-specific keys
- **URL Validation** – Parses and validates signed parameters (`sub`, `tenant`, `sig`)
- **Signature Verification** – Uses `isValid()` to confirm QR authenticity
- **Multi-tenant Isolation** – Tenant data completely segregated
- **Actor Tracking** – Each scanner gets a unique UUID for audit trails

## 🔧 Configuration

### Environment Variables

Configure in Vite using `VIZO_` prefix:

```typescript
// vite.config.ts
envPrefix: 'VIZO_'
```

Example: `VIZO_API_URL` in `.env.local`

### Prettier Formatting

Configured in `package.json`:
- 4-space indentation (tabs)
- Line width: 100 characters
- Trailing commas enabled

## 📊 Database Schema

**Dexie version 1** with indexes on:
- `[tenant+cid]` – Primary: tenant + client ID
- `[tenant+sid]` – Server ID lookup
- `[tenant+sub]` – Subject lookup (what was scanned)

## 📱 Browser Support

- ✅ Chrome/Edge 87+
- ✅ Firefox 104+ (with ponyfill)
- ✅ Safari 16+
- ✅ Mobile browsers with camera access

## 🤝 Contributing

When working on this project:
- Follow the TypeScript strict mode
- Format code with `npm prettier`
- Use Zod for schema validation
- Test offline functionality
- Ensure WebSocket sync works properly

## 📄 License

See [LICENSE.md](LICENSE.md) for details.

## 🎯 Perfect For

- **Inventory Management** – Track items in real-time
- **Event Check-in** – Fast, offline-capable attendee tracking
- **Secure Transactions** – Cryptographically verified QR codes
- **Multi-location Ops** – Multi-tenant support for franchises/chains
- **Offline-first Apps** – Works anywhere, syncs when online

---

Built with ❤️ using modern web standards and edge computing.
