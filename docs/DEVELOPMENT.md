# Development Guide

Complete guide for setting up and developing OptimX locally.

---

## Prerequisites

- Node.js 18+ (recommended: 20+)
- npm or yarn package manager
- Supabase account (database + auth)
- Firebase account (phone authentication)
- Google Cloud project (Google Ads API)
- Meta Developer account (Facebook/Instagram)

---

## Environment Variables

Create `.env.local` file in root directory (see `.env.example` for complete template):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64=base64_encoded_service_account
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id

# Google Ads API
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token

# Meta (Facebook/Instagram)
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_API_VERSION=23.0
NEXT_PUBLIC_APP_URL=http://localhost:3000

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Integration Mode
NEXT_PUBLIC_INTEGRATIONS_BETA_MODE=false

# Session Secret
SESSION_SECRET=your_random_secret_string_minimum_32_chars
```

---

## Installation

```bash
# Clone the repository
git clone https://github.com/Optim-AI/OptimX---Beta.git
cd OptimX---Beta

# Install dependencies
npm install

# Run development server
npm run dev
```

Access the application at `http://localhost:3000`

---

## Database Setup

### Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Run the SQL scripts from [DATABASE.md](./DATABASE.md) to create tables
3. Enable authentication providers in Supabase dashboard
4. Configure OAuth redirect URLs

### Firebase Setup

1. Create Firebase project at https://console.firebase.google.com
2. Enable Phone Authentication
3. Download service account JSON
4. Base64 encode and add to `.env.local`:

```bash
cat service-account.json | base64 > service-account-base64.txt
# Copy content to FIREBASE_SERVICE_ACCOUNT_JSON_BASE64
```

---

## Integration Platform Setup

### Google Ads API

1. Create Google Cloud project
2. Enable Google Ads API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI: `http://localhost:3000/api/auth/google-ads/callback`
5. Apply for developer token at https://ads.google.com/aw/apicenter

### Meta (Facebook/Instagram)

1. Create app at https://developers.facebook.com
2. Add Products: Facebook Login, Instagram Graph API, Marketing API
3. Configure OAuth redirect URI: `http://localhost:3000/api/meta/oauth/callback`
4. Add test users as Admin/Developer for development mode
5. See [META_PERMISSIONS_GUIDE.md](./META_PERMISSIONS_GUIDE.md) for detailed setup

---

## Build & Test

```bash
# Production build
npm run build

# Start production server locally
npm start

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

---

## Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature-name`
2. Make changes and test locally
3. Commit with descriptive message
4. Push and create pull request
5. Wait for code review

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## Troubleshooting

**OAuth redirect fails**
- Ensure redirect URIs match exactly in platform settings and `.env.local`

**Supabase connection timeout**
- Check environment variables and network connectivity

**SQLite database locked**
- Close all connections, delete `.sqlite-shm` and `.sqlite-wal` files

**TypeScript errors after dependency update**
- Delete `node_modules` and `package-lock.json`, reinstall with `npm install`

---

**See also:** [Architecture](./ARCHITECTURE.md) | [Database](./DATABASE.md) | [Deployment](./DEPLOYMENT.md)
