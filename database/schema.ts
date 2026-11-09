import { pgTable, timestamp, text, integer, boolean, index, uniqueIndex, jsonb, uuid, unique, numeric, bigint, date } from "drizzle-orm/pg-core"
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
	brandSnapshot: jsonb("brand_snapshot"),
	uiPreferences: jsonb("ui_preferences").default('{}'),
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
	status: text().notNull(), // 'pending' | 'trialing' | 'active' | 'cancelled' | 'expired' | 'past_due'
	razorpaySubscriptionId: text("razorpay_subscription_id"),
	razorpayCustomerId: text("razorpay_customer_id"),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }).notNull(),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }).notNull(),
	trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: 'string' }),
	nextResetDate: timestamp("next_reset_date", { withTimezone: true, mode: 'string' }).notNull(),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	/** User requested cancel; remains usable until current_period_end (Razorpay cancel_at_cycle_end). */
	cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_subscriptions_user_active").using("btree", table.userId.asc().nullsLast()).where(sql`${table.status} IN ('trialing', 'active')`),
	index("idx_subscriptions_status").using("btree", table.status.asc().nullsLast()),
	index("idx_subscriptions_next_reset").using("btree", table.nextResetDate.asc().nullsLast()).where(sql`${table.status} IN ('trialing', 'active')`),
	index("idx_subscriptions_cancel_at_period_end").using("btree", table.cancelAtPeriodEnd.asc().nullsLast()).where(sql`${table.cancelAtPeriodEnd} = true`),
]);

/**
 * subscription_cycles — one entitlement grant per successful Razorpay subscription charge.
 * Idempotency: unique idempotency_key + unique razorpay_payment_id.
 */
export const subscriptionCycles = pgTable("subscription_cycles", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
	userId: uuid("user_id").notNull(),
	planId: text("plan_id").notNull().references(() => plans.id),
	razorpayPaymentId: text("razorpay_payment_id").notNull(),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	imageCreditsGranted: integer("image_credits_granted").notNull(),
	videoCreditsGranted: integer("video_credits_granted").notNull(),
	status: text().notNull().default('pending'), // 'pending' | 'provisioned' | 'failed'
	idempotencyKey: text("idempotency_key").notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("subscription_cycles_idempotency_key_unique").on(table.idempotencyKey),
	uniqueIndex("subscription_cycles_razorpay_payment_id_unique").on(table.razorpayPaymentId),
	index("idx_subscription_cycles_subscription").using("btree", table.subscriptionId.asc().nullsLast()),
	index("idx_subscription_cycles_user").using("btree", table.userId.asc().nullsLast()),
	index("idx_subscription_cycles_status").using("btree", table.status.asc().nullsLast()),
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
	uniqueIndex("idx_payments_razorpay_payment_id_unique")
		.on(table.razorpayPaymentId)
		.where(sql`${table.razorpayPaymentId} IS NOT NULL`),
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
	operation: text().notNull(), // 'add' | 'deduct' | 'reset' | 'expire' | 'reserve' | 'release' | 'consume' | 'migrate'
	source: text().notNull(),
	balanceAfter: integer("balance_after").notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_credit_history_user").using("btree", table.userId.asc().nullsLast()),
	index("idx_credit_history_created").using("btree", table.createdAt.asc().nullsLast()),
]);

/**
 * credit_reservations — DB-backed hold on credits for in-flight generation.
 * Available balance = wallet total − sum(status='reserved' amounts).
 * On success: status → consumed (credits already deducted at reserve time).
 * On failure: status → released and credits returned to addon.
 */
export const creditReservations = pgTable("credit_reservations", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	creditType: text("credit_type").notNull(), // 'image' | 'video'
	amount: integer().notNull(),
	status: text().notNull().default('reserved'), // 'reserved' | 'consumed' | 'released'
	purpose: text().notNull(), // e.g. 'video_generation'
	referenceId: text("reference_id"),
	/** How much came from subscription vs addon at reserve time (for release). */
	fromSubscription: integer("from_subscription").notNull().default(0),
	fromAddon: integer("from_addon").notNull().default(0),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_credit_reservations_user").using("btree", table.userId.asc().nullsLast()),
	index("idx_credit_reservations_status").using("btree", table.status.asc().nullsLast()),
	index("idx_credit_reservations_reference").using("btree", table.referenceId.asc().nullsLast()),
	uniqueIndex("idx_credit_reservations_active_reference")
		.on(table.userId, table.referenceId)
		.where(sql`${table.status} = 'reserved' AND ${table.referenceId} IS NOT NULL`),
]);

/**
 * generation_job_locks — cross-instance idempotency for commercial video generation.
 * Same logical referenceId → at most one in-progress provider job.
 */
export const generationJobLocks = pgTable("generation_job_locks", {
	lockKey: text("lock_key").primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	status: text().notNull(), // 'in_progress' | 'completed' | 'failed'
	reservationId: uuid("reservation_id"),
	resultSummary: jsonb("result_summary"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_generation_job_locks_user").using("btree", table.userId.asc().nullsLast()),
	index("idx_generation_job_locks_status").using("btree", table.status.asc().nullsLast()),
]);

// vouchers table
export const vouchers = pgTable("vouchers", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	creditType: text("credit_type").notNull(), // 'image' | 'video'
	credits: integer().notNull(),
	status: text().notNull().default('active'), // 'active' | 'redeemed' | 'expired' | 'revoked'
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	redeemedAt: timestamp("redeemed_at", { withTimezone: true, mode: 'string' }),
	redeemedPaymentId: uuid("redeemed_payment_id"),
	issuedBy: text("issued_by").notNull(),
	reportId: uuid("report_id"),
	note: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_vouchers_user_id").using("btree", table.userId.asc().nullsLast()),
	index("idx_vouchers_status").using("btree", table.status.asc().nullsLast()),
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

// brand_kits table — a brand's design system (logo, colours, fonts, rules)
export const brandKits = pgTable("brand_kits", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	websiteUrl: text("website_url"),
	isDefault: boolean("is_default").notNull().default(false),
	logo: jsonb(),
	colors: jsonb().notNull().default([]),
	fonts: jsonb().notNull().default({}),
	guidelines: jsonb().notNull().default({}),
	identity: jsonb("identity").notNull().default({}),
	extraction: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
	index("idx_brand_kits_user_id").using("btree", table.userId.asc().nullsLast()),
	uniqueIndex("uq_brand_kits_one_default_per_user").using("btree", table.userId.asc().nullsLast()).where(sql`is_default`),
]);

// product_cutouts table — cache of background-removed product photos
export const productCutouts = pgTable("product_cutouts", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	sourceHash: text("source_hash").notNull(),
	sourceUrl: text("source_url"),
	cutoutUrl: text("cutout_url"),
	storagePath: text("storage_path"),
	width: integer("width"),
	height: integer("height"),
	provider: text("provider").notNull(),
	ok: boolean("ok").notNull(),
	quality: jsonb("quality").notNull().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (table) => [
	unique("product_cutouts_user_id_source_hash_key").on(table.userId, table.sourceHash),
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

// creative_studio_sessions table (for Brand Studio feature)
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
	comparisonInsights: jsonb("comparison_insights"),
	competitorRunIds: text("competitor_run_ids").array(),
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
	products: jsonb(),
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

// ============================================================
// CONTENT STUDIO TABLES
// ============================================================

export const contentStudioScans = pgTable("content_studio_scans", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	url: text().notNull(),
	brandSummary: jsonb("brand_summary"),
	products: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_content_studio_scans_user_id").using("btree", table.userId.asc().nullsLast()),
	index("idx_content_studio_scans_created_at").using("btree", table.createdAt.desc().nullsLast()),
]);

export const contentStudioCampaigns = pgTable("content_studio_campaigns", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	scanId: uuid("scan_id").notNull().references(() => contentStudioScans.id, { onDelete: 'cascade' }),
	productName: text("product_name").notNull(),
	campaignName: text("campaign_name"),
	ads: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_content_studio_campaigns_scan_id").using("btree", table.scanId.asc().nullsLast()),
]);

export const contentStudioPosters = pgTable("content_studio_posters", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	scanId: uuid("scan_id").notNull().references(() => contentStudioScans.id, { onDelete: 'cascade' }),
	productName: text("product_name").notNull(),
	angle: jsonb(),
	imageUrls: jsonb("image_urls").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_content_studio_posters_scan_id").using("btree", table.scanId.asc().nullsLast()),
]);

// Content Studio version history (per product ad generation)
export const contentStudioVersions = pgTable("content_studio_versions", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	scanId: uuid("scan_id").references(() => contentStudioScans.id, { onDelete: 'cascade' }),
	productName: text("product_name").notNull(),
	versionNumber: integer("version_number").notNull().default(1),
	adAngles: jsonb("ad_angles"),
	campaignPlan: jsonb("campaign_plan"),
	campaignStrategy: jsonb("campaign_strategy"),
	generatedPosters: jsonb("generated_posters"),
	campaign: jsonb(),
	productData: jsonb("product_data"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_cs_versions_user").using("btree", table.userId.asc().nullsLast()),
	index("idx_cs_versions_user_product").using("btree", table.userId.asc().nullsLast(), table.productName.asc().nullsLast()),
	index("idx_cs_versions_scan").using("btree", table.scanId.asc().nullsLast()),
	index("idx_cs_versions_created").using("btree", table.createdAt.desc().nullsLast()),
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

/**
 * Poster Generation Sessions — structured creative state (Phase 2+).
 * Separate from creative_studio_sessions (UI shell). Linked via studio_session_id.
 * Does NOT replace generated_posters URL arrays on the studio session.
 */
export const posterGenerationSessions = pgTable("poster_generation_sessions", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	studioSessionId: uuid("studio_session_id"),
	brandId: text("brand_id"),
	productId: text("product_id"),
	status: text().notNull().default("draft"),
	version: integer().notNull().default(1),
	brief: jsonb(),
	strategy: jsonb(),
	concepts: jsonb().notNull().default([]),
	selectedConceptIds: jsonb("selected_concept_ids").notNull().default([]),
	dnaByConceptId: jsonb("dna_by_concept_id").notNull().default({}),
	specifications: jsonb().notNull().default([]),
	assets: jsonb().notNull().default([]),
	iterations: jsonb().notNull().default([]),
	trace: jsonb().notNull().default({}),
	error: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
}, (table) => [
	index("idx_poster_gen_sessions_user_id").using("btree", table.userId.asc().nullsLast()),
	index("idx_poster_gen_sessions_studio_session_id").using(
		"btree",
		table.studioSessionId.asc().nullsLast()
	),
	index("idx_poster_gen_sessions_status").using("btree", table.status.asc().nullsLast()),
	index("idx_poster_gen_sessions_updated_at").using("btree", table.updatedAt.desc().nullsLast()),
]);

/**
 * Poster carousel campaigns — one ordered multi-slide campaign per row, planned
 * from a poster_generation_sessions strategy. Slides live in poster_carousel_slides
 * so each slide can be claimed, generated, charged, and QC'd independently.
 */
export const posterCarouselCampaigns = pgTable("poster_carousel_campaigns", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	sessionId: uuid("session_id").notNull(),
	status: text().notNull().default("ready"),
	version: integer().notNull().default(1),
	slideCount: integer("slide_count").notNull(),
	aspectRatio: text("aspect_ratio").notNull(),
	briefId: text("brief_id").notNull(),
	strategyId: text("strategy_id").notNull(),
	story: jsonb().notNull(),
	sharedDna: jsonb("shared_dna").notNull(),
	campaignChecks: jsonb("campaign_checks").notNull().default([]),
	lastExport: jsonb("last_export"),
	generationStartedAt: timestamp("generation_started_at", { withTimezone: true, mode: "string" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
	index("idx_poster_carousel_campaigns_user").using("btree", table.userId.asc().nullsLast()),
	index("idx_poster_carousel_campaigns_session_created").using("btree", table.sessionId.asc().nullsLast(), table.createdAt.desc().nullsLast()),
]);

export const posterCarouselSlides = pgTable("poster_carousel_slides", {
	id: text().primaryKey().notNull(),
	campaignId: uuid("campaign_id").notNull(),
	userId: uuid("user_id").notNull(),
	slideIndex: integer("slide_index").notNull(),
	status: text().notNull().default("planned"),
	generationId: text("generation_id"),
	leaseToken: text("lease_token"),
	leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true, mode: "string" }),
	creditsCharged: integer("credits_charged").notNull().default(0),
	/** Full CarouselSlide JSON (validated by runtime guards on read) */
	data: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_poster_carousel_slides_campaign_index").using("btree", table.campaignId.asc().nullsLast(), table.slideIndex.asc().nullsLast()),
	index("idx_poster_carousel_slides_user").using("btree", table.userId.asc().nullsLast()),
	index("idx_poster_carousel_slides_generation").using("btree", table.generationId.asc().nullsLast()),
]);

/**
 * Pre-auth product onboarding. Holds a shadow profile id so existing brand
 * snapshot, preferences, and poster-generation code can run before signup.
 * Claim copies that state onto the real account.
 */
export const onboardingGuestSessions = pgTable("onboarding_guest_sessions", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	tokenHash: text("token_hash").notNull(),
	profileId: uuid("profile_id").notNull(),
	claimedBy: uuid("claimed_by"),
	claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "string" }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
}, (table) => [
	uniqueIndex("onboarding_guest_sessions_token_hash_key").using("btree", table.tokenHash.asc().nullsLast()),
	uniqueIndex("onboarding_guest_sessions_profile_id_key").using("btree", table.profileId.asc().nullsLast()),
]);

/**
 * Free marketing audit (pre-signup acquisition). Owned by a profile id: a guest
 * shadow profile until claim, then the real user. Research only — never runs
 * paid creative generation.
 */
export const marketingAudits = pgTable("marketing_audits", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	websiteUrl: text("website_url").notNull(),
	normalizedHost: text("normalized_host").notNull(),
	status: text().notNull().default("queued"),
	stage: text().notNull().default("queued"),
	attemptCount: integer("attempt_count").notNull().default(0),
	leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true, mode: "string" }),
	site: jsonb(),
	brand: jsonb(),
	competitors: jsonb().notNull().default([]),
	competitorPosts: jsonb("competitor_posts").notNull().default([]),
	insights: jsonb(),
	ideas: jsonb().notNull().default([]),
	sources: jsonb().notNull().default([]),
	limitations: jsonb().notNull().default([]),
	selectedIdeaIndex: integer("selected_idea_index"),
	campaignSessionId: uuid("campaign_session_id"),
	campaignLockAt: timestamp("campaign_lock_at", { withTimezone: true, mode: "string" }),
	clientIpHash: text("client_ip_hash"),
	error: jsonb(),
	claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "string" }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
}, (table) => [
	index("idx_marketing_audits_user_created").using("btree", table.userId.asc().nullsLast(), table.createdAt.desc().nullsLast()),
	index("idx_marketing_audits_ip_created").using("btree", table.clientIpHash.asc().nullsLast(), table.createdAt.desc().nullsLast()),
	index("idx_marketing_audits_user_host").using("btree", table.userId.asc().nullsLast(), table.normalizedHost.asc().nullsLast()),
]);

/**
 * Free brand audit leads: one free audit per email (unique email_normalized), with the
 * category and website sales follows up on. Server-only.
 */
export const auditLeads = pgTable("audit_leads", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	email: text().notNull(),
	emailNormalized: text("email_normalized").notNull(),
	category: text(),
	websiteUrl: text("website_url").notNull(),
	normalizedHost: text("normalized_host").notNull(),
	auditId: uuid("audit_id"),
	clientIpHash: text("client_ip_hash"),
	sampleAdStatus: text("sample_ad_status"),
	sampleAdUrl: text("sample_ad_url"),
	sampleAdError: text("sample_ad_error"),
	sampleAdStartedAt: timestamp("sample_ad_started_at", { withTimezone: true, mode: "string" }),
	sampleAdCreatedAt: timestamp("sample_ad_created_at", { withTimezone: true, mode: "string" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
}, (table) => [
	index("idx_audit_leads_audit").using("btree", table.auditId.asc().nullsLast()),
	index("idx_audit_leads_sample_created").using("btree", table.sampleAdCreatedAt.desc().nullsLast()),
	uniqueIndex("uq_audit_leads_email_normalized").using("btree", table.emailNormalized.asc().nullsLast()),
	index("idx_audit_leads_created").using("btree", table.createdAt.desc().nullsLast()),
]);

/**
 * Manual free-trial access requests. Pending rows never grant product access;
 * an authorized operator must approve and provision entitlements separately.
 */
export const trialAccessRequests = pgTable("trial_access_requests", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	fullName: text("full_name").notNull(),
	email: text().notNull(),
	companyName: text("company_name").notNull(),
	websiteUrl: text("website_url"),
	useCase: text("use_case").notNull(),
	status: text().notNull().default("pending"),
	clientIpHash: text("client_ip_hash"),
	userAgent: text("user_agent"),
	notifySentAt: timestamp("notify_sent_at", { withTimezone: true, mode: "string" }),
	notifyError: text("notify_error"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "string" }),
	reviewedBy: text("reviewed_by"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
	index("idx_trial_access_requests_email_created").using("btree", table.email.asc().nullsLast(), table.createdAt.desc().nullsLast()),
	index("idx_trial_access_requests_status_created").using("btree", table.status.asc().nullsLast(), table.createdAt.desc().nullsLast()),
	index("idx_trial_access_requests_ip_created").using("btree", table.clientIpHash.asc().nullsLast(), table.createdAt.desc().nullsLast()),
]);

// ============================================================
// Meta Intelligence (migration 20261108120000_add_meta_intelligence_connect.sql)
// ============================================================

/** One read-only Meta connection per user. token_enc is AES-256-GCM (lib/meta/crypto.ts). */
export const metaConnections = pgTable("meta_connections", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	brandKitId: uuid("brand_kit_id"),
	metaUserId: text("meta_user_id"),
	metaUserName: text("meta_user_name"),
	businessId: text("business_id"),
	businessName: text("business_name"),
	tokenEnc: text("token_enc").notNull(),
	tokenType: text("token_type").notNull().default("user"),
	scopes: text().array().notNull().default(sql`'{}'::text[]`),
	tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true, mode: "string" }),
	dataAccessExpiresAt: timestamp("data_access_expires_at", { withTimezone: true, mode: "string" }),
	status: text().notNull().default("pending"),
	lastError: text("last_error"),
	lastCheckedAt: timestamp("last_checked_at", { withTimezone: true, mode: "string" }),
	lastSyncAt: timestamp("last_sync_at", { withTimezone: true, mode: "string" }),
	capabilities: jsonb().notNull().default({}),
	briefEmailEnabled: boolean("brief_email_enabled").notNull().default(true),
	connectedAt: timestamp("connected_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
	unique("meta_connections_user_id_key").on(table.userId),
	index("idx_meta_connections_meta_user_id").using("btree", table.metaUserId.asc().nullsLast()),
	index("idx_meta_connections_status").using("btree", table.status.asc().nullsLast()),
]);

/** Ad accounts, Pages and IG accounts visible to a connection; `selected` = linked to the brand. */
export const metaAssets = pgTable("meta_assets", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	connectionId: uuid("connection_id").notNull().references(() => metaConnections.id, { onDelete: "cascade" }),
	userId: uuid("user_id").notNull(),
	kind: text().notNull(),
	metaId: text("meta_id").notNull(),
	name: text(),
	parentMetaId: text("parent_meta_id"),
	currency: text(),
	timezoneName: text("timezone_name"),
	accountStatus: integer("account_status"),
	pageTokenEnc: text("page_token_enc"),
	selected: boolean().notNull().default(false),
	metadata: jsonb().notNull().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
	unique("meta_assets_connection_kind_meta_id_key").on(table.connectionId, table.kind, table.metaId),
	index("idx_meta_assets_user_id").using("btree", table.userId.asc().nullsLast()),
]);

/** Audit trail for Meta data deletion / deauthorize callbacks and in-app Disconnect. */
export const metaDeletionRequests = pgTable("meta_deletion_requests", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	confirmationCode: text("confirmation_code").notNull(),
	source: text().notNull(),
	metaUserId: text("meta_user_id"),
	userId: uuid("user_id"),
	status: text().notNull().default("received"),
	details: jsonb().notNull().default({}),
	requestedAt: timestamp("requested_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
}, (table) => [
	unique("meta_deletion_requests_code_key").on(table.confirmationCode),
]);

// ---- Meta Intelligence sync (migration 20261108130000_add_meta_intelligence_sync.sql) ----
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const connRef = () => uuid("connection_id").notNull().references(() => metaConnections.id, { onDelete: "cascade" });

export const metaCampaigns = pgTable("meta_campaigns", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	connectionId: connRef(),
	adAccountId: text("ad_account_id").notNull(),
	metaId: text("meta_id").notNull(),
	name: text(),
	objective: text(),
	status: text(),
	effectiveStatus: text("effective_status"),
	dailyBudget: numeric("daily_budget"),
	lifetimeBudget: numeric("lifetime_budget"),
	startTime: ts("start_time"),
	stopTime: ts("stop_time"),
	createdTime: ts("created_time"),
	updatedTime: ts("updated_time"),
	raw: jsonb().notNull().default({}),
	syncedAt: ts("synced_at").notNull().defaultNow(),
}, (t) => [unique("meta_campaigns_conn_meta_id_key").on(t.connectionId, t.metaId)]);

export const metaAdsets = pgTable("meta_adsets", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	connectionId: connRef(),
	adAccountId: text("ad_account_id").notNull(),
	metaId: text("meta_id").notNull(),
	campaignMetaId: text("campaign_meta_id"),
	name: text(),
	status: text(),
	effectiveStatus: text("effective_status"),
	optimizationGoal: text("optimization_goal"),
	billingEvent: text("billing_event"),
	dailyBudget: numeric("daily_budget"),
	lifetimeBudget: numeric("lifetime_budget"),
	createdTime: ts("created_time"),
	updatedTime: ts("updated_time"),
	raw: jsonb().notNull().default({}),
	syncedAt: ts("synced_at").notNull().defaultNow(),
}, (t) => [unique("meta_adsets_conn_meta_id_key").on(t.connectionId, t.metaId)]);

export const metaCreatives = pgTable("meta_creatives", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	connectionId: connRef(),
	adAccountId: text("ad_account_id").notNull(),
	metaId: text("meta_id").notNull(),
	name: text(),
	objectType: text("object_type"),
	title: text(),
	body: text(),
	callToActionType: text("call_to_action_type"),
	imageHash: text("image_hash"),
	videoId: text("video_id"),
	sourceImageUrl: text("source_image_url"),
	storedPath: text("stored_path"),
	storedMd5: text("stored_md5"),
	imageStoredAt: ts("image_stored_at"),
	raw: jsonb().notNull().default({}),
	syncedAt: ts("synced_at").notNull().defaultNow(),
}, (t) => [unique("meta_creatives_conn_meta_id_key").on(t.connectionId, t.metaId)]);

export const metaAds = pgTable("meta_ads", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	connectionId: connRef(),
	adAccountId: text("ad_account_id").notNull(),
	metaId: text("meta_id").notNull(),
	adsetMetaId: text("adset_meta_id"),
	campaignMetaId: text("campaign_meta_id"),
	creativeMetaId: text("creative_meta_id"),
	name: text(),
	status: text(),
	effectiveStatus: text("effective_status"),
	createdTime: ts("created_time"),
	updatedTime: ts("updated_time"),
	madeBySkalx: boolean("made_by_skalx").notNull().default(false),
	skxReason: text("skx_reason"),
	raw: jsonb().notNull().default({}),
	syncedAt: ts("synced_at").notNull().defaultNow(),
}, (t) => [unique("meta_ads_conn_meta_id_key").on(t.connectionId, t.metaId)]);

export const metaAdInsightsDaily = pgTable("meta_ad_insights_daily", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	connectionId: connRef(),
	adAccountId: text("ad_account_id").notNull(),
	adMetaId: text("ad_meta_id").notNull(),
	adsetMetaId: text("adset_meta_id"),
	campaignMetaId: text("campaign_meta_id"),
	date: date().notNull(),
	currency: text(),
	spend: numeric().notNull().default("0"),
	impressions: bigint({ mode: "number" }).notNull().default(0),
	reach: bigint({ mode: "number" }),
	frequency: numeric(),
	clicks: bigint({ mode: "number" }),
	linkClicks: bigint("link_clicks", { mode: "number" }),
	ctr: numeric(),
	cpc: numeric(),
	cpm: numeric(),
	purchases: numeric(),
	revenue: numeric(),
	roas: numeric(),
	cpa: numeric(),
	purchaseSource: text("purchase_source"),
	roasSource: text("roas_source"),
	actions: jsonb().notNull().default([]),
	actionValues: jsonb("action_values").notNull().default([]),
	syncedAt: ts("synced_at").notNull().defaultNow(),
}, (t) => [
	unique("meta_ad_insights_daily_conn_ad_date_key").on(t.connectionId, t.adMetaId, t.date),
	index("idx_meta_ad_insights_conn_date").using("btree", t.connectionId.asc().nullsLast(), t.date.asc().nullsLast()),
]);

export const metaOrganicPosts = pgTable("meta_organic_posts", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	connectionId: connRef(),
	platform: text().notNull(),
	accountMetaId: text("account_meta_id").notNull(),
	metaId: text("meta_id").notNull(),
	mediaType: text("media_type"),
	caption: text(),
	permalink: text(),
	thumbnailUrl: text("thumbnail_url"),
	postedAt: ts("posted_at"),
	raw: jsonb().notNull().default({}),
	syncedAt: ts("synced_at").notNull().defaultNow(),
}, (t) => [unique("meta_organic_posts_conn_meta_id_key").on(t.connectionId, t.metaId)]);

export const metaOrganicPostInsightsDaily = pgTable("meta_organic_post_insights_daily", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	connectionId: connRef(),
	postMetaId: text("post_meta_id").notNull(),
	date: date().notNull(),
	views: bigint({ mode: "number" }),
	reach: bigint({ mode: "number" }),
	likes: bigint({ mode: "number" }),
	comments: bigint({ mode: "number" }),
	saves: bigint({ mode: "number" }),
	shares: bigint({ mode: "number" }),
	interactions: bigint({ mode: "number" }),
	metrics: jsonb().notNull().default({}),
	syncedAt: ts("synced_at").notNull().defaultNow(),
}, (t) => [unique("meta_organic_post_insights_daily_conn_post_date_key").on(t.connectionId, t.postMetaId, t.date)]);

export const syncRuns = pgTable("sync_runs", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	connectionId: connRef(),
	userId: uuid("user_id").notNull(),
	kind: text().notNull(),
	trigger: text().notNull(),
	status: text().notNull().default("queued"),
	rangeSince: date("range_since"),
	rangeUntil: date("range_until"),
	counts: jsonb().notNull().default({}),
	errors: jsonb().notNull().default([]),
	dataChanged: boolean("data_changed").notNull().default(false),
	externalRunId: text("external_run_id"),
	createdAt: ts("created_at").notNull().defaultNow(),
	startedAt: ts("started_at"),
	finishedAt: ts("finished_at"),
}, (t) => [index("idx_sync_runs_conn_created").using("btree", t.connectionId.asc().nullsLast(), t.createdAt.desc().nullsLast())]);

export const skalxAssetHashes = pgTable("skalx_asset_hashes", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	md5: text().notNull(),
	source: text().notNull(),
	storagePath: text("storage_path"),
	createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [unique("skalx_asset_hashes_user_md5_key").on(t.userId, t.md5)]);

// ---- Meta Intelligence AI insights (migration 20261108140000_add_meta_ai_insights.sql) ----
export const aiInsights = pgTable("ai_insights", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	connectionId: connRef(),
	userId: uuid("user_id").notNull(),
	trigger: text().notNull(),
	status: text().notNull().default("running"),
	rangeDays: integer("range_days").notNull(),
	periodSince: date("period_since"),
	periodUntil: date("period_until"),
	inputHash: text("input_hash"),
	input: jsonb(),
	output: jsonb(),
	dropped: jsonb().notNull().default([]),
	model: text(),
	attempts: integer().notNull().default(0),
	usage: jsonb().notNull().default({}),
	error: text(),
	createdAt: ts("created_at").notNull().defaultNow(),
	finishedAt: ts("finished_at"),
}, (t) => [index("idx_ai_insights_conn_created").using("btree", t.connectionId.asc().nullsLast(), t.createdAt.desc().nullsLast())]);

// ---- Ad Studio test packs (migration 20261108150000_add_test_packs.sql) ----
export const testPacks = pgTable("test_packs", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	connectionId: uuid("connection_id").references(() => metaConnections.id, { onDelete: "set null" }),
	source: text().notNull(),
	sourceAdMetaId: text("source_ad_meta_id"),
	sourceAdSnapshot: jsonb("source_ad_snapshot"),
	product: jsonb().notNull(),
	productSlug: text("product_slug").notNull(),
	angles: jsonb().notNull().default([]),
	formats: text().array().notNull().default(sql`'{feed,story}'::text[]`),
	status: text().notNull().default("draft"),
	creditsEstimated: integer("credits_estimated").notNull().default(0),
	creditsCharged: integer("credits_charged").notNull().default(0),
	testPlan: jsonb("test_plan"),
	zipPath: text("zip_path"),
	zipBuiltAt: ts("zip_built_at"),
	error: text(),
	createdAt: ts("created_at").notNull().defaultNow(),
	updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("idx_test_packs_user_created").using("btree", t.userId.asc().nullsLast(), t.createdAt.desc().nullsLast())]);

export const testPackVariants = pgTable("test_pack_variants", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	packId: uuid("pack_id").notNull().references(() => testPacks.id, { onDelete: "cascade" }),
	userId: uuid("user_id").notNull(),
	position: integer().notNull(),
	angleIndex: integer("angle_index").notNull(),
	format: text().notNull(),
	adName: text("ad_name").notNull(),
	hook: text(),
	primaryText: text("primary_text"),
	headline: text(),
	whatItTests: text("what_it_tests"),
	whyItMightWork: text("why_it_might_work"),
	testFirst: boolean("test_first").notNull().default(false),
	status: text().notNull().default("pending"),
	imageUrl: text("image_url"),
	storagePath: text("storage_path"),
	imageMd5: text("image_md5"),
	sessionId: uuid("session_id"),
	error: text(),
	matchedAdMetaId: text("matched_ad_meta_id"),
	matchedBy: text("matched_by"),
	matchedAt: ts("matched_at"),
	createdAt: ts("created_at").notNull().defaultNow(),
	updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [unique("test_pack_variants_pack_angle_format_key").on(t.packId, t.angleIndex, t.format)]);

// ---- Monday brief (migration 20261108160000_add_weekly_briefs.sql) ----
export const weeklyBriefs = pgTable("weekly_briefs", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	connectionId: connRef(),
	userId: uuid("user_id").notNull(),
	weekStart: date("week_start").notNull(),
	weekEnd: date("week_end").notNull(),
	status: text().notNull().default("building"),
	trigger: text().notNull().default("schedule"),
	content: jsonb(),
	packId: uuid("pack_id").references(() => testPacks.id, { onDelete: "set null" }),
	posterProjectId: uuid("poster_project_id"),
	delivery: jsonb().notNull().default({}),
	error: text(),
	createdAt: ts("created_at").notNull().defaultNow(),
	updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [unique("weekly_briefs_conn_week_key").on(t.connectionId, t.weekStart)]);

// ---- Ad Studio drafts (migration 20261108170000_add_ad_studio_drafts.sql) ----
export const adStudioProjects = pgTable("ad_studio_projects", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	userId: uuid("user_id").notNull(),
	scanId: uuid("scan_id"),
	product: jsonb().notNull(),
	productSlug: text("product_slug").notNull(),
	goal: text().notNull(),
	offerDetails: text("offer_details"),
	formats: text().array().notNull().default(sql`'{feed_4x5}'::text[]`),
	direction: text(),
	source: text().notNull().default("ad_studio"),
	sourceAdMetaId: text("source_ad_meta_id"),
	research: jsonb(),
	status: text().notNull().default("researching"),
	rounds: integer().notNull().default(0),
	error: text(),
	createdAt: ts("created_at").notNull().defaultNow(),
	updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("idx_ad_studio_projects_user").using("btree", t.userId.asc().nullsLast(), t.createdAt.desc().nullsLast())]);

export const adStudioDrafts = pgTable("ad_studio_drafts", {
	id: uuid().primaryKey().notNull().defaultRandom(),
	projectId: uuid("project_id").notNull().references(() => adStudioProjects.id, { onDelete: "cascade" }),
	userId: uuid("user_id").notNull(),
	round: integer().notNull(),
	position: integer().notNull(),
	format: text().notNull(),
	angle: jsonb().notNull(),
	parentDraftId: uuid("parent_draft_id"),
	kind: text().notNull().default("original"),
	status: text().notNull().default("pending"),
	sessionId: uuid("session_id"),
	storagePath: text("storage_path"),
	previewPath: text("preview_path"),
	error: text(),
	kept: boolean().notNull().default(false),
	keptAt: ts("kept_at"),
	creditsCharged: integer("credits_charged").notNull().default(0),
	finalUrl: text("final_url"),
	finalPath: text("final_path"),
	adName: text("ad_name"),
	primaryText: text("primary_text"),
	headline: text(),
	imageMd5: text("image_md5"),
	matchedAdMetaId: text("matched_ad_meta_id"),
	matchedBy: text("matched_by"),
	matchedAt: ts("matched_at"),
	createdAt: ts("created_at").notNull().defaultNow(),
	updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("idx_ad_studio_drafts_project").using("btree", t.projectId.asc().nullsLast(), t.round.asc().nullsLast(), t.position.asc().nullsLast())]);
