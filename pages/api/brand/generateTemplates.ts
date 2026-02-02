import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { brand, type } = req.body;

  if (!brand) {
    return res.status(400).json({ error: "Missing brand data" });
  }

  // v1: deterministic, AI later
  const templates = (brand.product_images || []).slice(0, 3).map((img: string, i: number) => ({
    id: `${type}-${i}`,
    platform: type,
    image: img,
    headline: brand.marketing_quickwins?.hero_copy || "Grow faster with us",
    subheadline: brand.summary?.slice(0, 80) || "",
    cta: "Shop Now"
  }));

  return res.status(200).json({ templates });
}
