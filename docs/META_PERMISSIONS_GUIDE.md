# Meta (Facebook/Instagram) Permissions Guide for SkalX AI

**Document Version:** 1.0
**Last Updated:** December 21, 2025
**Product:** SkalX AI - AI-Powered Marketing Automation Platform

---

## Table of Contents

1. [Overview](#overview)
2. [SkalX AI Meta Integration Features](#optimx-meta-integration-features)
3. [Complete Permissions List](#complete-permissions-list)
4. [Detailed Permission Explanations](#detailed-permission-explanations)
5. [Feature-to-Permission Mapping](#feature-to-permission-mapping)
6. [App Review Submission Guide](#app-review-submission-guide)
7. [Testing Instructions](#testing-instructions)

---

## Overview

### What is SkalX AI?

SkalX AI is an **AI-powered social media marketing automation platform** that helps digital marketing agencies, social media managers, and businesses streamline their advertising campaigns across multiple platforms. The platform provides:

- **Unified dashboard** for managing Facebook Pages, Instagram Business accounts, and advertising campaigns
- **AI-powered content generation** for captions and campaign creation
- **Automated posting** to Facebook Pages and Instagram
- **Real-time analytics** and performance insights
- **Lead generation management** for Meta lead ads
- **Comment management** and engagement tools

### Why We Need Meta Permissions

SkalX AI integrates with Meta's Graph API to enable users to manage their own Facebook Pages, Instagram Business accounts, and advertising campaigns directly from the SkalX AI dashboard. All permissions requested are essential for delivering our core product functionality.

**Important:** SkalX AI only accesses data that belongs to the authenticated user. We do not access or store data from other users' accounts.

---

## SkalX AI Meta Integration Features

### Core Features Requiring Meta Permissions

| Feature | Description | User Benefit |
|---------|-------------|--------------|
| **Account Connection** | One-click OAuth to connect Facebook Pages and Instagram Business accounts | Seamless setup without manual credential management |
| **Instagram Post Publishing** | Create and publish photo posts to Instagram with AI-generated captions | Automated content distribution across Instagram |
| **Facebook Post Publishing** | Create and publish text/photo posts to Facebook Pages | Streamlined Facebook Page content management |
| **Comment Management** | Read and respond to comments on Facebook and Instagram posts | Centralized engagement and customer interaction |
| **Analytics Dashboard** | View post performance metrics (likes, comments, reach, impressions) | Data-driven decision making for content strategy |
| **Ad Campaign Insights** | Monitor Facebook/Instagram ad performance (spend, clicks, conversions) | ROI tracking and campaign optimization |
| **Lead Generation** | Access and export leads from Meta lead ads | Integrated lead management workflow |

---

## Complete Permissions List

### Summary Table

| Permission Name | Type | Category | Required For |
|----------------|------|----------|--------------|
| `instagram_basic` | Standard | Instagram | View Instagram account info, posts, and metrics |
| `instagram_content_publish` | **Advanced** | Instagram | Publish posts to Instagram Business accounts |
| `instagram_manage_comments` | **Advanced** | Instagram | Read and reply to Instagram comments |
| `pages_show_list` | Standard | Facebook Pages | List user's Facebook Pages |
| `pages_read_engagement` | Standard | Facebook Pages | Read Page insights and engagement metrics |
| `pages_read_user_content` | Standard | Facebook Pages | Read posts and content from Pages |
| `pages_manage_posts` | **Advanced** | Facebook Pages | Create and delete Facebook Page posts |
| `ads_read` | **Advanced** | Advertising | Read ad campaigns, ad sets, and insights |
| `ads_management` | **Advanced** | Advertising | Manage ad campaigns (future feature) |
| `leads_retrieval` | **Advanced** | Lead Generation | Retrieve leads from lead ads |

**Total Permissions:** 10
**Standard Permissions:** 4
**Advanced Permissions (Require App Review):** 6

---

## Detailed Permission Explanations

### Instagram Permissions

#### 1. `instagram_basic` (Standard)

**Permission Type:** Standard (No App Review Required)

**Why SkalX AI Needs This:**
- Display user's Instagram Business account information
- Retrieve Instagram posts for the analytics dashboard
- Show post metrics (likes, comments count, media type)
- Enable users to view their Instagram content within SkalX AI

**Product Features Enabled:**
- Instagram account connection and verification
- Instagram posts list view (`GET /api/instagram/posts/list`)
- Individual post details (`GET /api/instagram/posts/[id]`)
- Analytics dashboard Instagram metrics

**API Calls Used:**
```
GET /{ig-user-id}/media
GET /{media-id}?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count
```

**Code References:**
- `lib/meta/instagram.ts:98-118` - `getInstagramPosts()`
- `lib/meta/instagram.ts:123-141` - `getInstagramMedia()`
- `pages/api/instagram/posts/list.ts`
- `pages/api/instagram/posts/[id].ts`

---

#### 2. `instagram_content_publish` (Advanced)

**Permission Type:** Advanced (Requires App Review)

**Why SkalX AI Needs This:**
SkalX AI's core value proposition is **automated content distribution**. Users create content once (often using our AI caption generator) and publish it across multiple platforms from a single interface. This permission is essential for the Instagram publishing workflow.

**Product Features Enabled:**
- Create Instagram posts from SkalX AI dashboard
- AI-generated caption publishing
- Multi-platform campaign distribution (publish same content to Facebook + Instagram)
- Scheduled post publishing (future feature)

**API Calls Used:**
```
POST /{ig-user-id}/media (Create media container)
POST /{ig-user-id}/media_publish (Publish media)
```

**User Workflow:**
1. User creates content in SkalX AI (with AI-generated caption)
2. User previews post
3. User clicks "Publish to Instagram"
4. SkalX AI uses this permission to publish on their behalf

**Code References:**
- `lib/meta/instagram.ts:26-60` - `createInstagramMedia()`
- `lib/meta/instagram.ts:65-93` - `publishInstagramMedia()`
- `pages/api/instagram/posts/create.ts:23-50`

**App Review Justification:**
> "SkalX AI is a social media marketing automation platform. Users connect their Instagram Business accounts to publish marketing content directly from our dashboard. This permission allows users to distribute AI-generated content to Instagram without leaving the SkalX AI interface, streamlining their workflow and reducing time spent on repetitive posting tasks."

---

#### 3. `instagram_manage_comments` (Advanced)

**Permission Type:** Advanced (Requires App Review)

**Why SkalX AI Needs This:**
Social media management requires **centralized engagement**. Users need to respond to customer comments across all platforms from one dashboard. This permission enables SkalX AI to retrieve and respond to Instagram comments on the user's behalf.

**Product Features Enabled:**
- View all comments on Instagram posts in SkalX AI dashboard
- Reply to Instagram comments directly from SkalX AI
- Comment moderation and management
- Engagement tracking and analytics

**API Calls Used:**
```
GET /{media-id}/comments
POST /{media-id}/comments (Reply to comments)
```

**User Workflow:**
1. User views their Instagram posts in SkalX AI
2. User clicks "View Comments" on a post
3. SkalX AI displays all comments
4. User can reply directly from SkalX AI interface

**Code References:**
- `lib/meta/instagram.ts:171-188` - `getInstagramComments()`
- `lib/meta/instagram.ts:193-221` - `postInstagramComment()`
- `pages/api/instagram/posts/[id]/comments.ts`

**App Review Justification:**
> "SkalX AI provides a unified inbox for social media engagement. Users manage comments from Instagram and Facebook in one place, enabling faster response times and better customer service. This permission allows users to view and respond to Instagram comments without switching between platforms."

---

### Facebook Pages Permissions

#### 4. `pages_show_list` (Standard)

**Permission Type:** Standard (No App Review Required)

**Why SkalX AI Needs This:**
During the OAuth connection flow, SkalX AI needs to discover which Facebook Pages the user manages. This is the first step in connecting a Facebook Page to SkalX AI.

**Product Features Enabled:**
- List all Facebook Pages user manages during setup
- Allow user to select which Page to connect to SkalX AI
- Display Page name and basic info in account settings

**API Calls Used:**
```
GET /me/accounts
GET /{page-id}?fields=name,access_token
```

**Code References:**
- `pages/api/meta/oauth/callback.ts:120-132` (OAuth flow)
- `lib/meta/auth.ts:36-47` (Page verification)

---

#### 5. `pages_read_engagement` (Standard)

**Permission Type:** Standard (No App Review Required)

**Why SkalX AI Needs This:**
SkalX AI's **analytics dashboard** displays Facebook Page performance metrics. Users need to see engagement data (likes, comments, shares, reach) to measure campaign effectiveness.

**Product Features Enabled:**
- Facebook Page insights dashboard
- Post engagement metrics (reactions, comments count)
- Page-level analytics (impressions, reach, engaged users)
- Performance comparison across posts

**API Calls Used:**
```
GET /{page-id}/insights?metric=page_impressions,page_engaged_users,page_post_engagements
GET /{post-id}?fields=reactions.summary(true),comments.summary(true)
```

**Code References:**
- `lib/meta/facebook.ts:219-241` - `getPageInsights()`
- `lib/meta/facebook.ts:71-100` - `getFacebookPosts()` (includes engagement)

---

#### 6. `pages_read_user_content` (Standard)

**Permission Type:** Standard (No App Review Required)

**Why SkalX AI Needs This:**
Users need to view their previously published Facebook Page posts within the SkalX AI dashboard to track what content they've shared and manage their content calendar.

**Product Features Enabled:**
- Display list of Facebook Page posts
- View individual post details
- Content calendar view (past and future posts)
- Post performance history

**API Calls Used:**
```
GET /{page-id}/posts?fields=id,message,created_time,permalink_url,full_picture
GET /{post-id}?fields=id,message,created_time,permalink_url
```

**Code References:**
- `lib/meta/facebook.ts:71-100` - `getFacebookPosts()`
- `lib/meta/facebook.ts:105-132` - `getFacebookPost()`
- `pages/api/facebook/posts/list.ts`

---

#### 7. `pages_manage_posts` (Advanced)

**Permission Type:** Advanced (Requires App Review)

**Why SkalX AI Needs This:**
SkalX AI's primary use case is **automated content publishing** to Facebook Pages. This permission is critical for enabling users to publish marketing content from the SkalX AI dashboard.

**Product Features Enabled:**
- Create Facebook Page posts (text, photo, link)
- Publish AI-generated content to Facebook
- Delete posts if needed
- Multi-platform publishing (same content to Facebook + Instagram)

**API Calls Used:**
```
POST /{page-id}/feed (Create text/link post)
POST /{page-id}/photos (Create photo post)
DELETE /{post-id} (Delete post)
```

**User Workflow:**
1. User creates content in SkalX AI (AI-assisted)
2. User selects "Publish to Facebook"
3. SkalX AI publishes post to user's Facebook Page
4. User can delete post later if needed

**Code References:**
- `lib/meta/facebook.ts:25-66` - `createFacebookPost()`
- `lib/meta/facebook.ts:137-157` - `deleteFacebookPost()`
- `pages/api/facebook/posts/create.ts`
- `pages/api/facebook/posts/[id].ts`

**App Review Justification:**
> "SkalX AI is a marketing automation platform that enables users to publish content to their Facebook Pages directly from our interface. Users create marketing posts (often with AI-generated captions) and distribute them across Facebook and Instagram simultaneously. This permission is essential for our core product functionality of automated content publishing to Facebook Pages that the user manages."

---

### Advertising Permissions

#### 8. `ads_read` (Advanced)

**Permission Type:** Advanced (Requires App Review)

**Why SkalX AI Needs This:**
Marketing agencies and advertisers using SkalX AI need **centralized ad performance tracking**. This permission allows SkalX AI to display Facebook and Instagram ad campaign metrics alongside organic content performance.

**Product Features Enabled:**
- View ad campaigns, ad sets, and ads
- Display ad performance metrics (impressions, clicks, spend, CTR, CPC)
- ROI tracking and campaign analytics
- Cross-platform ad performance comparison

**API Calls Used:**
```
GET /act_{ad-account-id}/campaigns
GET /act_{ad-account-id}/adsets
GET /act_{ad-account-id}/ads
GET /{campaign-id}/insights?fields=impressions,clicks,spend,reach,ctr,cpc,cpm
```

**Code References:**
- `lib/meta/ads.ts:63-87` - `getCampaigns()`
- `lib/meta/ads.ts:92-127` - `getAdSets()`
- `lib/meta/ads.ts:132-171` - `getAds()`
- `lib/meta/ads.ts:176-205` - `getInsights()`
- `pages/api/meta/ads/campaigns.ts`
- `pages/api/meta/ads/insights.ts`

**App Review Justification:**
> "SkalX AI provides a unified analytics dashboard for marketing professionals. Users need to view their Facebook and Instagram ad campaign performance alongside organic content metrics to make informed marketing decisions. This permission allows read-only access to ad insights for campaigns the user manages, enabling comprehensive ROI tracking and performance optimization."

---

#### 9. `ads_management` (Advanced)

**Permission Type:** Advanced (Requires App Review)

**Why SkalX AI Needs This:**
**Future feature:** SkalX AI will enable users to create and manage Facebook/Instagram ad campaigns directly from the dashboard. This permission is requested proactively to support upcoming campaign creation functionality.

**Product Features Enabled (Planned):**
- Create ad campaigns from SkalX AI dashboard
- Pause/resume ad campaigns
- Adjust ad budgets and targeting
- Automated campaign optimization based on AI recommendations

**API Calls Planned:**
```
POST /act_{ad-account-id}/campaigns (Create campaign)
POST /act_{ad-account-id}/adsets (Create ad set)
POST /act_{ad-account-id}/ads (Create ad)
POST /{campaign-id} (Update campaign status/budget)
```

**Current Status:**
Currently, SkalX AI only uses `ads_read` for displaying ad insights. The `ads_management` permission is included in the OAuth request to prepare for future ad creation features planned for Q1 2026.

**Code References:**
- `pages/api/meta/oauth/start.ts:46` (Requested in OAuth scope)
- Future implementation planned in `lib/meta/ads.ts`

**App Review Justification:**
> "SkalX AI is building comprehensive ad campaign management features. While currently we only display ad insights (using ads_read), we are preparing to launch ad creation and management capabilities in Q1 2026. This will allow users to create and optimize Facebook/Instagram ad campaigns directly from SkalX AI, complementing our existing organic content publishing features. We request this permission now to enable seamless feature rollout without requiring users to re-authenticate."

---

### Lead Generation Permissions

#### 10. `leads_retrieval` (Advanced)

**Permission Type:** Advanced (Requires App Review)

**Why SkalX AI Needs This:**
Businesses running **Meta lead ads** need to access their leads quickly. SkalX AI provides a centralized lead management interface where users can view, export, and manage leads from their Facebook/Instagram lead ad campaigns.

**Product Features Enabled:**
- View all lead ad forms for connected ad accounts
- Retrieve leads from lead ad campaigns
- Export leads to CSV or CRM integration
- Lead notification and follow-up workflow

**API Calls Used:**
```
GET /act_{ad-account-id}/leadgen_forms
GET /{form-id}/leads
```

**User Workflow:**
1. User runs lead ads on Facebook/Instagram (outside SkalX AI)
2. User connects ad account to SkalX AI
3. SkalX AI displays all lead forms
4. User views and exports leads from SkalX AI dashboard

**Code References:**
- `lib/meta/ads.ts:234-256` - `getLeadForms()`
- `lib/meta/ads.ts:210-229` - `getLeads()`
- `pages/api/meta/ads/leads.ts`

**App Review Justification:**
> "SkalX AI provides lead management for marketing professionals running Facebook and Instagram lead ad campaigns. Users need to access leads generated from their own ad campaigns to follow up with potential customers. This permission allows SkalX AI to retrieve leads from lead ads that belong to the authenticated user's ad accounts, enabling centralized lead management and faster response times."

---

## Feature-to-Permission Mapping

### Quick Reference Table

| SkalX AI Feature | Required Permissions | Permission Type |
|----------------|---------------------|-----------------|
| **Connect Instagram Account** | `instagram_basic`, `pages_show_list` | Standard |
| **View Instagram Posts** | `instagram_basic` | Standard |
| **Publish Instagram Posts** | `instagram_basic`, `instagram_content_publish` | Standard + Advanced |
| **Manage Instagram Comments** | `instagram_basic`, `instagram_manage_comments` | Standard + Advanced |
| **Connect Facebook Page** | `pages_show_list` | Standard |
| **View Facebook Posts** | `pages_read_user_content` | Standard |
| **Publish Facebook Posts** | `pages_show_list`, `pages_manage_posts` | Standard + Advanced |
| **View Facebook Engagement** | `pages_read_engagement` | Standard |
| **Manage Facebook Comments** | `pages_read_user_content`, `pages_manage_posts` | Standard + Advanced |
| **View Facebook Page Insights** | `pages_read_engagement` | Standard |
| **View Ad Campaigns** | `ads_read` | Advanced |
| **View Ad Performance** | `ads_read` | Advanced |
| **Retrieve Leads** | `leads_retrieval` | Advanced |
| **Create/Manage Ads** (Future) | `ads_management` | Advanced |

---

## App Review Submission Guide

### Preparation Checklist

Before submitting your Meta app for review:

- [ ] **App is in Development Mode** (allows testing with test users)
- [ ] **Valid OAuth Redirect URIs configured** (`https://yourdomain.com/api/meta/oauth/callback`)
- [ ] **Privacy Policy URL added** to app settings
- [ ] **Terms of Service URL added** to app settings
- [ ] **App icon uploaded** (1024x1024px)
- [ ] **Business verification completed** (required for advanced permissions)
- [ ] **All required products added** (Facebook Login, Instagram Graph API, Marketing API)

### Required Documentation

#### 1. Privacy Policy

Your Privacy Policy must explicitly state:

- What data you collect from Meta (posts, comments, insights, ad data, leads)
- How you use the data (display in dashboard, analytics, publishing)
- How long you retain data
- User's ability to disconnect and delete data
- Contact information for privacy inquiries

#### 2. Data Deletion Instructions

Meta requires a data deletion callback URL or instructions. Add to your Privacy Policy:

> "Users can request data deletion by disconnecting their Facebook/Instagram account from SkalX AI settings, or by emailing privacy@optimx.com. We will delete all stored data within 30 days."

#### 3. Step-by-Step Instructions for Reviewers

Create a detailed guide for Meta reviewers:

```
HOW TO TEST OPTIMX META INTEGRATION

Test Account Credentials:
- Email: reviewer@optimx-test.com
- Password: [provided separately]

Instagram Publishing Test (instagram_content_publish):
1. Log in to SkalX AI at https://optimx.com
2. Go to "Integrations" page
3. Click "Connect" on Meta Ads card
4. Authorize with test Facebook account
5. Navigate to "Content" → "Create Post"
6. Enter caption: "Test post from SkalX AI"
7. Upload test image (any image works)
8. Select "Instagram" as platform
9. Click "Publish"
10. Verify post appears on connected Instagram account

Comment Management Test (instagram_manage_comments):
1. Go to "Content" → "Posts"
2. Find an Instagram post with comments
3. Click "View Comments"
4. Type a reply: "Thanks for your comment!"
5. Click "Send Reply"
6. Verify reply appears on Instagram

Facebook Page Posting Test (pages_manage_posts):
1. Navigate to "Content" → "Create Post"
2. Enter message: "Test Facebook post from SkalX AI"
3. Select "Facebook" as platform
4. Click "Publish"
5. Verify post appears on connected Facebook Page

Ad Insights Test (ads_read):
1. Go to "Analytics" → "Ads"
2. View list of ad campaigns
3. Click on a campaign to see insights
4. Verify metrics display (spend, clicks, impressions)

Leads Test (leads_retrieval):
1. Go to "Leads" → "Meta Leads"
2. View list of lead forms
3. Click on a form to view leads
4. Verify lead data displays correctly
```

### Screencasts/Screenshots

Prepare screen recordings for each advanced permission:

1. **instagram_content_publish**:
   - Show full flow from login → create post → publish to Instagram
   - Duration: 30-60 seconds
   - Show the published post on Instagram app as verification

2. **instagram_manage_comments**:
   - Show viewing comments and replying from SkalX AI
   - Show the reply appearing on Instagram app
   - Duration: 30-45 seconds

3. **pages_manage_posts**:
   - Show publishing a post to Facebook Page
   - Verify post on Facebook
   - Duration: 30-45 seconds

4. **ads_read**:
   - Show ad campaigns list and insights dashboard
   - Duration: 20-30 seconds

5. **leads_retrieval**:
   - Show lead forms list and lead data
   - Duration: 20-30 seconds

6. **ads_management** (if using):
   - Explain this is for future features
   - Show placeholder UI or roadmap

### App Review Submission Text

#### Platform Use Case

Select: **"Help people connect and share"**

#### Detailed Description

```
SkalX AI is a social media marketing automation platform that helps businesses
and marketing agencies manage their Facebook Pages, Instagram Business accounts,
and advertising campaigns from a unified dashboard.

Our users are:
- Digital marketing agencies managing client social media accounts
- Small business owners publishing content to Facebook and Instagram
- Social media managers coordinating multi-platform campaigns
- Marketing teams running Facebook/Instagram ad campaigns

Users connect their own Facebook Pages and Instagram Business accounts to
SkalX AI via OAuth. We never access accounts that don't belong to the
authenticated user. All permissions requested are used exclusively to
enable users to manage their own content, engagement, and advertising
through the SkalX AI interface.
```

### Permission-Specific Justifications

For each advanced permission, provide:

**Permission:** `instagram_content_publish`
**Use Case:** Users publish marketing content to their Instagram Business accounts
**Justification:** SkalX AI automates content distribution. Users create posts (often with AI-generated captions) and publish to Instagram from our dashboard, saving time and enabling multi-platform publishing workflows.

**Permission:** `instagram_manage_comments`
**Use Case:** Users view and reply to Instagram comments
**Justification:** SkalX AI provides centralized comment management. Users respond to customer comments across Facebook and Instagram from one inbox, improving response times and customer engagement.

**Permission:** `pages_manage_posts`
**Use Case:** Users publish and manage posts on their Facebook Pages
**Justification:** Core product feature enabling automated content publishing to Facebook Pages. Users create and delete posts from the SkalX AI dashboard as part of their marketing workflow.

**Permission:** `ads_read`
**Use Case:** Users view their ad campaign performance metrics
**Justification:** SkalX AI analytics dashboard displays Facebook/Instagram ad insights alongside organic content metrics, enabling comprehensive ROI tracking and data-driven decision making.

**Permission:** `ads_management`
**Use Case:** Future feature for ad campaign creation and optimization
**Justification:** Preparing for Q1 2026 feature launch that will allow users to create and manage ad campaigns from SkalX AI. Requesting now to avoid requiring users to re-authenticate later.

**Permission:** `leads_retrieval`
**Use Case:** Users access leads from their Facebook/Instagram lead ad campaigns
**Justification:** SkalX AI provides centralized lead management. Users running lead ads can view, export, and manage leads from the SkalX AI dashboard for faster follow-up.

---

## Testing Instructions

### Development Mode Testing

While in Development Mode (before App Review):

1. **Add Test Users**:
   - Go to Roles → Test Users in Facebook App Dashboard
   - Create test users or add your own account as Admin/Developer
   - Only these users can authenticate during development

2. **Test All Features**:
   - Instagram posting
   - Facebook posting
   - Comment management
   - Ad insights
   - Lead retrieval

3. **Verify API Calls**:
   - Check browser Network tab for successful Graph API responses
   - Test error handling (disconnect account, revoke permissions)

### Prepare Production Test Account

For App Review, create a dedicated test account:

1. **Create Test Facebook Account**:
   - Use real email (reviewers will log in)
   - Complete profile setup
   - Create a test Facebook Page

2. **Create Test Instagram Business Account**:
   - Convert Instagram account to Business
   - Link to Facebook Page
   - Add some test posts and comments

3. **Create Test Ad Account** (if testing ads_read):
   - Create ad account in Business Manager
   - Run a small test campaign ($5-10 budget)
   - Generate some insights data

4. **Create Test Lead Form** (if testing leads_retrieval):
   - Create a simple lead form
   - Submit a few test leads

5. **Share Credentials with Meta**:
   - Provide login credentials in App Review notes
   - Include step-by-step testing instructions

---

## Common App Review Issues

### Issue 1: Insufficient Business Verification

**Problem:** App Review rejected because business not verified.

**Solution:**
- Complete Meta Business Verification
- Provide business documents (registration, tax ID)
- Ensure business name matches legal entity

### Issue 2: Privacy Policy Missing Key Information

**Problem:** Privacy Policy doesn't explain data usage clearly.

**Solution:**
- Explicitly list all data types collected from Meta
- Explain retention policies
- Include data deletion instructions
- Add contact email for privacy inquiries

### Issue 3: Unclear Permission Use Case

**Problem:** Reviewer doesn't understand why permission is needed.

**Solution:**
- Provide detailed step-by-step instructions
- Create clear screencasts showing the feature
- Explain business value to users
- Map permission directly to product feature

### Issue 4: Permissions Not Used Yet

**Problem:** Requesting permissions for future features.

**Solution:**
- Only request permissions for implemented features
- If requesting for future use, provide clear timeline and justification
- Consider two-phase approach: essential permissions first, others later

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-21 | Initial documentation created |

---

## Contact & Support

For questions about Meta integration or App Review:

- **Email: tech.optimx@gmail.com** 

---

**End of Document**
