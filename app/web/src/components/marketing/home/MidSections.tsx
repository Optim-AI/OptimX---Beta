import React from 'react';
import { Camera, Clapperboard, Film, Images, LayoutGrid, Lightbulb, Link2, PartyPopper, ImageIcon, UserRound, Mic, Quote } from 'lucide-react';
import { MAKES, START_FROM, TEST_FIRST, UGC } from '@/content/home';
import { getFeature, isAvailable } from '@/content/features';
import { UGC_CLIPS } from '@/content/showcase';
import { MIN_STATS_TO_SHOW, sourcedStats } from '@/content/stats';
import Reveal from '../Reveal';
import { Badge } from '../kit/Badge';
import { FeatureCard } from '../kit/FeatureCard';
import { MockupFrame } from '../kit/MockupFrame';
import { Section, SectionHeading } from '../kit/Section';
import { StatBand } from '../kit/StatBand';
import { VideoTile } from '../kit/VideoTile';

/** Section 4: stats band. Renders nothing until 3+ stats in content/stats.ts have a source. */
export function StatsSection() {
  if (sourcedStats().length < MIN_STATS_TO_SHOW) return null;
  return (
    <section aria-label="SkalX in numbers" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <StatBand />
      </div>
    </section>
  );
}

/** Section 5: UGC video ads (only while the feature is live or beta). */
export function UgcSection() {
  const feature = getFeature('ugc-video-ads');
  if (!feature) return null;
  const icons = [UserRound, Mic, Quote];
  if (feature.status === 'soon') {
    return (
      <Section id="ugc" labelledBy="ugc-title" tone="paper" width="narrow">
        <div className="rounded-card border border-line bg-surface p-6 text-center">
          <Badge status="soon" />
          <h2 id="ugc-title" className="mt-3 font-display text-h3 font-semibold">
            {UGC.waitlist.title}
          </h2>
          <p className="mt-2 text-ink-soft">{UGC.waitlist.body}</p>
        </div>
      </Section>
    );
  }
  // Generated UGC clips once approved (content/showcase.generated.ts), else the starter samples.
  const clips = UGC_CLIPS.length
    ? UGC_CLIPS.slice(0, 2).map((c) => ({ poster: c.poster, sources: [{ src: c.webm, type: 'video/webm' as const }, { src: c.mp4, type: 'video/mp4' as const }], label: c.label }))
    : [
        { poster: '/videos/samples/sample-video-03.jpg', sources: [{ src: '/videos/samples/sample-video-03.mp4', type: 'video/mp4' as const }], label: 'Sample UGC-style video: a creator shows a skincare product to her phone camera' },
        { poster: '/videos/samples/sample-video-06.jpg', sources: [{ src: '/videos/samples/sample-video-06.mp4', type: 'video/mp4' as const }], label: 'Sample video: a spice-business founder talks to the camera in his workshop' },
      ];
  return (
    <Section id="ugc" labelledBy="ugc-title" tone="ink" className="sx-sheet" innerClassName="grid items-center gap-12 lg:grid-cols-12">
      <div className="lg:col-span-6">
        <SectionHeading id="ugc-title" tone="ink" eyebrow={UGC.eyebrow} title={UGC.title} sub={UGC.sub} />
        <ul className="mt-8 space-y-3">
          {UGC.cards.map((c, i) => {
            const Icon = icons[i];
            return (
              <li key={c.title} className="flex gap-4 rounded-card border border-paper/10 bg-paper/[0.04] p-4">
                <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-accent-on-ink" />
                <div>
                  <h3 className="font-display text-[17px] font-semibold">{c.title}</h3>
                  <p className="mt-1 text-[15px] text-paper/70">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="lg:col-span-6">
        <ul className="flex items-end justify-center gap-4">
          {clips.map((c, i) => (
            <li key={c.poster} className={`w-[44%] max-w-[220px] ${i === 1 ? 'translate-y-6' : ''}`}>
              <VideoTile sources={c.sources} poster={c.poster} label={c.label} frame="phone" />
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center text-xs text-paper/60">Sample videos for fictional brands.</p>
      </div>
    </Section>
  );
}

/** Example-data mockups for Section 6 (built as components so they stay crisp and editable). */
function TestMockup({ id }: { id: string }) {
  if (id === 'ad-watch') {
    return (
      <ul className="grid grid-cols-3 gap-2">
        {[
          ['Aqua Bloom', 47, true],
          ['Mistleaf', 9, false],
          ['Kesar & Co.', 12, false],
        ].map(([name, days, top]) => (
          <li key={String(name)} className={`rounded-lg border p-2 ${top ? 'border-accent bg-accent-wash' : 'border-line bg-paper'}`}>
            <span aria-hidden className="block aspect-square rounded-md bg-ink/10" />
            <p className="mt-1.5 truncate text-[11.5px] font-medium">{name}</p>
            <p className={`text-[11px] tabular-nums ${top ? 'font-semibold text-accent-deep' : 'text-ink-mute'}`}>{days} days running</p>
          </li>
        ))}
      </ul>
    );
  }
  if (id === 'category') {
    return (
      <ul className="space-y-2.5 text-[12.5px]">
        {[
          ['Before / after', 22],
          ['Free shipping offer', 18],
          ['UGC unboxing', 15],
          ['Ingredient close-up', 11],
        ].map(([label, pct]) => (
          <li key={String(label)}>
            <div className="flex justify-between">
              <span>{label}</span>
              <span className="tabular-nums text-ink-mute">{pct}%</span>
            </div>
            <span aria-hidden className="mt-1 block h-1.5 rounded-full bg-paper-deep">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Number(pct) * 3}%` }} />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (id === 'customers') {
    return (
      <ul className="space-y-2 text-[12.5px]">
        {[
          ['Doubt', '“Sticky in humidity?”', 'Show a 6-hour wear test'],
          ['Reason to buy', '“No white cast”', 'Lead with a close-up on dark skin'],
        ].map(([kind, quote, angle]) => (
          <li key={quote} className="rounded-lg bg-paper p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-mute">{kind}</p>
            <p className="mt-0.5">{quote}</p>
            <p className="mt-1 text-accent-deep">→ {angle}</p>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="space-y-2 text-[12.5px]">
      {[
        ['Before / after on oily skin', 'Does the main doubt hold people back?', true],
        ['₹449 vs. ₹1,200 brands', 'Is price the real objection?', false],
        ['Humidity test, 15s UGC', 'Does proof beat claims?', false],
      ].map(([name, tests, first]) => (
        <li key={String(name)} className="flex items-start justify-between gap-2 rounded-lg bg-paper p-2.5">
          <div>
            <p className="font-medium">{name}</p>
            <p className="text-ink-mute">Tests: {tests}</p>
          </div>
          {first ? <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-semibold text-paper">Test first</span> : null}
        </li>
      ))}
      <li className="text-[11.5px] text-ink-mute">+3 more variants</li>
    </ul>
  );
}

/** Section 6: know what's worth testing, before spending. */
export function TestFirstSection() {
  const csvLive = isAvailable('ads-export-upload');
  return (
    <Section id="test-first" labelledBy="test-first-title" tone="deep" className="sx-sheet">
      <SectionHeading id="test-first-title" eyebrow={TEST_FIRST.eyebrow} title={TEST_FIRST.title} sub={TEST_FIRST.sub} />
      <ul className="mt-10 grid gap-5 md:grid-cols-2">
        {TEST_FIRST.cards.map((c, i) => (
          <Reveal as="li" key={c.id} delay={i * 90}>
            <MockupFrame title={c.title}>
              <p className="mb-4 text-[14px] text-ink-soft">{c.body}</p>
              <TestMockup id={c.id} />
              <p className="mt-4 text-[11.5px] text-ink-mute">{c.source}</p>
            </MockupFrame>
          </Reveal>
        ))}
      </ul>
      {/* No "coming soon" anywhere: the export-upload line shows only once it is live. */}
      {csvLive ? <p className="mt-8 text-[15px] text-ink-soft">{TEST_FIRST.csvLine}</p> : null}
    </Section>
  );
}

/** Section 7: formats SkalX makes (lighter than 2b and 3). */
export function MakesSection() {
  const icons = [ImageIcon, LayoutGrid, Film, Clapperboard, Camera, PartyPopper];
  return (
    <Section id="what-you-get" labelledBy="makes-title" tone="paper">
      <SectionHeading id="makes-title" eyebrow={MAKES.eyebrow} title={MAKES.title} sub={MAKES.sub} />
      <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MAKES.items.map((m, i) => {
          const Icon = icons[i];
          const status = getFeature(m.featureId)?.status;
          return (
            <li key={m.title}>
              <FeatureCard title={m.title} body={m.body} icon={<Icon className="h-5 w-5" />} status={status} />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Section 8: start from a link, a photo or an idea. */
export function StartFromSection() {
  const icons = [Link2, Images, Lightbulb];
  return (
    <Section id="start-from" labelledBy="start-from-title" tone="surface">
      <SectionHeading id="start-from-title" eyebrow={START_FROM.eyebrow} title={START_FROM.title} sub={START_FROM.sub} />
      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {START_FROM.items.map((s, i) => {
          const Icon = icons[i];
          return (
            <li key={s.title}>
              <FeatureCard title={s.title} body={s.body} icon={<Icon className="h-5 w-5" />} className="bg-paper" />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
