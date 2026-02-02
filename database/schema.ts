import { pgTable, timestamp, text, integer, boolean, index, uniqueIndex, jsonb, uuid } from "drizzle-orm/pg-core"
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
	insertedAt: timestamp("inserted_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	tagline: text(),
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

// user_credits table
export const userCredits = pgTable("user_credits", {
	id: uuid().primaryKey().notNull(),
	credits: integer().notNull().default(0),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

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
