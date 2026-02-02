// pages/api/brand/analyze.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type ResponseBody = {
  result?: any;
  error?: string;
};

async function fetchPageText(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "optimx-brand-bot/1.0" },
  });

  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  return {
    title: dom.window.document.querySelector("title")?.textContent || "",
    metaDesc:
      dom.window.document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content") || "",
    text: article?.textContent || "",
    excerpt: article?.excerpt || "",
    ogImage:
      dom.window.document
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content") || null,
  };
}

async function callOpenAI(prompt: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 700,
    }),
  });

  if (!res.ok) throw new Error(await res.text());

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseBody>
) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing url" });

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol))
      return res.status(400).json({ error: "Invalid URL" });

    const page = await fetchPageText(url);

    const prompt = `
Given this website info, produce STRICT JSON:
{
  "summary": "",
  "audience": [],
  "products": [],
  "colors": [],
  "brand_tone": "",
  "competitors": [],
  "improvements": [],
  "marketing_quickwins": {}
}

TITLE: ${page.title}
DESCRIPTION: ${page.metaDesc}
TEXT_SNIPPET: ${page.text.slice(0, 3000)}
OG_IMAGE: ${page.ogImage}
`;

    const raw = await callOpenAI(prompt);

    let parsedResult = {};
    try {
      parsedResult = JSON.parse(raw);
    } catch {
      parsedResult = { summary: raw };
    }

    return res.status(200).json({ result: parsedResult });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
