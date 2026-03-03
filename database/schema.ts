import { pgTable, timestamp, text, integer, boolean, index, uniqueIndex, jsonb, uuid, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// ============================================================
// PRODUCTION DATABASE SCHEMA
// Matches production database exactly
// ============================================================

// ad_accounts table
export const adAccounts = pgTable("ad_accounts", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	integrationId: uuid("integration_id").notNull(),
	accountId: text("account_id").notNull(),
	accountRaw: jsonb("account_raw"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_ad_accounts_integration_id").using("btree", table.integrationId.asc().nullsLast()),
]);

// app_settings table
export const appSettings = pgTable("app_settings", {
	key: text().primaryKey().notNull(),
	value: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// campaigns table
export const campaigns = pgTable("campaigns", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	name: text(),
	audience: text(),
	campaignType: text("campaign_type"),
	brandVoice: text("brand_voice"),
	contentTypes: text("content_types").array(),
	vision: text(),
	output: jsonb(),
	imageUrl: text("image_url").array(),
	imagePath: text("image_path").array(),
	isPublished: boolean("is_published").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_campaigns_user_id").using("btree", table.userId.asc().nullsLast()),
	index("idx_campaigns_created_at").using("btree", table.createdAt.asc().nullsLast()),
]);

// integration_flags table
export const integrationFlags = pgTable("integration_flags", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id"),
	flags: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_integration_flags_user_id").using("btree", table.userId.asc().nullsLast()),
	uniqueIndex("integration_flags_user_unique").using("btree", table.userId.asc().nullsLast()),
]);

// integrations table
export const integrations = pgTable("integrations", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	provider: text().notNull(),
	providerUserId: text("provider_user_id"),
	adAccountId: text("ad_account_id"),
	pageId: text("page_id"),
	igUserId: text("ig_user_id"),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true, mode: 'string' }),
	scopes: text().array(),
	raw: jsonb(),
	metadata: jsonb(),
	healthStatus: text("health_status").default('healthy'),
	healthErrorMessage: text("health_error_message"),
	lastHealthCheck: timestamp("last_health_check", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_integrations_user_provider").using("btree", table.userId.asc().nullsLast(), table.provider.asc().nullsLast()),
]);

// integrationsbeta table
export const integrationsBeta = pgTable("integrationsbeta", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	instagramUsername: text("instagram_username"),
	facebookUsername: text("facebook_username"),
	email: text(),
	mobileNumber: text("mobile_number"),
	status: text().notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
	businessPageId: text("business_page_id"),
});

// profiles table
export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	fullName: text("full_name"),
	businessName: text("business_name"),
	email: text(),
	phone: text(),
	phoneVerified: boolean("phone_verified").default(false),
	businessMobile: text("business_mobile"),
	businessMobileVerified: boolean("business_mobile_verified").default(false),
	location: text(),
	businessType: text("business_type"),
	businessSize: text("business_size"),
	useCase: text("use_case").array(),
	colorPrimary: text("color_primary"),
	colorSecondary: text("color_secondary"),
	font: text(),
	logoPath: text("logo_path"),
	refImages: text("ref_images").array(),
	heardFrom: text("heard_from"),
	heardFromOther: text("heard_from_other"),
	invoiceEmail: text("invoice_email"),
	gstNumber: text("gst_number"),
	primaryGoal: text("primary_goal"),
	insertedAt: timestamp("inserted_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	tagline: text(),
	organisationName: text("organisation_name"),
}, (table) => [
	index("profiles_business_mobile_idx").using("btree", table.businessMobile.asc().nullsLast()).where(sql`${table.businessMobile} IS NOT NULL`),
	uniqueIndex("profiles_email_idx").using("btree", table.email.asc().nullsLast()).where(sql`${table.email} IS NOT NULL`),
	index("profiles_phone_idx").using("btree", table.phone.asc().nullsLast()).where(sql`${table.phone} IS NOT NULL`),
]);

// training_artifacts table
export const trainingArtifacts = pgTable("training_artifacts", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	chatId: uuid("chat_id"),
	artifactPath: text("artifact_path"),
	sampleTag: text("sample_tag"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// user_chats table
export const userChats = pgTable("user_chats", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	title: text(),
	messages: jsonb().notNull(),
	consentForTraining: boolean("consent_for_training").default(false),
	sanitized: boolean().default(false),
	clientVersion: text("client_version"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_chats_user").using("btree", table.userId.asc().nullsLast()),
]);

// user_credits table (updated with separate image/video credits)
export const userCredits = pgTable("user_credits", {
	id: uuid().primaryKey().notNull(),
	credits: integer().notNull().default(0), // Legacy field, kept for compatibility
	imageCreditsSubscription: integer("image_credits_subscription").notNull().default(0),
	imageCreditsAddon: integer("image_credits_addon").notNull().default(0),
	videoCreditsSubscription: integer("video_credits_subscription").notNull().default(0),
	videoCreditsAddon: integer("video_credits_addon").notNull().default(0),
	lastResetAt: timestamp("last_reset_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ============================================================
// BILLING SYSTEM TABLES
// ============================================================

// plans table
export const plans = pgTable("plans", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	billingCycle: text("billing_cycle").notNull(), // 'monthly' | 'quarterly' | 'trial'
	priceInr: integer("price_inr").notNull().default(0),
	imageCredits: integer("image_credits").notNull().default(0),
	videoCredits: integer("video_credits").notNull().default(0),
	razorpayPlanId: text("razorpay_plan_id"),
	isActive: boolean("is_active").notNull().default(true),
	displayOrder: integer("display_order").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("plans_slug_unique").using("btree", table.slug.asc().nullsLast()),
]);

// feature_keys table
export const featureKeys = pgTable("feature_keys", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	category: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// plan_feature_flags table
export const planFeatureFlags = pgTable("plan_feature_flags", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	planId: text("plan_id").notNull().references(() => plans.id, { onDelete: 'cascade' }),
	featureKey: text("feature_key").notNull().references(() => featureKeys.id, { onDelete: 'cascade' }),
	isEnabled: boolean("is_enabled").notNull().default(false),
	isComingSoon: boolean("is_coming_soon").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("plan_feature_flags_unique").using("btree", table.planId.asc().nullsLast(), table.featureKey.asc().nullsLast()),
]);

// subscriptions table
export const subscriptions = pgTable("subscriptions", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	planId: text("plan_id").notNull().references(() => plans.id),
	status: text().notNull(), // 'trialing' | 'active' | 'cancelled' | 'expired' | 'past_due'
	razorpaySubscriptionId: text("razorpay_subscription_id"),
	razorpayCustomerId: text("razorpay_customer_id"),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }).notNull(),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }).notNull(),
	trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: 'string' }),
	nextResetDate: timestamp("next_reset_date", { withTimezone: true, mode: 'string' }).notNull(),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_subscriptions_user_active").using("btree", table.userId.asc().nullsLast()).where(sql`${table.status} IN ('trialing', 'active')`),
	index("idx_subscriptions_status").using("btree", table.status.asc().nullsLast()),
	index("idx_subscriptions_next_reset").using("btree", table.nextResetDate.asc().nullsLast()).where(sql`${table.status} IN ('trialing', 'active')`),
]);

// credit_packs table
export const creditPacks = pgTable("credit_packs", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	creditType: text("credit_type").notNull(), // 'image' | 'video'
	credits: integer().notNull(),
	priceInr: integer("price_inr").notNull(),
	razorpayItemId: text("razorpay_item_id"),
	isActive: boolean("is_active").notNull().default(true),
	displayOrder: integer("display_order").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// payments table
export const payments = pgTable("payments", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: 'set null' }),
	creditPackId: text("credit_pack_id").references(() => creditPacks.id, { onDelete: 'set null' }),
	razorpayPaymentId: text("razorpay_payment_id"),
	razorpayOrderId: text("razorpay_order_id"),
	razorpaySignature: text("razorpay_signature"),
	amount: integer().notNull(),
	currency: text().notNull().default('INR'),
	status: text().notNull(), // 'created' | 'captured' | 'failed' | 'refunded'
	paymentType: text("payment_type").notNull(), // 'subscription' | 'image_topup' | 'video_topup'
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_payments_user").using("btree", table.userId.asc().nullsLast()),
	index("idx_payments_razorpay").using("btree", table.razorpayPaymentId.asc().nullsLast()).where(sql`${table.razorpayPaymentId} IS NOT NULL`),
	index("idx_payments_status").using("btree", table.status.asc().nullsLast()),
]);

// webhook_events table
export const webhookEvents = pgTable("webhook_events", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	razorpayEventId: text("razorpay_event_id").notNull().unique(),
	eventType: text("event_type").notNull(),
	payload: jsonb().notNull(),
	status: text().notNull(), // 'pending' | 'processed' | 'failed'
	errorMessage: text("error_message"),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_webhook_events_type").using("btree", table.eventType.asc().nullsLast()),
	index("idx_webhook_events_status").using("btree", table.status.asc().nullsLast()),
]);

// credit_history table
export const creditHistory = pgTable("credit_history", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	creditType: text("credit_type").notNull(), // 'image' | 'video'
	amount: integer().notNull(),
	operation: text().notNull(), // 'add' | 'deduct' | 'reset' | 'expire'
	source: text().notNull(),
	balanceAfter: integer("balance_after").notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_credit_history_user").using("btree", table.userId.asc().nullsLast()),
	index("idx_credit_history_created").using("btree", table.createdAt.asc().nullsLast()),
]);

// user_generated_image table
export const userGeneratedImage = pgTable("user_generated_image", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	imageUrl: text("image_url").notNull(),
	imagePath: text("image_path"),
	source: text(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_generated_image_user_id").using("btree", table.userId.asc().nullsLast()),
]);

// user_generated_images table (plural - duplicate of singular in production)
export const userGeneratedImages = pgTable("user_generated_images", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	imageUrl: text("image_url").notNull(),
	imagePath: text("image_path"),
	source: text().notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_generated_images_user").using("btree", table.userId.asc().nullsLast()),
]);

// user_ui_state table
export const userUIState = pgTable("user_ui_state", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	state: jsonb().notNull(),
	clientVersion: text("client_version"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_ui_state_user").using("btree", table.userId.asc().nullsLast()),
	uniqueIndex("user_ui_state_user_id_key").using("btree", table.userId.asc().nullsLast()),
]);

// reports table
export const reports = pgTable("reports", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	type: text().notNull(), // 'error' | 'feedback'
	message: text().notNull(),
	pageUrl: text("page_url"),
	images: text().array(), // base64 data URLs (max 3)
	status: text().notNull().default('open'), // 'open' | 'reviewed' | 'resolved'
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_reports_user_id").using("btree", table.userId.asc().nullsLast()),
	index("idx_reports_status").using("btree", table.status.asc().nullsLast()),
	index("idx_reports_created_at").using("btree", table.createdAt.desc().nullsLast()),
]);

// ============================================================
// TABLES NOT IN PRODUCTION (but needed for local development)
// ============================================================

// oauth_sessions table (for new OAuth flow)
export const oauthSessions = pgTable("oauth_sessions", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	provider: text().notNull(),
	data: jsonb().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
	index("oauth_sessions_user_id_idx").using("btree", table.userId.asc().nullsLast()),
	index("oauth_sessions_provider_idx").using("btree", table.provider.asc().nullsLast()),
	index("oauth_sessions_expires_at_idx").using("btree", table.expiresAt.asc().nullsLast()),
]);

// creative_studio_sessions table (for Creative Studio feature)
export const creativeStudioSessions = pgTable("creative_studio_sessions", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	sessionType: text("session_type").notNull().default('poster'), // 'poster' | 'video'
	brandSnapshot: jsonb("brand_snapshot").notNull(),
	// Poster-specific fields
	phase: text(), // input, analyzing, brand-review, product-input, poster-prompt, config, generating, ready
	messages: jsonb(), // Array of chat messages
	productData: jsonb("product_data"),
	posterPrompt: text("poster_prompt"),
	config: jsonb(), // { theme, aspectRatio }
	generatedPosters: jsonb("generated_posters"), // Array of poster URLs
	// Video-specific fields
	adBuilderData: jsonb("ad_builder_data"), // Video wizard state
	generatedVideos: jsonb("generated_videos"), // Array of video URLs
	// Timestamps
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_creative_studio_sessions_user_id").using("btree", table.userId.asc().nullsLast()),
	index("idx_creative_studio_sessions_type").using("btree", table.sessionType.asc().nullsLast()),
	index("idx_creative_studio_sessions_user_type").using("btree", table.userId.asc().nullsLast(), table.sessionType.asc().nullsLast()),
]);

// ============================================================
// CREATIVE INTELLIGENCE TABLES
// ============================================================

export const creativeIntelligenceRuns = pgTable("creative_intelligence_runs", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	brandUrl: text("brand_url").notNull(),
	competitorUrls: text("competitor_urls").array(),
	industry: text(),
	targetAudience: text("target_audience"),
	campaignGoal: text("campaign_goal"),
	advancedSettings: jsonb("advanced_settings"),
	status: text().notNull().default('pending'),
	progressStep: integer("progress_step").default(0),
	progressMessage: text("progress_message"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_creative_intelligence_runs_user_id").using("btree", table.userId.asc().nullsLast()),
	index("idx_creative_intelligence_runs_created_at").using("btree", table.createdAt.desc().nullsLast()),
]);

export const creativeIntelligenceBrands = pgTable("creative_intelligence_brands", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	runId: uuid("run_id").notNull(),
	productSummary: text("product_summary"),
	positioningStatement: text("positioning_statement"),
	corePainsAddressed: jsonb("core_pains_addressed"),
	emotionalTone: text("emotional_tone"),
	targetPersonaGuess: text("target_persona_guess"),
	rawAnalysis: jsonb("raw_analysis"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_creative_intelligence_brands_run_id").using("btree", table.runId.asc().nullsLast()),
]);

export const creativeIntelligenceCompetitors = pgTable("creative_intelligence_competitors", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	runId: uuid("run_id").notNull(),
	name: text(),
	domain: text(),
	corePositioning: text("core_positioning"),
	primaryHook: text("primary_hook"),
	pricingTier: text("pricing_tier"),
	weaknessDetected: text("weakness_detected"),
	saturationLevel: text("saturation_level"),
	relevanceScore: integer("relevance_score"),
	industryMatchConfidence: text("industry_match_confidence"),
	keywordOverlapScore: integer("keyword_overlap_score"),
	rawData: jsonb("raw_data"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_creative_intelligence_competitors_run_id").using("btree", table.runId.asc().nullsLast()),
]);

export const creativeIntelligenceReviews = pgTable("creative_intelligence_reviews", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	runId: uuid("run_id").notNull(),
	clusterType: text("cluster_type").notNull(),
	clusterLabel: text("cluster_label"),
	frequencyPct: integer("frequency_pct"),
	samplePhrases: jsonb("sample_phrases"),
	rawClusters: jsonb("raw_clusters"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_creative_intelligence_reviews_run_id").using("btree", table.runId.asc().nullsLast()),
]);

export const creativeIntelligenceHooks = pgTable("creative_intelligence_hooks", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	runId: uuid("run_id").notNull(),
	hookStatement: text("hook_statement").notNull(),
	hookType: text("hook_type"),
	whyItWorks: text("why_it_works"),
	supportingReviewPhrase: text("supporting_review_phrase"),
	competitorOverlapLevel: text("competitor_overlap_level"),
	confidenceScore: integer("confidence_score"),
	rank: integer(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_creative_intelligence_hooks_run_id").using("btree", table.runId.asc().nullsLast()),
]);

export const creativeIntelligenceStrategies = pgTable("creative_intelligence_strategies", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	runId: uuid("run_id").notNull(),
	strategyType: text("strategy_type"),
	content: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_creative_intelligence_strategies_run_id").using("btree", table.runId.asc().nullsLast()),
]);

export const creativeIntelligenceCreatives = pgTable("creative_intelligence_creatives", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	runId: uuid("run_id").notNull(),
	hookId: uuid("hook_id"),
	creativeType: text("creative_type").notNull(),
	content: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_creative_intelligence_creatives_run_id").using("btree", table.runId.asc().nullsLast()),
	index("idx_creative_intelligence_creatives_hook_id").using("btree", table.hookId.asc().nullsLast()),
]);

export const creativeIntelligenceMetaAds = pgTable("creative_intelligence_meta_ads", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	runId: uuid("run_id").notNull(),
	searchKeyword: text("search_keyword").notNull(),
	pageName: text("page_name"),
	pageId: text("page_id"),
	bodyText: text("body_text"),
	ctaText: text("cta_text"),
	ctaType: text("cta_type"),
	displayFormat: text("display_format"),
	platforms: text("platforms").array(),
	imageUrl: text("image_url"),
	rawData: jsonb("raw_data"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_creative_intelligence_meta_ads_run_id").using("btree", table.runId.asc().nullsLast()),
]);

export const creativeIntelligenceFacebookPages = pgTable("creative_intelligence_facebook_pages", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	runId: uuid("run_id").notNull(),
	source: text("source").notNull(),
	entityName: text("entity_name"),
	pageId: text("page_id"),
	pageName: text("page_name"),
	pageLink: text("page_link"),
	followersCount: integer("followers_count"),
	followingCount: integer("following_count"),
	category: text("category"),
	address: text("address"),
	phone: text("phone"),
	website: text("website"),
	ratings: text("ratings"),
	rating: integer("rating"),
	reviewsCount: integer("reviews_count"),
	priceRange: text("price_range"),
	profilePhotoUrl: text("profile_photo_url"),
	rawData: jsonb("raw_data"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_creative_intelligence_facebook_pages_run_id").using("btree", table.runId.asc().nullsLast()),
]);

export const creativeIntelligenceGoogleRanks = pgTable("creative_intelligence_google_ranks", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	runId: uuid("run_id").notNull(),
	searchQuery: text("search_query").notNull(),
	brandDomain: text("brand_domain"),
	brandPosition: integer("brand_position"),
	competitorRanks: jsonb("competitor_ranks"),
	organicResults: jsonb("organic_results"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_creative_intelligence_google_ranks_run_id").using("btree", table.runId.asc().nullsLast()),
]);
