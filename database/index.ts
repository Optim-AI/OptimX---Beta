// database/index.ts
// Main database module - exports Drizzle client and all DAOs
// PostgreSQL database using Drizzle ORM

export { db } from './client';

// Export all DAO classes
export { IntegrationDAO } from './models/Integration.dao';
export { OAuthSessionDAO } from './models/OAuthSession.dao';
export { CreditsDAO } from './models/Credits.dao';
export { ProfileDAO } from './models/Profile.dao';
export { SettingsDAO } from './models/Settings.dao';
export { CampaignDAO } from './models/Campaign.dao';
export { ChatDAO } from './models/Chat.dao';
export { GeneratedImageDAO } from './models/GeneratedImage.dao';

// Billing DAOs
export { PlansDAO } from './models/Plans.dao';
export { SubscriptionsDAO } from './models/Subscriptions.dao';
export { PaymentsDAO, WebhookEventsDAO } from './models/Payments.dao';

// Reports DAO
export { ReportDAO } from './models/Report.dao';

// Note: Removed DAOs for tables that don't exist in production:
// - GoogleAdsDAO (google_ads_tokens table removed)
// - RecommendationDAO (recommendations table removed)
// - IntegrationStatusDAO (integration_status table removed)
// - UserDAO (users managed by Supabase Auth)

// Export Drizzle schema tables and types for convenience
export {
  profiles,
  integrations,
  oauthSessions,
  userCredits,
  campaigns,
  userChats,
  appSettings,
  userGeneratedImage,
  userGeneratedImages,
  adAccounts,
  integrationFlags,
  integrationsBeta,
  trainingArtifacts,
  userUIState,
  // Billing tables
  plans,
  featureKeys,
  planFeatureFlags,
  subscriptions,
  creditPacks,
  payments,
  webhookEvents,
  creditHistory,
  // Reports
  reports,
} from '@/database/schema';

// Export inferred types
import {
  profiles,
  integrations,
  oauthSessions,
  userCredits,
  campaigns,
  userChats,
  appSettings,
  userGeneratedImage,
  userGeneratedImages,
  adAccounts,
  integrationFlags,
  integrationsBeta,
  trainingArtifacts,
  userUIState,
  // Billing tables
  plans,
  featureKeys,
  planFeatureFlags,
  subscriptions,
  creditPacks,
  payments,
  webhookEvents,
  creditHistory,
  // Reports
  reports,
} from '@/database/schema';

// Note: User type removed - use auth.users directly via Supabase Auth
export type Profile = typeof profiles.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type OAuthSession = typeof oauthSessions.$inferSelect;
export type UserCredits = typeof userCredits.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type UserChat = typeof userChats.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type GeneratedImage = typeof userGeneratedImage.$inferSelect;
export type GeneratedImages = typeof userGeneratedImages.$inferSelect;
export type AdAccount = typeof adAccounts.$inferSelect;
export type IntegrationFlags = typeof integrationFlags.$inferSelect;
export type IntegrationsBeta = typeof integrationsBeta.$inferSelect;
export type TrainingArtifacts = typeof trainingArtifacts.$inferSelect;
export type UserUIState = typeof userUIState.$inferSelect;

// Billing types
export type Plan = typeof plans.$inferSelect;
export type FeatureKey = typeof featureKeys.$inferSelect;
export type PlanFeatureFlag = typeof planFeatureFlags.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type CreditPack = typeof creditPacks.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type CreditHistory = typeof creditHistory.$inferSelect;

// Report types
export type Report = typeof reports.$inferSelect;
