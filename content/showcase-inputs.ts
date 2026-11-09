/**
 * Inputs for scripts/generate-showcase.ts. FICTIONAL BRANDS ONLY (or real brands with
 * written permission on file). Names below are proposals: approve them (and run a quick
 * trademark search) before generating.
 *
 * Each ad lists the finding and angle it is built on. Fictional brands have no real
 * reviews, so findings here are illustrative and the site labels them "Example".
 */

export type ShowcaseAngle = {
  finding: string;
  angle: string;
  /** Headline printed on the ad. */
  headline: string;
  cta: string;
};

export type ShowcaseBrandInput = {
  id: string;
  name: string;
  category: string;
  /** Fictional store URL shown as the "input link". Never a real domain we don't own. */
  inputLink: string;
  product: string;
  /** Visual description used for the packshot and every scene. */
  productLook: string;
  palette: string;
  approved: boolean;
  posters: [ShowcaseAngle, ShowcaseAngle];
  carousel: ShowcaseAngle & { slides: [string, string, string] };
  productVideo: ShowcaseAngle & { scenes: [string, string] };
  ugc: ShowcaseAngle & { creator: string; script: string };
  photoshoot: { scene: string; angle: ShowcaseAngle };
};

export const SHOWCASE_BRANDS: ShowcaseBrandInput[] = [
  {
    id: 'saffra-skin',
    name: 'Saffra Skin',
    category: 'Skincare',
    inputLink: 'saffraskin.example',
    product: 'Saffra Skin oil-free gel moisturiser, 50 ml',
    productLook: 'a frosted pale-green 50 ml pump bottle with a white cap and a minimal cream label reading "Saffra Skin · Gel Moisturiser"',
    palette: 'sage green, cream and soft white',
    approved: true,
    posters: [
      { finding: 'Oily-skin buyers ask if a moisturiser will feel greasy.', angle: 'Prove it on oily skin, in humidity.', headline: 'Oily skin? Still never greasy.', cta: 'Shop now' },
      { finding: 'Competitors list ingredients but never explain them.', angle: 'One ingredient, one job, in plain words.', headline: 'Niacinamide 4%. Calms shine, not your skin.', cta: 'See ingredients' },
    ],
    carousel: {
      finding: 'Buyers worry routines have too many steps.',
      angle: 'A full routine in three slides.',
      headline: 'Three steps. Done before chai.',
      cta: 'Build your routine',
      slides: ['Step 1: Cleanse. 30 seconds.', 'Step 2: One pump of gel moisturiser.', 'Step 3: Sunscreen. You’re done.'],
    },
    productVideo: {
      finding: 'Reviewers praise how light it feels.',
      angle: 'Show the texture melting into skin.',
      headline: 'Weightless. Even in May.',
      cta: 'Shop now',
      scenes: [
        'Macro shot: a drop of clear green gel pressed between two fingers, light sunlight, slow motion',
        'The bottle on a bathroom shelf with steam and morning light, a hand presses the pump once',
      ],
    },
    ugc: {
      finding: 'Customers trust other oily-skin users more than ads.',
      angle: 'A real-feeling review from someone with oily skin.',
      headline: '“Week two on oily skin.”',
      cta: 'Try it',
      creator: 'a woman in her late twenties with naturally oily skin, casual home setting, natural window light, filming selfie-style on her phone',
      script: 'Okay, oily skin girls, week two with this gel. No grease by lunch, and it doesn’t pill under sunscreen.',
    },
    photoshoot: {
      scene: 'on a wet green leaf with water droplets, soft morning light, shallow depth of field',
      angle: { finding: 'Competitor photos are flat white packshots.', angle: 'Show freshness, not a catalogue shot.', headline: 'Fresh, like the first rain.', cta: 'Shop now' },
    },
  },
  {
    id: 'kolam-kitchen',
    name: 'Kolam Kitchen',
    category: 'Food & spices',
    inputLink: 'kolamkitchen.example',
    product: 'Kolam Kitchen Chettinad masala, 100 g pouch',
    productLook: 'a matte terracotta-orange 100 g stand-up pouch with a white kolam line pattern and the text "Kolam Kitchen · Chettinad Masala"',
    palette: 'terracotta, turmeric yellow and off-white',
    approved: true,
    posters: [
      { finding: 'Reviewers say it tastes “like home”.', angle: 'Lead with a family recipe, not the pack.', headline: 'The Sunday kozhambu, in one spoon.', cta: 'Order now' },
      { finding: 'Competitors never show where spices come from.', angle: 'Show the source.', headline: 'Stone-ground in Karaikudi. Not in a factory.', cta: 'Our story' },
    ],
    carousel: {
      finding: 'Buyers ask how to use the masala.',
      angle: 'Turn the pack into a 3-step recipe.',
      headline: 'Chettinad chicken in 25 minutes.',
      cta: 'Get the recipe',
      slides: ['Sauté onions and curry leaves.', 'Add 2 spoons of Chettinad masala.', 'Simmer 15 minutes. Serve hot.'],
    },
    productVideo: {
      finding: 'Aroma is the most praised quality in reviews.',
      angle: 'Make the viewer smell it.',
      headline: 'You can almost smell this.',
      cta: 'Order now',
      scenes: [
        'Close-up of whole dry red chillies, pepper and star anise being roasted in an iron kadai, smoke rising, warm light',
        'A spoon of red-brown masala falls into a pot of bubbling curry in a home kitchen, steam rising',
      ],
    },
    ugc: {
      finding: 'Gifting and home cooking come up together in reviews.',
      angle: 'A home cook’s honest take.',
      headline: '“Tastes like my paati’s.”',
      cta: 'Try it',
      creator: 'a cheerful woman in her forties in a bright South Indian home kitchen, cotton saree, talking to her phone camera while cooking',
      script: 'I don’t usually buy masala, I grind my own. But this one tastes like my paati’s. Just two spoons, that’s all.',
    },
    photoshoot: {
      scene: 'on a brass plate with whole spices and a banana leaf, top-down, warm daylight',
      angle: { finding: 'Buyers associate brass and banana leaf with authenticity.', angle: 'Traditional table, modern pack.', headline: 'Old recipe. New pouch.', cta: 'Order now' },
    },
  },
  {
    id: 'crunchwell',
    name: 'Crunchwell',
    category: 'Snacks',
    inputLink: 'crunchwell.example',
    product: 'Crunchwell roasted peri-peri makhana, 80 g',
    productLook: 'a bright orange 80 g snack pouch with a window showing roasted makhana and the text "Crunchwell · Peri Peri Makhana"',
    palette: 'bright orange, charcoal and white',
    approved: true,
    posters: [
      { finding: 'Reviews of roasted snacks ask “is it actually healthy?”.', angle: 'Lead with the ingredient list.', headline: '5 ingredients. You can read all of them.', cta: 'Shop now' },
      { finding: 'Buyers snack at 4 p.m. at their desks.', angle: 'Own the 4 p.m. moment.', headline: 'The 4 p.m. snack that isn’t biscuits.', cta: 'Grab a pack' },
    ],
    carousel: {
      finding: 'Buyers compare snacks on protein and frying.',
      angle: 'A fair side-by-side.',
      headline: 'Makhana vs. chips. No contest.',
      cta: 'Switch now',
      slides: ['Roasted, never fried.', 'Lighter on oil than a pack of fried chips.', 'Same crunch. Better 4 p.m.'],
    },
    productVideo: {
      finding: 'Crunch is the most mentioned word in reviews.',
      angle: 'Let them hear the crunch.',
      headline: 'Hear that?',
      cta: 'Shop now',
      scenes: [
        'Slow-motion macro of roasted makhana tumbling into a ceramic bowl, peri-peri seasoning dust in the air',
        'An office desk at 4 p.m., a hand reaches into the orange pouch beside a laptop, golden afternoon light',
      ],
    },
    ugc: {
      finding: 'Gym-goers recommend it to each other.',
      angle: 'A fitness creator’s snack swap.',
      headline: '“My post-gym swap.”',
      cta: 'Try it',
      creator: 'a fit young man in his twenties in gym clothes in a parked car after a workout, filming selfie-style',
      script: 'Post-gym and I want something crunchy. This makhana is roasted, not fried, and honestly the peri-peri hits.',
    },
    photoshoot: {
      scene: 'on a concrete desk next to a notebook and cold coffee, afternoon window light',
      angle: { finding: 'Desk snacking is the main use moment.', angle: 'Show it where it’s eaten.', headline: 'Desk snack, upgraded.', cta: 'Shop now' },
    },
  },
  {
    id: 'monsoon-thread',
    name: 'Monsoon Thread',
    category: 'Fashion',
    inputLink: 'monsoonthread.example',
    product: 'Monsoon Thread handblock-print cotton kurta',
    productLook: 'a relaxed-fit indigo cotton kurta with a white handblock floral print and wooden buttons',
    palette: 'indigo, white and natural cotton',
    approved: true,
    posters: [
      { finding: 'Buyers ask if cotton kurtas shrink after washing.', angle: 'Answer the wash question head-on.', headline: 'Pre-washed. Same fit after 20 washes.', cta: 'Shop kurtas' },
      { finding: 'Competitors shoot on studio white only.', angle: 'Show it in real monsoon weather.', headline: 'Made for humid days.', cta: 'Shop now' },
    ],
    carousel: {
      finding: 'Buyers want to know how the print is made.',
      angle: 'Show the craft in three steps.',
      headline: 'One kurta. 3 days of handwork.',
      cta: 'Meet the makers',
      slides: ['Carved teak blocks.', 'Printed by hand, one block at a time.', 'Sun-dried and washed.'],
    },
    productVideo: {
      finding: 'Reviewers love how breathable it is.',
      angle: 'Show it moving in the breeze.',
      headline: 'Breathes like you do.',
      cta: 'Shop now',
      scenes: [
        'A woman in the indigo kurta walks through a breezy terrace with drying clothes on a line, fabric moving gently',
        'Close-up of the handblock print and wooden buttons in soft overcast monsoon light',
      ],
    },
    ugc: {
      finding: 'Buyers trust try-on videos over model shots.',
      angle: 'An honest try-on.',
      headline: '“Try-on, no filter.”',
      cta: 'Shop now',
      creator: 'a woman in her thirties doing a mirror try-on in a bedroom with natural light, holding her phone',
      script: 'Try-on time. It’s the medium, I’m usually a medium, and it’s so light. Washed it twice already, no shrinking.',
    },
    photoshoot: {
      scene: 'folded on a wooden stool beside a window with rain outside, soft grey light',
      angle: { finding: 'Monsoon is the peak season for cotton.', angle: 'Sell the season.', headline: 'Rain outside. Comfort inside.', cta: 'Shop now' },
    },
  },
];
