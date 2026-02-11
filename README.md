# Oli AI - AI-Powered Marketing Automation Platform

**Version:** 0.2.0 (Beta)

---

## Overview

Oli AI is a comprehensive social media marketing automation platform that leverages AI to streamline campaign creation, management, and optimization across multiple advertising platforms. Built with modern web technologies, Oli AI provides a unified interface for managing Google Ads, Meta (Facebook/Instagram), and other major advertising platforms.

### Key Features

- ✨ **Multi-Platform Integration** - Connect and manage Google Ads, Facebook, Instagram from a single dashboard
- 🤖 **AI-Powered Content Generation** - Automated caption writing, campaign creation using OpenAI
- 📊 **Real-Time Analytics** - Comprehensive insights and metrics aggregation across all platforms
- ⚡ **Campaign Automation** - Streamlined workflow from content creation to publishing
- 💳 **Credit-Based System** - Flexible usage-based billing model
- 📱 **Responsive Dashboard** - Modern, intuitive interface built with React and Tailwind CSS

### Target Users

- Digital marketing agencies managing multiple client accounts
- Social media managers coordinating cross-platform campaigns
- Small business owners automating their marketing workflows
- Marketing teams seeking AI-powered optimization

---

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | Next.js | 15.5.7 |
| **UI Library** | React | 19.2.0 |
| **Language** | TypeScript | 5.9.2 |
| **Styling** | Tailwind CSS | 4.1.12 |
| **Components** | Radix UI | 1.x |
| **Database** | PostgreSQL (Supabase) | 15 |
| **ORM** | Drizzle ORM | 0.45.1 |
| **Storage** | Supabase Storage | - |
| **Auth** | Supabase + Firebase | - |
| **AI** | OpenAI API | 5.23.2 |
| **Ads** | Google Ads API | 21.0.1 |

**Architecture**: Hybrid Next.js (Pages + App Router) with TypeScript, Drizzle ORM, Supabase local (dev)/Supabase cloud (production), and multi-provider authentication.

For complete tech stack details, see [Architecture Documentation](./docs/ARCHITECTURE.md).

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- **Docker Desktop** (for Supabase local)
- **Supabase CLI** (`brew install supabase/tap/supabase`)
- Firebase account (for phone auth)
- Google Cloud project (for Google Ads)
- Meta Developer account (for Facebook/Instagram)

### Installation

```bash
# Clone the repository
git clone https://github.com/Optim-AI/OptimX---Beta.git
cd OptimX---Beta

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your API keys (Facebook, OpenAI, etc.)

# Start development (includes Supabase and Next.js)
./scripts/dev.sh
# or
npm run dev
```

**What `npm run dev` starts:**
- 🗄️ PostgreSQL database (port 54322) - via Supabase
- 🔐 Supabase Auth (port 54321)
- 💾 Supabase Storage (http://localhost:54321/storage)
- 🎨 Supabase Studio (http://localhost:54323) - Database UI
- 📧 Inbucket (http://localhost:54324) - Email testing
- 🌐 Next.js app (http://localhost:3000)

**First-time setup:** The script will automatically start Supabase and apply migrations.

For detailed setup instructions, see [Development Guide](./docs/DEVELOPMENT.md).

---

## Documentation

### Core Documentation

- 📐 **[Architecture](./docs/ARCHITECTURE.md)** - System design, data flows, and architectural patterns
- 🔌 **[API Reference](./docs/API_REFERENCE.md)** - Complete API endpoint documentation
- 🗄️ **[Database Schema](./docs/DATABASE.md)** - Database structure and relationships
- 🗃️ **[Supabase Local Setup](./docs/SUPABASE_LOCAL_SETUP.md)** - Complete local development setup guide
- 🛠️ **[Development Guide](./docs/DEVELOPMENT.md)** - Setup and development workflow
- 🚀 **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment instructions
- 🤝 **[Contributing](./docs/CONTRIBUTING.md)** - Contribution guidelines and workflow

### Integration Guides

- 📘 **[Meta Permissions Guide](./docs/META_PERMISSIONS_GUIDE.md)** - Complete Facebook/Instagram App Review documentation

---

## Project Structure

```
OptimX---Beta/
├── app/                    # Next.js App Router (AI endpoints)
├── pages/                  # Next.js Pages Router (main app + API)
├── lib/                    # Core business logic
│   ├── meta/              # Meta (Facebook/Instagram) integration
│   ├── supabaseClient.ts  # Database client
│   └── apiFetch.ts        # Authenticated HTTP client
├── docs/                   # Documentation
├── data/                   # Local databases (SQLite)
└── public/                 # Static assets
```

See [Architecture](./docs/ARCHITECTURE.md) for detailed project structure.

---

## Key Features

### Multi-Platform Integration
- **Google Ads**: Campaign management and analytics
- **Facebook**: Page post publishing and insights
- **Instagram**: Business account posting and comment management
- **Meta Ads**: Campaign insights and lead retrieval

### AI-Powered Tools
- Caption generation with OpenAI GPT
- Prompt enhancement and optimization
- Multi-language content translation
- Campaign recommendations

### User Management
- Email/password authentication (Supabase)
- Phone authentication with SMS OTP (Firebase)
- OAuth connections for advertising platforms
- Credit-based billing system

---

## Environment Configuration

Create `.env.local` with the following (see `.env.example` for complete template):

```bash
# Database (Prisma - auto-switches between MySQL local / PostgreSQL prod)
DATABASE_URL="mysql://optimx_user:optimx_password@localhost:3306/optimx"

# Supabase (Auth + Production Storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# MinIO (Local Storage - auto-configured via Docker)
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Firebase (Phone Auth)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key

# Meta (Facebook/Instagram)
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Integration Mode (false = production, true = beta)
NEXT_PUBLIC_INTEGRATIONS_BETA_MODE=false
```

**Storage & Database Auto-Switching:**
- Local dev (`NODE_ENV=development`): Uses MySQL + MinIO
- Production: Uses PostgreSQL + Supabase Storage

---

## Development

```bash
# Run development server (starts MySQL, MinIO, Next.js)
npm run dev

# Run ONLY Next.js (if Docker services already running)
npm run dev:next

# Prisma commands
npm run prisma:generate  # Generate Prisma Client
npm run prisma:studio    # Open Prisma Studio (database GUI)
npm run prisma:migrate   # Run database migrations

# Build for production
npm run build

# Start production server
npm start

# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Docker commands
docker-compose up -d      # Start all services
docker-compose down       # Stop all services
docker-compose logs -f    # View logs
```

**Accessing Services:**
- App: http://localhost:3000
- phpMyAdmin: http://localhost:8081 (user: `optimx_user`, password: `optimx_password`)
- MinIO Console: http://localhost:9001 (user: `minioadmin`, password: `minioadmin`)
- Prisma Studio: Run `npm run prisma:studio`

See [Development Guide](./docs/DEVELOPMENT.md) for detailed instructions.

---

## Deployment

Oli AI is optimized for Vercel deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

See [Deployment Guide](./docs/DEPLOYMENT.md) for complete instructions.

---

## Contributing

We welcome contributions! Please follow our guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See [Contributing Guide](./docs/CONTRIBUTING.md) for detailed workflow.

---

## Roadmap

### Current (v0.2.0 - Beta)
- ✅ Multi-platform integration (Google Ads, Meta)
- ✅ AI-powered content generation
- ✅ Real-time analytics
- ✅ Credit-based billing

### Upcoming (v0.3.0)
- 🔄 LinkedIn integration
- 🔄 Twitter/X integration
- 🔄 Advanced scheduling
- 🔄 A/B testing framework

### Future (v1.0.0)
- 📋 Multi-user team collaboration
- 📋 White-label options
- 📋 Advanced AI optimization
- 📋 Custom reporting dashboards

---

## Support

- **Documentation**: [/docs](./docs/)
- **Issues**: [GitHub Issues](https://github.com/Optim-AI/OptimX---Beta/issues)
- **Email**: tech.optimx@gmail.com

---

## License

MIT License - see LICENSE file for details

---

## Acknowledgments

Built with amazing open-source technologies:

- [Next.js](https://nextjs.org/) - The React Framework
- [Supabase](https://supabase.com/) - Open Source Firebase Alternative
- [Radix UI](https://www.radix-ui.com/) - Accessible UI Components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-First CSS
- [OpenAI](https://openai.com/) - AI-Powered Features

---

**Oli AI** - Automate smarter, market better.
