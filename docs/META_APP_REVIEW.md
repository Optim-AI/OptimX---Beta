# Meta App Review: SkalX Ad Performance

How to get SkalX's Meta permissions approved: what to set up, what to record and what to paste into
each box. Ad Performance only **reads** data. It never posts, edits ads or spends money.

---

## 1. Before you record

- [ ] **Business Verification** is done for the SkalX business in Meta Business Manager. Advanced Access
      needs it. Meta may also ask for **Access Verification**, because SkalX works on other businesses' data.
- [ ] **Facebook Login for Business** is added to the app, with one configuration that requests these 7 permissions:
      `ads_read`, `business_management`, `read_insights`, `pages_show_list`, `pages_read_engagement`,
      `instagram_basic`, `instagram_manage_insights`. Put its ID in `META_LOGIN_CONFIG_ID`.
- [ ] Features requested in App Review: **Instagram Public Content Access** (hashtag search for the Instagram trends tab)
      and **Marketing API Access Tier → Standard access** (for `ads_read`).
- [ ] The app's privacy policy, terms, data-deletion and deauthorize URLs are filled in. To get the exact URLs, run
      `npm run meta:preflight -- --env <production env file>`.
- [ ] App icon (1024×1024), category and contact email are set.
- [ ] Production is live and the pre-launch check passes: migrations applied, Trigger.dev deployed and
      `GEMINI_API_KEY` set. Meta's reviewers try the app themselves, so it has to work on the real site.
- [ ] A **SkalX login for the reviewers** exists: an email and password on production, with an
      Ad Studio product scanned and some credits. Put it in the "reviewer instructions" box.
- [ ] Before recording, the account you record with has at least one ad account with spend in the last 30 days,
      a Facebook Page with posts, and a linked Instagram business account with posts.

**Not in this submission:** the older publishing permissions used by the Post and Ads buttons
(`pages_manage_posts`, `instagram_content_publish`, `ads_management`, `leads_retrieval`). Leave them out unless
those features are going live too. Each permission needs its own explanation, and Meta rejects any it doesn't see used.

---

## 2. Recording script (one video, about 5 minutes, used for every permission and feature)

Record in English, at 1080p, with the mouse visible. Add on-screen captions or a voice-over that says what's happening.
**Show Meta's full login dialog, including the permission screens**, and don't cut any of it.

| # | Show | Say / caption |
|---|---|---|
| 1 | Sign in to SkalX at the production URL. | "A business owner signs in to SkalX." |
| 2 | **Settings → Integrations**, the *Meta (Facebook & Instagram)* card. | "They connect their Meta accounts. SkalX is read-only and never posts or changes ads." |
| 3 | Click **Connect with Facebook**. Go through every screen of Meta's dialog: pick the business, ad account, Page and Instagram account, check the permission list, and accept. | "Meta asks which business, ad account, Page and Instagram account to share, and which permissions to grant." |
| 4 | The account picker: the ad account list (with business name), the **Facebook Page** list and the **Instagram** account. Pick each one and click **Save and continue**. | "`business_management` and `ads_read` list the business's ad accounts. `pages_show_list` lists their Pages. `instagram_basic` finds the Instagram account linked to the Page." |
| 5 | **Ad Performance** opens. Point at the **Connected** strip: Business, Ad account, Page, Instagram. | "The dashboard shows exactly which accounts it reads from." |
| 6 | KPI cards, then **Spend vs revenue**. | "`ads_read`: spend, sales, ROAS and cost per purchase come from the ad account's insights." |
| 7 | **Your ads** table. Open a row with a Winner or Losing badge. | "`ads_read`: each ad's results and creative, so the owner can see which ads to keep and which to stop." |
| 8 | The **What SkalX sees** panel: **Working**, **Not working**, **Patterns**. | "SkalX summarises the ad results in plain language, with next steps." |
| 9 | **Top organic posts**: a Facebook post, then an Instagram post. Point at engagements and reach or views. | "`pages_read_engagement` and `read_insights`: Facebook Page posts and their reach and engagement. `instagram_basic` and `instagram_manage_insights`: Instagram posts and their reach, views and saves." |
| 10 | On a Winner, click **Make more like this**. The poster flow opens. | "Insights turn into new ad ideas inside SkalX. Nothing is published to Meta." |
| 10a | Back in Ad Performance, open the **Instagram trends** tab. Type a hashtag (e.g. *pickles*) and click **Add**. Show the stats, the format bar and the top posts; tap one to open it on Instagram. Point at "Hashtag lookups this week". | "**Instagram Public Content Access**: SkalX shows the public top posts for hashtags the owner chooses, so they see what content works in their category. It stays within Instagram's weekly limit and doesn't show who posted." |
| 10b | Open the **Competitors** tab. Add a competitor's public business account. Show the comparison bars (You vs them), their card and **Read their style**. | "`instagram_basic`, `instagram_manage_insights` and `pages_read_engagement` (Business Discovery): public stats of business accounts the owner chooses, compared with their own." |
| 11 | Back in **Settings → Integrations**, click **Disconnect**, then **Disconnect and delete**. | "The owner can disconnect at any time. SkalX deletes the token and all Meta data it stored." |

---

## 3. Text for each permission ("How will your app use this permission?")

**ads_read**
> SkalX shows small-business owners how their Meta ads perform. We read campaigns, ad sets, ads, ad creatives
> and their daily insights (spend, impressions, clicks, purchases, purchase value) for the ad accounts the business
> chooses. We show these as totals, a spend-vs-revenue chart and a ranked list of ads labelled Winner, Losing or
> Too early, and we summarise what's working. Read-only: SkalX never creates, edits or pauses ads.

**business_management**
> Businesses usually own their ad accounts, Pages and Instagram accounts through Meta Business Manager. During
> Facebook Login for Business the owner picks which business assets to share. We use this permission only to read
> those shared assets (ad accounts and Pages, with the business name) so the owner can pick them in SkalX.
> We don't change any business settings, users or assets.

**pages_show_list**
> After login we list the Facebook Pages the person manages so they can pick their business Page. The Page they
> pick appears on the Ad Performance dashboard and is the source of their organic post results.

**pages_read_engagement**
> We read the selected Page's posts from the last 90 days (text, image, link, time, reactions, comments,
> shares) to show the owner their best organic posts next to their ad results.

**read_insights**
> We read post insights for the selected Facebook Page (reach and engagement per post) to rank the owner's
> organic posts in "Top organic posts" and compare organic content with paid ads.

**instagram_basic**
> We read the Instagram business account linked to the selected Page (username, profile picture) and its
> recent media (caption, type, link, time, like and comment counts) to show the owner's Instagram posts in SkalX.
> With Business Discovery, the owner can also add up to 5 competitor business accounts by username; we read their
> public profile (followers, post count) and recent public posts (like and comment counts) to compare them with the
> owner's own account. With Hashtag Search, we show public top posts for up to 5 hashtags the owner picks.

**instagram_manage_insights**
> We read insights for the owner's recent Instagram posts (reach, views, saves, shares) to rank their best
> organic posts and compare them with paid ads. It's also required for Business Discovery, which lets the owner
> compare their account with competitor business accounts they choose. We don't read data about individual people.

**Instagram Public Content Access** (feature)
> In Ad Performance → Instagram trends, the owner adds up to 5 hashtags relevant to their products (for example
> #pickles or #chennaifood). We use Hashtag Search to show the public top posts for each hashtag (image, like and
> comment counts, link to the post), how many public posts used it in the last 24 hours, and which format (photo,
> reel, carousel) gets the most engagement. This helps small brands see what content works in their category.
> We stay under Instagram's limit of 30 unique hashtags per account per 7 days (SkalX stops at 25), cache results
> for 6 hours, don't show or store who posted, and never comment or interact with these posts.

---

## 4. Reviewer instructions (paste into "Testing instructions")

> 1. Go to <production URL>/auth/signin and sign in with: <reviewer email> / <reviewer password>.
> 2. Open Settings → Integrations and click "Connect with Facebook" on the Meta card.
> 3. In Meta's dialog, choose a business, an ad account, a Facebook Page and its Instagram account, and allow access.
> 4. On "Which accounts should SkalX use?", pick the ad account, Page and Instagram account, then "Save and continue".
> 5. The Ad Performance page opens. The first sync takes 1–3 minutes; press refresh if numbers aren't there yet.
> 6. To remove access: Settings → Integrations → Disconnect. This deletes all data SkalX stored from Meta.
> SkalX is read-only. It never posts, edits ads or spends money.

---

## 5. Until approval

In **Development mode** (standard access), only people with a role on the app (admins, developers, testers) can
connect. To give a client access before approval, add their Facebook account as a **Tester** in App roles. They
accept the invite at developers.facebook.com, and then Connect works for them.
