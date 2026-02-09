# Admin Dashboard

Simple admin dashboard for managing the OptimX plan system.

## Access

**URL:** `/admin/login`

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

> ⚠️ **IMPORTANT:** Change these credentials in your `.env` file before deploying to production!

## Environment Variables

Add to your `.env` or `.env.local`:

```bash
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
```

## Features

### 📊 Dashboard Overview
- Real-time plan system status
- Statistics (total plans, active/inactive counts)
- Current mode (Subscription vs Pay-as-you-go)

### 🔧 Plan Management
- **Enable All Plans** - Requires users to select a plan after signup
- **Disable All Plans** - Users can signup with pay-as-you-go credits only
- View all plans with details (price, credits, status)

### 🔒 Security
- Session-based authentication (24-hour token validity)
- Protected API routes
- Auto-logout on token expiration

## How It Works

### 1. Login
Visit `/admin/login` and enter credentials.

### 2. Dashboard
View system status and plan details at `/admin/dashboard`.

### 3. Toggle Plans

**Disable Plans (Pay-as-you-go only):**
- Click "Disable All Plans"
- Users can signup without selecting a plan
- `/pricing` page redirects to `/buy-credits`

**Enable Plans (Subscription mode):**
- Click "Enable All Plans"
- Users must select a plan after signup
- `/pricing` page shows plan options

## API Endpoints

All admin endpoints require the `Authorization: Bearer <token>` header:

- `POST /api/admin/login` - Admin login
- `GET /api/admin/plans/status` - Get plan system status
- `POST /api/admin/plans/toggle` - Toggle all plans on/off

## Session Management

- Sessions expire after 24 hours
- Token stored in localStorage
- Auto-redirect to login on expiration

## Production Deployment

1. **Set strong credentials:**
   ```bash
   ADMIN_USERNAME=your_secure_username
   ADMIN_PASSWORD=your_very_strong_password_here
   ```

2. **Consider additional security:**
   - Add IP whitelisting
   - Enable 2FA (future enhancement)
   - Use HTTPS only
   - Implement rate limiting

## Screenshots

### Login Page
Simple, secure login with admin credentials.

### Dashboard
- System status indicator (Enabled/Disabled)
- Toggle button to enable/disable all plans
- Statistics cards showing plan counts
- Full plan list with details

## Need Help?

- Forgot password? Update `.env` file and restart server
- Can't access dashboard? Check if `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set
- Token expired? Just login again
