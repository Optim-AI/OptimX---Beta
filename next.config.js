// next.config.js
const isProd = process.env.NODE_ENV === "production";

module.exports = {
  output: "export",
  basePath: isProd ? "demo-repository" : "",
  assetPrefix: isProd ? "demo-repository" : "",
  images: { unoptimized: true }
};


