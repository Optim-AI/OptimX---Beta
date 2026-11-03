# Sample creatives

Sample ads made with SkalX. The site captions them "Sample & fictional brand ads made with SkalX."

Feed, story and video samples are real SkalX poster-template renders and brand-free
clips (see public/videos/samples). The hero-* and sample-wide-01 files are still
labelled placeholders. Replace each one with a real
sample at the same filename and size. PNG or JPG is fine; keep each file under ~400 KB
(export at quality 80–85). `next/image` handles resizing.

| File | Size (px) | Ratio | What it should show |
| --- | --- | --- | --- |
| `sample-feed-01.jpg` | 1080 × 1350 | 4:5 | Feed ad, fictional food/snack brand |
| `sample-feed-05.jpg` | 896 × 1152 | 7:9 | Feed ad, Yoga Bar oats |
| `sample-feed-06.jpg` | 896 × 1152 | 7:9 | Feed ad, The Whole Truth plant protein |
| `sample-square-01.jpg` | 1024 × 1024 | 1:1 | Square ad, boAt Stone 350 |
| `sample-story-01.jpg` | 1080 × 1920 | 9:16 | Story ad, any of the brands above |
| `sample-story-03.jpg` | 731 × 1280 | 9:16 | Story ad, Plum body lotion |
| `sample-video-01.jpg` | 1080 × 1920 | 9:16 | Poster frame for the sample video (clips live in public/videos/samples) |
| `sample-wide-01.png` | 1920 × 1080 | 16:9 | Wide banner; shown on the sign-in/sign-up showcase |

Homepage hero — one fictional product shown four ways:

| File | Size (px) | Ratio | What it should show |
| --- | --- | --- | --- |
| `hero-before.png` | 1080 × 1350 | 4:5 | Plain product photo, before |
| `hero-feed.png` | 1080 × 1350 | 4:5 | Same product as a finished feed ad |
| `hero-story.png` | 1080 × 1920 | 9:16 | Same product as a finished story ad |
| `hero-video-frame.png` | 1080 × 1920 | 9:16 | Same product as a video-ad frame |

Founder photo (not in this folder): `public/images/founder-aj.jpg`, 800 × 800, square.
After adding it, set `FOUNDER.photo` to `'/images/founder-aj.jpg'` in `lib/marketing/content.ts`.
