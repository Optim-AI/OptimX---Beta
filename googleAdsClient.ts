const { GoogleAdsApi } = require('google-ads-api');

// Load Google Ads configuration from environment variables
const client_id = process.env.GOOGLE_ADS_CLIENT_ID;
const client_secret = process.env.GOOGLE_ADS_CLIENT_SECRET;
const developer_token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const refresh_token = process.env.GOOGLE_ADS_REFRESH_TOKEN;

// Validate required environment variables
if (!client_id || !client_secret || !developer_token || !refresh_token) {
  throw new Error(
    'Missing Google Ads API configuration. Please set the following environment variables:\n' +
    '- GOOGLE_ADS_CLIENT_ID\n' +
    '- GOOGLE_ADS_CLIENT_SECRET\n' +
    '- GOOGLE_ADS_DEVELOPER_TOKEN\n' +
    '- GOOGLE_ADS_REFRESH_TOKEN'
  );
}

const client = new GoogleAdsApi({
  client_id,
  client_secret,
  developer_token,
  refresh_token,
});

export default client;
