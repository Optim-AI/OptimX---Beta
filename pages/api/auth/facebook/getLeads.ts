// pages/api/auth/facebook/getLeads.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

async function readSaved() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeLeadObject(item: any, savedStatuses: Record<string, string> | null) {
  const lead_id = item.leadgen_id ?? item.id ?? item.lead_id ?? item.id ?? null;
  const created_time = item.created_time ?? item.created_at ?? null;

  // Helper to extract common fields from field_data
  const getFieldFromFieldData = (names: string[]) => {
    const fd = item.field_data ?? item.fieldData ?? item.fielddata ?? null;
    if (Array.isArray(fd)) {
      for (const n of names) {
        const found = fd.find((f: any) => String(f.name).toLowerCase() === String(n).toLowerCase());
        if (found) {
          // found.values might be an array of raw values or objects
          const v = found.values?.[0];
          if (v === undefined) continue;
          if (typeof v === "object" && v.value !== undefined) return v.value;
          return v;
        }
      }
    }
    // fallback to top-level keys
    for (const n of names) {
      if (item[n]) return item[n];
    }
    return null;
  };

  const full_name = getFieldFromFieldData(["full_name", "name", "fullName", "first_name"]);
  const email = getFieldFromFieldData(["email", "email_address", "Email"]);
  const phone = getFieldFromFieldData(["phone_number", "phone", "mobile_number"]);

  const status = (savedStatuses && lead_id ? savedStatuses[String(lead_id)] : undefined) ?? "new";

  return {
    lead_id: String(lead_id),
    full_name: full_name ?? undefined,
    email: email ?? undefined,
    phone: phone ?? undefined,
    status,
    created_time,
    raw: item,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const saved = await readSaved();
    const pageAccessToken = saved?.pageAccessToken ?? saved?.page_access_token ?? process.env.PAGE_ACCESS_TOKEN;
    const pageId = saved?.pageId ?? saved?.page_id ?? process.env.PAGE_ID;
    const userAccessToken = saved?.userAccessToken ?? saved?.user_access_token;

    if (!pageAccessToken && !userAccessToken) {
      return res.status(500).json({ error: "Missing pageAccessToken or userAccessToken in data/instagram.json or env" });
    }

    const tokenToUse = pageAccessToken ?? userAccessToken;

    // optional formId query param; otherwise fetch all forms for page
    const { formId, status } = req.query;

    let leadsAll: any[] = [];

    if (formId && typeof formId === "string") {
      // fetch leads for specific form
      const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(formId)}/leads?access_token=${encodeURIComponent(tokenToUse)}&limit=200&fields=id,created_time,field_data,leadgen_id,ad_id,form_id`;
      const gRes = await fetch(url);
      const body = await gRes.json();
      if (!gRes.ok) return res.status(gRes.status).json({ ok: false, status: gRes.status, body });
      leadsAll = body.data ?? [];
    } else {
      // fetch leadgen forms for the page, then fetch leads for each form
      if (!pageId) {
        return res.status(500).json({ error: "Missing pageId in data/instagram.json (needed to discover forms)" });
      }

      const formsUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(pageId)}/leadgen_forms?access_token=${encodeURIComponent(tokenToUse)}&limit=200&fields=id,name`;
      const formsRes = await fetch(formsUrl);
      const formsBody = await formsRes.json();
      if (!formsRes.ok) {
        return res.status(formsRes.status).json({ ok: false, status: formsRes.status, body: formsBody });
      }

      const forms: any[] = formsBody.data ?? [];

      for (const f of forms) {
        const fid = f.id;
        try {
          const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(fid)}/leads?access_token=${encodeURIComponent(tokenToUse)}&limit=200&fields=id,created_time,field_data,leadgen_id,ad_id,form_id`;
          const gRes = await fetch(url);
          const body = await gRes.json();
          // if the form call fails for permissions, skip but keep going
          if (!gRes.ok) {
            console.warn(`Skipping form ${fid} leads fetch:`, body);
            continue;
          }
          const arr = body.data ?? [];
          // attach form_id onto items if not present
          for (const it of arr) {
            if (!it.form_id) it.form_id = fid;
            leadsAll.push(it);
          }
        } catch (err) {
          console.warn("error fetching leads for form", f, err);
        }
      }
    }

    // Normalization + attach locally persisted status if any
    const savedStatuses: Record<string, string> | null = (saved && saved.leadStatuses) ? saved.leadStatuses : null;
    const normalized = (leadsAll as any[]).map((it) => normalizeLeadObject(it, savedStatuses));

    // optional filtering by status param (new/intake/qualified/converted)
    let filtered = normalized;
    if (status && typeof status === "string" && status !== "all") {
      filtered = normalized.filter((l) => String(l.status).toLowerCase() === status.toLowerCase());
    }

    return res.status(200).json({ ok: true, data: filtered, rawCount: normalized.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("facebook/getLeads error:", err);
    return res.status(500).json({ error: message });
  }
}
