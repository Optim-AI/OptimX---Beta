/**
 * Brand research as a downloadable A4 PDF (built in the browser with @react-pdf/renderer).
 * Mirrors the on-screen report's sections and order. Loaded only when the user clicks download.
 */

import React from 'react';
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import type { BrandResearch, EvidenceBasis, ResearchInsight } from '@/lib/research/brand-research';

// Helvetica is a built-in PDF font (nothing to embed). The project's .woff2 web fonts
// can't be embedded by the PDF library, so the brand font isn't used here.
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  // Keep words whole; the default splits long words with hyphens.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const INK = '#17140F';
const SOFT = '#55504A';
const MUTE = '#8A847C';
const LINE = '#E6E1D8';
const WASH = '#F6F3EE';
const ACCENT = '#1D4ED8';

const STAGE_LABEL = ['', 'New category', 'Growing', 'Crowded claims', 'Mechanism race', 'Jaded buyers'];
const BASIS_LABEL: Record<EvidenceBasis, string> = { site: 'From your site', web: 'From the web', inferred: 'Our read' };

/** Helvetica has no ₹ glyph, so prices read "Rs." in the PDF. */
const clean = (s: string | undefined | null) => (s ?? '').replace(/₹\s?/g, 'Rs. ');

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9.5, color: INK, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, lineHeight: 1.45 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 },
  logo: { width: 70, height: 20, objectFit: 'contain' },
  kicker: { fontSize: 8, color: MUTE, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', letterSpacing: -0.4, marginTop: 4, lineHeight: 1.2 },
  site: { fontSize: 10, color: ACCENT, marginTop: 4 },
  meta: { fontSize: 8, color: MUTE, marginTop: 6 },
  section: { marginTop: 18 },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  hint: { fontSize: 8.5, color: MUTE, marginBottom: 8 },
  label: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTE, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 10, marginBottom: 4 },
  body: { fontSize: 9.5, color: INK },
  soft: { fontSize: 9, color: SOFT },
  small: { fontSize: 8, color: MUTE },
  box: { backgroundColor: WASH, borderRadius: 6, padding: 10, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  cell: { width: '25%', paddingHorizontal: 3, marginBottom: 6 },
  cellBox: { backgroundColor: WASH, borderRadius: 6, padding: 8 },
  bulletRow: { flexDirection: 'row', marginBottom: 3 },
  bullet: { width: 10, color: ACCENT },
  bulletText: { flex: 1 },
  chip: { fontSize: 7, color: SOFT, backgroundColor: '#ECE7DF', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  num: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: ACCENT },
  // Footer is placed from the top of the A4 page (841.89pt tall): a `bottom` offset puts the
  // page-number text off the page once the report runs past one page.
  footerLine: { position: 'absolute', top: 803, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: LINE },
  footerLeft: { position: 'absolute', top: 809, left: 44, fontSize: 7.5, color: MUTE },
  footerRight: { position: 'absolute', top: 809, left: 44, right: 44, textAlign: 'right', fontSize: 7.5, color: MUTE },
  link: { color: ACCENT, textDecoration: 'none' },
});

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View wrap={false} minPresenceAhead={60}>
        <Text style={s.h2}>{title}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Bullets({ items, strike = false }: { items: string[]; strike?: boolean }) {
  return (
    <View>
      {items.map((t, i) => (
        <View key={i} style={s.bulletRow} wrap={false}>
          <Text style={s.bullet}>•</Text>
          <Text style={[s.bulletText, s.body, strike ? { color: SOFT } : {}]}>{clean(t)}</Text>
        </View>
      ))}
    </View>
  );
}

function Insights({ items, empty }: { items: ResearchInsight[]; empty: string }) {
  if (!items.length) return <Text style={s.small}>{empty}</Text>;
  return (
    <View>
      {items.map((it, i) => (
        <View key={i} style={s.box} wrap={false}>
          <View style={s.rowBetween}>
            <Text style={[s.body, { flex: 1 }]}>{clean(it.insight)}</Text>
            <Text style={s.chip}>{BASIS_LABEL[it.basis] ?? it.basis}</Text>
          </View>
          {it.evidence ? <Text style={[s.soft, { marginTop: 3 }]}>{clean(it.evidence)}</Text> : null}
          {it.source ? <Text style={[s.small, { marginTop: 2 }]}>{clean(it.source)}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function evidenceLine(r: BrandResearch): string {
  const e = r.evidence;
  const bits = [`${e.pages_read} page${e.pages_read === 1 ? '' : 's'} of your site`];
  if (e.products_found) bits.push(`${e.products_found} product${e.products_found === 1 ? '' : 's'}`);
  if (e.web_sources) bits.push(`${e.web_sources} web sources`);
  return `Based on ${bits.join(' · ')}`;
}

export function BrandResearchPdfDocument({ research: r, logoSrc }: { research: BrandResearch; logoSrc: string }) {
  const cv = r.customer_voice;
  const date = new Date(r.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const host = hostOf(r.websiteUrl);
  const ads = r.competitor_ads;
  const adsWithAds = ads?.status === 'ok' ? ads.competitors.filter((c) => c.ads.length) : [];

  return (
    <Document title={`Brand research — ${host}`} author="SkalX" creator="SkalX" producer="SkalX">
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <Image src={logoSrc} style={s.logo} />
          <Text style={s.small}>Brand research · {host}</Text>
        </View>

        <Text style={s.kicker}>Brand research</Text>
        <Text style={s.title}>{host}</Text>
        <Text style={s.site}>
          <Link src={r.websiteUrl} style={s.link}>
            {r.websiteUrl}
          </Link>
        </Text>
        <Text style={s.meta}>
          {evidenceLine(r)} · {date}
        </Text>

        <Section title="The read">
          <Text style={[s.body, { fontSize: 10.5, lineHeight: 1.55 }]}>{clean(r.summary)}</Text>
          <View style={[s.grid, { marginTop: 10 }]}>
            {(
              [
                ['Category', r.snapshot.category],
                ['Business model', r.snapshot.business_model],
                ['Market', r.snapshot.market],
                ['Price point', r.snapshot.price_point],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <View key={k} style={s.cell}>
                  <View style={s.cellBox}>
                    <Text style={s.small}>{k}</Text>
                    <Text style={[s.body, { marginTop: 2 }]}>{clean(v)}</Text>
                  </View>
                </View>
              ))}
          </View>
          {r.evidence.notes.length > 0 ? (
            <View style={{ marginTop: 4 }}>
              {r.evidence.notes.map((n) => (
                <Text key={n} style={[s.small, { color: '#A16207' }]}>
                  {clean(n)}
                </Text>
              ))}
            </View>
          ) : null}
        </Section>

        {r.opportunities.length > 0 ? (
          <Section title="Where to win" hint="The highest-leverage moves, each tied to what the research found.">
            {r.opportunities.map((o, i) => (
              <View key={i} style={s.box} wrap={false}>
                <Text style={s.num}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={[s.body, { fontFamily: 'Helvetica-Bold', marginTop: 1 }]}>{clean(o.title)}</Text>
                <Text style={[s.soft, { marginTop: 4 }]}>
                  <Text style={{ color: INK, fontFamily: 'Helvetica-Bold' }}>Why: </Text>
                  {clean(o.why)}
                </Text>
                <Text style={[s.soft, { marginTop: 3 }]}>
                  <Text style={{ color: INK, fontFamily: 'Helvetica-Bold' }}>Play: </Text>
                  {clean(o.play)}
                </Text>
                {o.evidence ? <Text style={[s.small, { marginTop: 3 }]}>Evidence: {clean(o.evidence)}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        <Section title="Positioning" hint="What you claim, and whether the site proves it.">
          {r.positioning.claimed ? (
            <Text style={[s.body, { color: SOFT }]}>&ldquo;{clean(r.positioning.claimed)}&rdquo;</Text>
          ) : null}
          {r.positioning.verdict ? <Text style={[s.body, { marginTop: 6 }]}>{clean(r.positioning.verdict)}</Text> : null}
          <Text style={s.label} minPresenceAhead={50}>Proof you have</Text>
          <Insights items={r.positioning.proof_points} empty="No proof points found on the site." />
          {r.positioning.gaps.length > 0 ? (
            <>
              <Text style={s.label} minPresenceAhead={50}>Gaps</Text>
              <Bullets items={r.positioning.gaps} />
            </>
          ) : null}
        </Section>

        {r.audiences.length > 0 ? (
          <Section title="Who buys, and when">
            {r.audiences.map((a, i) => (
              <View key={i} style={s.box} wrap={false}>
                <View style={s.rowBetween}>
                  <Text style={[s.body, { fontFamily: 'Helvetica-Bold', flex: 1 }]}>{clean(a.segment)}</Text>
                  <Text style={s.chip}>{BASIS_LABEL[a.basis] ?? a.basis}</Text>
                </View>
                <Text style={[s.soft, { marginTop: 4 }]}>
                  <Text style={{ color: INK, fontFamily: 'Helvetica-Bold' }}>Hires it to: </Text>
                  {clean(a.job_to_be_done)}
                </Text>
                <Text style={[s.soft, { marginTop: 2 }]}>
                  <Text style={{ color: INK, fontFamily: 'Helvetica-Bold' }}>Starts looking when: </Text>
                  {clean(a.trigger_moment)}
                </Text>
                <Text style={[s.soft, { marginTop: 2 }]}>
                  <Text style={{ color: INK, fontFamily: 'Helvetica-Bold' }}>Needs to hear: </Text>
                  {clean(a.what_they_need_to_hear)}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        <Section title="Competitors" hint={r.competitors.length ? 'Brands your buyers compare you with, found on the web.' : undefined}>
          {r.competitors.length === 0 ? (
            <Text style={s.small}>Competitor search was unavailable for this run.</Text>
          ) : (
            r.competitors.map((c) => (
              <View key={c.name} style={s.box} wrap={false}>
                <View style={s.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.body, { fontFamily: 'Helvetica-Bold' }]}>{clean(c.name)}</Text>
                    {c.flagship ? <Text style={s.small}>{clean(c.flagship)}</Text> : null}
                  </View>
                  {c.price_point ? <Text style={s.body}>{clean(c.price_point)}</Text> : null}
                </View>
                <Text style={[s.soft, { marginTop: 4 }]}>
                  <Text style={{ color: INK, fontFamily: 'Helvetica-Bold' }}>Positioning: </Text>
                  {clean(c.positioning)}
                </Text>
                <Text style={[s.soft, { marginTop: 2 }]}>
                  <Text style={{ color: INK, fontFamily: 'Helvetica-Bold' }}>Strength: </Text>
                  {clean(c.strength)}
                </Text>
                <Text style={[s.soft, { marginTop: 2 }]}>
                  <Text style={{ color: INK, fontFamily: 'Helvetica-Bold' }}>Weakness: </Text>
                  {clean(c.weakness)}
                </Text>
                <Text style={[s.body, { marginTop: 4 }]}>
                  <Text style={{ color: ACCENT, fontFamily: 'Helvetica-Bold' }}>How you win: </Text>
                  {clean(c.how_to_win)}
                </Text>
              </View>
            ))
          )}
        </Section>

        {ads?.status === 'ok' && (ads.patterns.length > 0 || ads.implication || adsWithAds.length > 0) ? (
          <Section title="Competitor ads" hint="What your competitors are running on Facebook and Instagram.">
            {ads.patterns.length > 0 ? <Bullets items={ads.patterns} /> : null}
            {ads.implication ? (
              <Text style={[s.soft, { marginTop: 4 }]}>
                <Text style={{ color: INK, fontFamily: 'Helvetica-Bold' }}>For you: </Text>
                {clean(ads.implication)}
              </Text>
            ) : null}
            {adsWithAds.map((e) => (
              <View key={e.name} style={[s.box, { marginTop: 8 }]} wrap={false}>
                <View style={s.rowBetween}>
                  <Text style={[s.body, { fontFamily: 'Helvetica-Bold' }]}>
                    {clean(e.name)} · {e.activeAds} active ad{e.activeAds === 1 ? '' : 's'}
                  </Text>
                  <Link src={e.libraryUrl} style={[s.small, s.link]}>
                    All their ads
                  </Link>
                </View>
                {e.leadsWith ? <Text style={[s.soft, { marginTop: 2 }]}>Leads with: {clean(e.leadsWith)}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        <Section title="What buyers say" hint="From Reddit, reviews and forums about your category.">
          <Text style={s.label} minPresenceAhead={50}>They want</Text>
          <Insights items={cv.desires} empty="Nothing found." />
          <Text style={s.label} minPresenceAhead={50}>They&apos;re frustrated by</Text>
          <Insights items={cv.frustrations} empty="Nothing found." />
          <Text style={s.label} minPresenceAhead={50}>Before buying they worry</Text>
          <Insights items={cv.objections} empty="Nothing found." />
          {cv.their_words.length > 0 ? (
            <>
              <Text style={s.label} minPresenceAhead={50}>In their words</Text>
              <Bullets items={cv.their_words.map((w) => `“${w}”`)} />
            </>
          ) : null}
        </Section>

        <Section title="Market" hint="How hard buyers are to impress, and which claims no longer work.">
          <Text style={s.body}>
            Sophistication: stage {r.market.sophistication.stage} of 5 · {STAGE_LABEL[r.market.sophistication.stage] ?? ''}
          </Text>
          {r.market.sophistication.meaning ? <Text style={[s.soft, { marginTop: 4 }]}>{clean(r.market.sophistication.meaning)}</Text> : null}
          {r.market.saturated_claims.length > 0 ? (
            <>
              <Text style={s.label} minPresenceAhead={50}>Claims everyone makes (avoid leading with these)</Text>
              <Bullets items={r.market.saturated_claims} strike />
            </>
          ) : null}
          {r.market.whitespace.length > 0 ? (
            <>
              <Text style={s.label} minPresenceAhead={50}>Open positions you could own</Text>
              <Bullets items={r.market.whitespace} />
            </>
          ) : null}
        </Section>

        <Section title="Your website" hint="What's likely costing you sales right now.">
          {r.site_findings.length === 0 ? (
            <Text style={s.small}>No issues found.</Text>
          ) : (
            r.site_findings.map((f, i) => (
              <View key={i} style={s.box} wrap={false}>
                <View style={s.rowBetween}>
                  <Text style={[s.body, { flex: 1 }]}>{clean(f.finding)}</Text>
                  <Text
                    style={[
                      s.chip,
                      f.impact === 'high' ? { color: '#B91C1C', backgroundColor: '#FDE2E2' } : f.impact === 'medium' ? { color: '#A16207', backgroundColor: '#FEF3C7' } : {},
                    ]}
                  >
                    {f.impact.toUpperCase()}
                  </Text>
                </View>
                <Text style={[s.soft, { marginTop: 3 }]}>Fix: {clean(f.fix)}</Text>
              </View>
            ))
          )}
          {r.reputation.summary || r.reputation.ratings.length > 0 ? (
            <>
              <Text style={s.label} minPresenceAhead={50}>Reputation online</Text>
              {r.reputation.ratings.length > 0 ? <Text style={s.body}>{clean(r.reputation.ratings.join(' · '))}</Text> : null}
              {r.reputation.summary ? <Text style={[s.soft, { marginTop: 2 }]}>{clean(r.reputation.summary)}</Text> : null}
            </>
          ) : null}
        </Section>

        {r.sources.length > 0 ? (
          <Section title="Sources">
            {r.sources.map((src) => (
              <View key={src.url} style={s.bulletRow} wrap={false}>
                <Text style={s.bullet}>•</Text>
                <Link src={src.url} style={[s.bulletText, s.small, s.link]}>
                  {clean(src.title || src.url)}
                </Link>
              </View>
            ))}
          </Section>
        ) : null}

        <View style={s.footerLine} fixed />
        <Text style={s.footerLeft} fixed>
          Made with SkalX · skalxai.app
        </Text>
        <Text style={s.footerRight} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}

/** Build the PDF and trigger a download. */
export async function downloadBrandResearchPdf(research: BrandResearch): Promise<void> {
  registerFonts();
  const logoSrc = `${window.location.origin}/images/SkalX_Logo.png`;
  const blob = await pdf(<BrandResearchPdfDocument research={research} logoSrc={logoSrc} />).toBlob();
  const host = hostOf(research.websiteUrl).replace(/[^a-z0-9.-]+/gi, '-');
  const day = new Date(research.generatedAt).toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SkalX-brand-research-${host}-${day}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
