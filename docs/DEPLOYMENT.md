# Deployment Guide

Instructions for deploying OptimX to production.

---

## Vercel Deployment (Recommended)

OptimX is optimized for Vercel deployment.

### Initial Setup

1. **Connect GitHub Repository**
   - Go to https://vercel.com
   - Import your GitHub repository
   - Vercel will auto-detect Next.js configuration

2. **Configure Environment Variables**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add all variables from `.env.example`
   - Set production values for all services

3. **Configure Domains**
   - Add your custom domain in Vercel dashboard
   - Update DNS records as instructed
   - SSL certificates are automatically provisioned

### Environment Variables for Production

```bash
# Update these for production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_INTEGRATIONS_BETA_MODE=false

# Update OAuth redirect URIs
# Google Ads: https://yourdomain.com/api/auth/google-ads/callback
# Meta: https://yourdomain.com/api/meta/oauth/callback
```

### Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Auto-Deployment

- Vercel automatically deploys on git push to main branch
- Preview deployments created for pull requests
- Branch deployments for testing

---

## Platform Configuration

### Update OAuth Redirect URIs

**Google Ads API:**
1. Go to Google Cloud Console → Credentials
2. Edit OAuth 2.0 Client ID
3. Add authorized redirect URI: `https://yourdomain.com/api/auth/google-ads/callback`

**Meta (Facebook/Instagram):**
1. Go to Facebook App Dashboard → Settings → Basic
2. Add OAuth redirect URI: `https://yourdomain.com/api/meta/oauth/callback`
3. Update App Domains: `yourdomain.com`
4. Submit for App Review if using advanced permissions

---

## Database

### Supabase (Production)

- Supabase handles production database automatically
- Connection pooling enabled by default
- Automatic backups and point-in-time recovery
- Row Level Security (RLS) enforced

### Monitoring

- Enable Supabase logs in dashboard
- Set up alerts for error rates
- Monitor database performance metrics

---

## Post-Deployment Checklist

- [ ] All environment variables configured
- [ ] OAuth redirect URIs updated for production domain
- [ ] SSL certificate active (HTTPS)
- [ ] Custom domain configured
- [ ] Meta App Review completed (if using advanced permissions)
- [ ] Test all OAuth flows on production
- [ ] Monitor error logs for 48 hours
- [ ] Set up uptime monitoring (e.g., UptimeRobot)
- [ ] Configure analytics (optional)

---

## Environment Considerations

- **Database**: Supabase handles production database
- **File Storage**: Use Vercel Blob or Supabase Storage for media
- **Serverless Functions**: Next.js API routes deploy as serverless functions
- **Edge Runtime**: AI endpoints can use Edge Runtime for lower latency

---

## Monitoring & Maintenance

### Vercel Analytics

Enable Vercel Analytics in dashboard for:
- Page views and unique visitors
- Web Vitals metrics
- Real User Monitoring (RUM)

### Error Tracking

Consider integrating:
- Sentry for error tracking
- LogRocket for session replay
- Datadog for infrastructure monitoring

### Performance

- Enable Vercel Edge Network for global CDN
- Use Image Optimization (Next.js Image component)
- Enable caching for static assets

---

**See also:** [Development Guide](./DEVELOPMENT.md) | [Architecture](./ARCHITECTURE.md)
