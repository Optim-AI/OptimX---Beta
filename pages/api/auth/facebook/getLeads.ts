// pages/api/auth/facebook/getLeads.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../../lib/requestHelpers";
import { readSavedIntegration } from "../../../../lib/integrationStore";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

function normalizeLeadObject(item: any, savedStatuses: Record<string, string> | null) {
  const lead_id = item.leadgen_id ?? item.id ?? item.lead_id ?? null;
  const created_time = item.created_time ?? item.created_at ?? null;

  const getFieldFromFieldData = (names: string[]) => {
    const fd = item.field_data ?? item.fieldData ?? item.fielddata ?? null;
    if (Array.isArray(fd)) {
      for (const n of names) {
        const found = fd.find((f: any) => String(f.name).toLowerCase() === String(n).toLowerCase());
        if (found) {
          const v = found.values?.[0];
          if (v === undefined) continue;
          if (typeof v === "object" && v.value !== undefined) return v.value;
          return v;
        }
      }
    }
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
    lead_id: lead_id != null ? String(lead_id) : null,
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
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const saved = await readSavedIntegration({ provider: "meta", userId });
    if (!saved) return res.status(400).json({ error: "no_integration" });

    const pageAccessToken = (saved as any).pageAccessToken ?? (saved as any).userAccessToken;
    const pageId = (saved as any).pageId;
    if (!pageAccessToken && !(saved as any).userAccessToken) {
      return res.status(500).json({ error: "Missing pageAccessToken or userAccessToken in integration" });
    }

    const { formId, status } = req.query;
    let leadsAll: any[] = [];

    if (formId && typeof formId === "string") {
      const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(formId)}/leads?access_token=${encodeURIComponent(pageAccessToken)}&limit=200&fields=id,created_time,field_data,leadgen_id,ad_id,form_id`;
      const gRes = await fetch(url);
      const body = await gRes.json();
      if (!gRes.ok) return res.status(gRes.status).json({ ok: false, status: gRes.status, body });
      leadsAll = body.data ?? [];
    } else {
      if (!pageId) return res.status(500).json({ error: "Missing pageId in integration (needed to discover forms)" });

      const formsUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(pageId)}/leadgen_forms?access_token=${encodeURIComponent(pageAccessToken)}&limit=200&fields=id,name`;
      const formsRes = await fetch(formsUrl);
      const formsBody = await formsRes.json();
      if (!formsRes.ok) {
        return res.status(formsRes.status).json({ ok: false, status: formsRes.status, body: formsBody });
      }

      const forms: any[] = formsBody.data ?? [];
      for (const f of forms) {
        const fid = f.id;
        try {
          const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(fid)}/leads?access_token=${encodeURIComponent(pageAccessToken)}&limit=200&fields=id,created_time,field_data,leadgen_id,ad_id,form_id`;
          const gRes = await fetch(url);
          const body = await gRes.json();
          if (!gRes.ok) {
            console.warn(`Skipping form ${fid} leads fetch:`, body);
            continue;
          }
          const arr = body.data ?? [];
          for (const it of arr) { if (!it.form_id) it.form_id = fid; leadsAll.push(it); }
        } catch (err) {
          console.warn("error fetching leads for form", f, err);
        }
      }
    }

    // saved might have leadStatuses on raw or in metadata; be defensive
    const savedAny = saved as any;
    const savedStatuses: Record<string, string> | null =
      (savedAny?.raw?.leadStatuses ?? savedAny?.metadata?.leadStatuses ?? null) as Record<string, string> | null;

    const normalized = leadsAll.map((it) => normalizeLeadObject(it, savedStatuses));

    let filtered = normalized;
    if (status && typeof status === "string" && status !== "all") {
      filtered = normalized.filter((l) => String(l.status).toLowerCase() === status.toLowerCase());
    }

    return res.status(200).json({ ok: true, data: filtered, rawCount: normalized.length });
  } catch (err: any) {
    console.error("facebook/getLeads error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
