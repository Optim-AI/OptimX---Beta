import type { AuditBrand, ContentIdea } from './types';

/** Prompt for one 4:5 feed poster from the audit's first idea. Pure (tested). */
export function buildSampleAdPrompt(brand: AuditBrand | null, host: string, idea: ContentIdea): string {
  const i = brand?.interpretation;
  const name = brand?.name || host;
  const product = i?.products?.[0] || i?.productCategory || 'the product';
  return [
    `Design a finished 4:5 social media feed ad for the brand "${name}".`,
    `Product: ${product}.${i?.positioning ? ` Positioning: ${i.positioning}.` : ''}`,
    `Campaign angle: ${idea.title}. Hook: ${idea.hook}.`,
    `Show the headline text exactly: "${idea.hook.replace(/"/g, '')}" and a call-to-action button that says "${idea.cta.replace(/"/g, '')}".`,
    i?.tone ? `Tone: ${i.tone}.` : '',
    'Clean, premium D2C advertising style. One clear product hero shot, generous negative space, legible typography, no extra text, no watermarks, no third-party logos.',
  ]
    .filter(Boolean)
    .join(' ');
}

