/**
 * Poster eval report: aggregates <outDir>/<case>/result.json into
 * summary-stats.json and a self-contained report.html (thumbnails inlined).
 * Usage: NODE_PATH=$PWD/node_modules npx tsx --tsconfig tsconfig.json scripts/poster-eval/report.ts <outDir>
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { CRITERIA, type CriterionKey } from "./judge";
import type { CaseRecord, PosterRecord } from "./run";

const OUT = process.argv[2];
if (!OUT) {
  console.error("usage: report.ts <outDir>");
  process.exit(1);
}

type Judged = PosterRecord & { judge: Exclude<PosterRecord["judge"], { error: string }> };
const isJudged = (p: PosterRecord): p is Judged => !!p.file && !("error" in p.judge);
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function stats(posters: Judged[]) {
  const perCriterion = Object.fromEntries(
    CRITERIA.map(([k]) => [k, avg(posters.map((p) => p.judge.scores[k as CriterionKey]))])
  ) as Record<CriterionKey, number>;
  const textClean = posters.filter((p) => !p.judge.missingText.length && !p.judge.extraText.length).length;
  const qcRows = posters.filter((p) => !("error" in p.qc));
  const qcAgrees = qcRows.filter((p) => ((p.qc as { status: string }).status === "pass") === p.judge.wouldShip).length;
  return {
    posters: posters.length,
    overall: avg(posters.map((p) => p.judge.overall)),
    shipRate: pct(posters.filter((p) => p.judge.wouldShip).length, posters.length),
    textAccuracy: pct(textClean, posters.length),
    avgTextLines: avg(posters.map((p) => p.approvedText.length)),
    avgPromptWords: avg(posters.map((p) => p.promptWords)),
    avgGenSeconds: avg(posters.map((p) => p.genMs / 1000)),
    qcPassRate: pct(qcRows.filter((p) => (p.qc as { status: string }).status === "pass").length, qcRows.length),
    qcAgreesWithJudge: pct(qcAgrees, qcRows.length),
    perCriterion,
  };
}

async function thumb(path: string): Promise<string> {
  const buf = await sharp(path).resize({ width: 520 }).jpeg({ quality: 78 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function main() {
  const cases: CaseRecord[] = readdirSync(OUT)
    .filter((d) => existsSync(join(OUT, d, "result.json")))
    .map((d) => JSON.parse(readFileSync(join(OUT, d, "result.json"), "utf8")));

  const all = cases.flatMap((c) => c.posters.filter(isJudged));
  const fresh = all.filter((p) => p.variant === "new");
  const baseline = all.filter((p) => p.variant === "baseline");
  const pairs = cases.map((c) => c.pairwise).filter((p): p is Exclude<CaseRecord["pairwise"], { error: string } | undefined> => !!p && !("error" in p));
  const best = cases.map((c) => Math.max(0, ...c.posters.filter(isJudged).filter((p) => p.variant === "new").map((p) => p.judge.overall)));
  const issueCounts = new Map<string, number>();
  for (const p of fresh) {
    for (const issue of p.judge.topIssues) {
      const key = /hand|finger/i.test(issue) ? "AI hands / fingers"
        : /typo|misspell|garbled|spelling|proin/i.test(issue) ? "Typos / garbled text"
        : /redundan|repeat|duplicat/i.test(issue) ? "Repeated copy"
        : /clutter|busy|too much text|crowded|dense/i.test(issue) ? "Clutter / too much text"
        : /cta|call to action|call-to-action/i.test(issue) ? "Weak or missing CTA"
        : /brand colou?r|palette|font/i.test(issue) ? "Brand colours / fonts not followed"
        : /offer|discount|%|price/i.test(issue) ? "Offer not prominent"
        : /legib|contrast|readab|small/i.test(issue) ? "Legibility / contrast"
        : /generic|stock|clich/i.test(issue) ? "Generic / stock look"
        : /float|artifact|artefact|warp|distort|melt/i.test(issue) ? "Other AI artefacts"
        : /safe zone|crop|cut off|edge/i.test(issue) ? "Safe zones / cropping"
        : "Other";
      issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
    }
  }

  const summary = {
    cases: cases.length,
    failedCases: cases.filter((c) => !c.ok).map((c) => ({ id: c.case.id, error: c.error })),
    new: stats(fresh),
    baseline: stats(baseline),
    bestOfThree: { overall: avg(best), shipRate: pct(cases.filter((c) => c.posters.some((p) => isJudged(p) && p.variant === "new" && p.judge.wouldShip)).length, cases.length) },
    pairwise: {
      judged: pairs.length,
      newWins: pairs.filter((p) => p.newWon === true).length,
      baselineWins: pairs.filter((p) => p.newWon === false).length,
      ties: pairs.filter((p) => p.newWon === null).length,
    },
    issueThemes: [...issueCounts.entries()].sort((a, b) => b[1] - a[1]),
    avgTimingsSeconds: {
      strategy: avg(cases.map((c) => (c.timings.strategy || 0) / 1000)),
      concepts: avg(cases.map((c) => (c.timings.concepts || 0) / 1000)),
    },
  };
  writeFileSync(join(OUT, "summary-stats.json"), JSON.stringify(summary, null, 2));

  // ── HTML contact sheet
  const rows: string[] = [];
  for (const c of cases) {
    const cards: string[] = [];
    for (const p of c.posters) {
      if (!p.file) {
        cards.push(`<figure class="card fail"><figcaption><b>${esc(p.label)}</b> — generation failed</figcaption></figure>`);
        continue;
      }
      const src = await thumb(join(OUT, c.case.id, p.file));
      const j = "error" in p.judge ? null : p.judge;
      const qc = "error" in p.qc ? `QC error` : `QC ${p.qc.status}`;
      cards.push(`<figure class="card ${j?.wouldShip ? "ship" : "noship"}">
  <img src="${src}" alt="${esc(`${c.case.brandName} ${p.label} poster`)}" loading="lazy">
  <figcaption>
    <div class="row"><b>${esc(p.label === "baseline" ? "Old prompt" : `Concept ${p.conceptIndex + 1}`)}</b><span class="score">${j ? j.overall : "–"}/10</span></div>
    <div class="muted">${esc(p.conceptName)} · ${esc(p.territory)} · ${esc(qc)} · ${j?.wouldShip ? "would ship" : "would not ship"}</div>
    ${j ? `<p>${esc(j.verdict)}</p>` : ""}
    ${j && (j.missingText.length || j.extraText.length) ? `<p class="warn">Text errors: ${esc([...j.missingText.map((t) => `missing “${t}”`), ...j.extraText.map((t) => `extra “${t}”`)].join("; "))}</p>` : ""}
    ${j ? `<ul>${j.topIssues.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
  </figcaption>
</figure>`);
    }
    const pw = c.pairwise && !("error" in c.pairwise)
      ? `<p class="muted">Blind A/B (concept 1, new vs old prompt): <b>${c.pairwise.newWon === null ? "tie" : c.pairwise.newWon ? "new prompt won" : "old prompt won"}</b> — ${esc(c.pairwise.reason)}</p>`
      : "";
    rows.push(`<section>
  <h2>${esc(c.case.brandName)} — ${esc(c.case.scenario)}</h2>
  <p class="muted">${esc(c.case.userInstruction)} · ${esc(c.case.aspectRatio)} · theme ${esc(c.case.visualDirection)}${c.case.brandKit ? " · brand kit" : ""}</p>
  ${c.strategy ? `<p>Strategy: <b>${esc(c.strategy.objective)}</b> — headline “${esc(c.strategy.copy.headline)}”${c.strategy.copy.cta ? `, CTA “${esc(c.strategy.copy.cta)}”` : ""}</p>` : ""}
  ${c.ok ? "" : `<p class="warn">Case failed: ${esc(c.error || "")}</p>`}
  ${pw}
  <div class="grid">${cards.join("\n")}</div>
</section>`);
  }

  const s = summary;
  const critRows = CRITERIA.map(([k, d]) => `<tr><td title="${esc(d)}">${k}</td><td>${s.new.perCriterion[k]}</td><td>${s.baseline.perCriterion[k]}</td></tr>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Poster Eval</title>
<style>
:root{--bg:#f7f7f5;--fg:#18181b;--muted:#6b7280;--card:#fff;--line:#e5e7eb;--good:#15803d;--bad:#b91c1c}
@media (prefers-color-scheme:dark){:root{--bg:#111113;--fg:#f4f4f5;--muted:#a1a1aa;--card:#1c1c1f;--line:#2e2e33;--good:#4ade80;--bad:#f87171}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px}
h1{margin:0 0 4px}h2{margin:32px 0 4px;font-size:18px}
.muted{color:var(--muted);font-size:13px}.warn{color:var(--bad);font-size:13px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.kpi b{display:block;font-size:24px}
table{border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
td,th{padding:6px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-top:10px}
.card{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.card.ship{border-color:var(--good)}.card img{width:100%;display:block}
figcaption{padding:10px 12px;font-size:13px}figcaption p{margin:6px 0}figcaption ul{margin:6px 0;padding-left:18px;color:var(--muted)}
.row{display:flex;justify-content:space-between}.score{font-weight:700}
</style></head><body><main>
<h1>Poster generation stress test</h1>
<p class="muted">${s.cases} ad briefs · ${s.new.posters} new-pipeline posters + ${s.baseline.posters} old-prompt baselines · judged by an independent model</p>
<div class="kpis">
<div class="kpi"><b>${s.new.overall}/10</b>Average ad score (new)</div>
<div class="kpi"><b>${s.new.shipRate}%</b>Posters a CD would ship as-is</div>
<div class="kpi"><b>${s.bestOfThree.shipRate}%</b>Briefs with ≥1 shippable poster (best of 3)</div>
<div class="kpi"><b>${s.new.textAccuracy}%</b>Posters with exactly the right text</div>
<div class="kpi"><b>${s.pairwise.newWins}–${s.pairwise.baselineWins}</b>Blind A/B new vs old (ties ${s.pairwise.ties})</div>
<div class="kpi"><b>${s.new.qcAgreesWithJudge}%</b>In-app QC agrees with judge</div>
</div>
<table><thead><tr><th>Criterion (1–10)</th><th>New</th><th>Old prompt</th></tr></thead><tbody>${critRows}
<tr><td>Overall</td><td>${s.new.overall}</td><td>${s.baseline.overall}</td></tr>
<tr><td>Avg text lines on poster</td><td>${s.new.avgTextLines}</td><td>${s.baseline.avgTextLines}</td></tr>
<tr><td>Avg prompt words</td><td>${s.new.avgPromptWords}</td><td>${s.baseline.avgPromptWords}</td></tr></tbody></table>
<h2>Most common problems (new pipeline)</h2>
<ul>${s.issueThemes.map(([k, n]) => `<li>${esc(k)} — ${n}</li>`).join("")}</ul>
${rows.join("\n")}
</main></body></html>`;
  writeFileSync(join(OUT, "report.html"), html);
  console.log(JSON.stringify(summary, null, 2));
}

void main();
