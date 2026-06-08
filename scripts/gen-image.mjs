#!/usr/bin/env node
// Generate an image with Gemini and save it.
//   node scripts/gen-image.mjs "<prompt>" [outfile.png]
import { writeFileSync } from 'node:fs';
import { generateImage, IMAGE_MODEL } from '../lib/gemini.js';

const prompt = process.argv[2];
const out = process.argv[3] || 'out.png';
if (!prompt) {
  console.error('usage: node scripts/gen-image.mjs "<prompt>" [outfile.png]');
  process.exit(1);
}

const { mimeType, base64 } = await generateImage(prompt, { model: IMAGE_MODEL });
writeFileSync(out, Buffer.from(base64, 'base64'));
console.log(`wrote ${out} (${mimeType})`);
