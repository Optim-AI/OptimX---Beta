# SkalX AI System Architecture

This document provides a comprehensive overview of the SkalX AI platform architecture, including system design, component interactions, data flows, and architectural patterns.

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Detailed Component Architecture](#detailed-component-architecture)
3. [Authentication & Authorization Flow](#authentication--authorization-flow)
4. [Data Flow & Integration Pipeline](#data-flow--integration-pipeline)
5. [Project Structure](#project-structure)
6. [Key Architectural Patterns](#key-architectural-patterns)

---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Web Browser<br/>React UI]
        IDB[IndexedDB<br/>Chat Storage]
    end

    subgraph "Application Layer - Next.js"
        PR[Pages Router<br/>Legacy Pages + API]
        AR[App Router<br/>Modern Routes + AI API]
        MW[Middleware<br/>Auth + Session]
    end

    subgraph "Authentication Layer"
        SA[Supabase Auth<br/>Email/OAuth]
        FA[Firebase Auth<br/>Phone]
        IS[Iron Session<br/>Server Sessions]
    end

    subgraph "Data Layer"
        SDB[(Supabase<br/>PostgreSQL)]
        SQLITE[(SQLite<br/>Local/Dev)]
        FDB[(Firebase<br/>Realtime)]
    end

    subgraph "External Services"
        GA[Google Ads API]
        META[Meta Graph API<br/>Facebook + Instagram]
        OAI[OpenAI API<br/>GPT Models]
    end

    UI --> PR
    UI --> AR
    UI --> IDB

    PR --> MW
    AR --> MW

    MW --> SA
    MW --> FA
    MW --> IS

    PR --> SDB
    PR --> SQLITE
    PR --> FDB
    AR --> SDB

    PR --> GA
    PR --> META
    AR --> OAI

    style UI fill:#e1f5ff
    style PR fill:#fff4e1
    style AR fill:#fff4e1
    style SDB fill:#e8f5e9
    style GA fill:#fce4ec
    style META fill:#fce4ec
    style OAI fill:#fce4ec
```

### Architecture Overview

SkalX AI uses a **hybrid Next.js architecture** combining both the Pages Router (legacy, mature) and App Router (modern, cutting-edge):

- **Pages Router** (`/pages`): Handles all user-facing pages and the majority of API endpoints (46 routes)
- **App Router** (`/app`): Powers AI-driven endpoints and modern component architecture

This dual-router approach enables gradual migration while maintaining stability and leveraging new Next.js 13+ features for AI operations.

---

## Related Documentation

- [API Reference](./API_REFERENCE.md) - Complete API endpoint documentation
- [Database Schema](./DATABASE.md) - Database structure and relationships
- [Development Guide](./DEVELOPMENT.md) - Setup and development workflow
- [Meta Permissions](./META_PERMISSIONS_GUIDE.md) - Meta App Review guide

---

**Last Updated:** December 21, 2025
