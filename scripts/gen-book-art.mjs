// Generate the JAZZ book's cohesive illustration set with Gemini nano-banana-pro,
// reference-conditioned on the locked model sheet so the bunny + the bold-outline
// cartoon style stay on-model across every plate. No text in the art.
//   node scripts/gen-book-art.mjs            (all)
//   node scripts/gen-book-art.mjs cover       (one)
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { generateImage } from '../lib/gemini.js';

mkdirSync('book/img/art', { recursive: true });
const ref = { base64: readFileSync('art-src/STYLE_modelsheet.jpg').toString('base64'), mimeType: 'image/jpeg' };

const STYLE = 'Bold-outline flat-cel SATURDAY-MORNING CARTOON illustration in the EXACT style + palette of the attached Jazz model sheet (light-blue rabbit hero "Jazz" in an orange jumpsuit + green sneakers, holding a purple-and-green bazooka). Bright, clean, zany, heroic, beautiful. Thick black outlines, flat vivid colors, simple cel shading. Absolutely NO text, NO words, NO letters, NO numbers, NO captions anywhere.';

const JOBS = [
  ['cover', '2:3', 'Epic vertical book cover. Jazz the cartoon bunny mid-leap in rim-light, bazooka in hand, toward the viewer; behind him five dreamlike cartoon worlds recede into mist — a glowing crystal cavern, a neon sunset city, sunny desert dunes, a lava foundry, a stormy sky-fortress — with a rusty robot army (the Tin Tyrant) silhouetted far below. Keep the upper third a calm open sky for a title.'],
  ['ch1', '2:3', 'Two glowing "starting places" on a workbench: on the left an open blueprint/skeleton of a small game (a deployable app diagram with gears), on the right a softly glowing methodology playbook; from the space between them, a beam of light births the cartoon bunny hero into existence. Warm studio gloom. Keep a calm dark band across the top for a title.'],
  ['ch2', '2:3', 'A transformation: a small flat PIXEL-ART frog on the left dissolves into floating squares that re-form on the right into the smooth bold-outline cartoon bunny with a bazooka — the same pose, a new skin and a new verb (stomp becomes shoot). A faint dividing line of light between the two. Keep a calm area at the top for a title.'],
  ['ch3', '2:3', 'An art studio of creation: a character turnaround/model sheet of the bunny pinned up, and a luminous AI hand drawing from it a row of rusty cartoon ROBOT enemies (the Tin Tyrant\'s bots) on a flat magenta backdrop, each on-model and coherent. Brushes, a colour palette swatch, gentle glow. Keep a calm area at the top for a title.'],
  ['ch4', '2:3', 'A glowing orb of music — a benevolent AI composer — pouring a ribbon of golden musical light over the cartoon bunny\'s world; floating quarter-notes, a brass horn, and a little speaker, scoring a Saturday-morning caper. Warm amber + electric blue. Keep a calm band at the top for a title.'],
  ['ch5', '2:3', 'A whimsical engine-core machine with interchangeable platform MATERIAL blocks plugging into it — a grassy block, a stone block, a riveted metal block, a glowing lava block, a wooden crate with a red target — radiating belts that build little themed platforms; an arcade joystick + a red fire button sit in front. A "factory of levels". Keep a calm area at the top for a title.'],
  ['ch6', '2:3', 'A grand vertical diorama tower of the five cartoon worlds stacked like a cutaway dollhouse — bottom: glowing crystal Carrot Caverns; then a neon Sunset Strip city; sunny Dustbowl Dunes; a fiery Lava Lagoon foundry; top: a stormy Thunder Dome sky-fortress with lightning — the bunny climbing between them. Keep a calm sky at the top for a title.'],
  ['ch7', '2:3', 'A friendly robot autopilot hand guiding the cartoon bunny across floating platforms with translucent cyan trajectory arcs and a measurement grid (the 0-death test); beside it, a little pinned sticky-NOTE turns into a glowing checklist/ticket that gets a green checkmark — the play-test-to-fix loop. Keep a calm area at the top for a title.'],
  ['back', '2:3', 'A serene closing scene at sunset: Jazz the bunny stands triumphant atop the Tin Tyrant\'s toppled sky-fortress, bazooka resting on his shoulder, freed warren bunnies cheering below, the five worlds glowing far beneath a starry sky. Peaceful, warm, victorious.'],
  ['panorama', '16:9', 'A wide seamless side-scrolling parallax panorama of the five cartoon worlds left to right — glowing crystal caverns, neon sunset city, sunny desert dunes, a lava foundry, a stormy sky-fortress — one continuous dreamy bold-outline cartoon landscape, the bunny tiny mid-run across it.'],
  // Calm DARK backdrop for the two-page platform/architecture diagram. Mostly deep
  // navy negative space so overlaid HTML boxes stay legible — NOT a busy scene.
  // noRef:true — a backdrop must NOT be bunny-conditioned (the model sheet would
  // force the hero into frame); generate it free-form so the center stays empty.
  ['stack', '2:3', 'A very DARK, calm engineering BLUEPRINT backdrop: a deep navy-black field with faint glowing cyan grid lines and a subtle sense of horizontal layered strata/tiers stacked and receding into shadow, like a cross-section of a technology stack. Lots of empty dark space, soft vignette, the whole CENTER almost pure dark navy. Minimal, abstract, no characters, no objects — a quiet background for a diagram to sit on top of. NO text.', true],
];

const want = process.argv[2];
for (const [name, aspectRatio, scene, noRef] of (want ? JOBS.filter((j) => j[0] === want) : JOBS)) {
  try {
    // backdrops (noRef) are generated free-form; everything else is conditioned on
    // the locked model sheet so the bunny + cartoon style stay coherent.
    const prompt = noRef ? scene : `${STYLE} ${scene}`;
    const { mimeType, base64 } = await generateImage(prompt, { aspectRatio, refs: noRef ? [] : [ref] });
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    writeFileSync(`book/img/art/${name}.${ext}`, Buffer.from(base64, 'base64'));
    console.log('ok', name, `book/img/art/${name}.${ext}`);
  } catch (e) { console.error('FAIL', name, e.message); }
}
