import { relations } from "drizzle-orm/relations";
import { users, profiles, integrations, oauthSessions, googleAdsTokens, userCredits, campaigns, recommendations, userChats, userGeneratedImage } from "./schema";

export const profilesRelations = relations(profiles, ({one}) => ({
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	profiles: many(profiles),
	integrations: many(integrations),
	oauthSessions: many(oauthSessions),
	googleAdsTokens: many(googleAdsTokens),
	userCredits: many(userCredits),
	campaigns: many(campaigns),
	userChats: many(userChats),
	userGeneratedImages: many(userGeneratedImage),
}));

export const integrationsRelations = relations(integrations, ({one}) => ({
	user: one(users, {
		fields: [integrations.userId],
		references: [users.id]
	}),
}));

export const oauthSessionsRelations = relations(oauthSessions, ({one}) => ({
	user: one(users, {
		fields: [oauthSessions.userId],
		references: [users.id]
	}),
}));

export const googleAdsTokensRelations = relations(googleAdsTokens, ({one}) => ({
	user: one(users, {
		fields: [googleAdsTokens.userId],
		references: [users.id]
	}),
}));

export const userCreditsRelations = relations(userCredits, ({one}) => ({
	user: one(users, {
		fields: [userCredits.userId],
		references: [users.id]
	}),
}));

export const campaignsRelations = relations(campaigns, ({one, many}) => ({
	user: one(users, {
		fields: [campaigns.userId],
		references: [users.id]
	}),
	recommendations: many(recommendations),
}));

export const recommendationsRelations = relations(recommendations, ({one}) => ({
	campaign: one(campaigns, {
		fields: [recommendations.campaignId],
		references: [campaigns.id]
	}),
}));

export const userChatsRelations = relations(userChats, ({one}) => ({
	user: one(users, {
		fields: [userChats.userId],
		references: [users.id]
	}),
}));

export const userGeneratedImageRelations = relations(userGeneratedImage, ({one}) => ({
	user: one(users, {
		fields: [userGeneratedImage.userId],
		references: [users.id]
	}),
}));