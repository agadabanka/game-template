#!/usr/bin/env node
// Analyze an image with Gemini vision.
//   node scripts/analyze-image.mjs <image-file> ["<question>"]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { analyzeImage } from '../lib/gemini.js';

const file = process.argv[2];
const prompt = process.argv[3] || 'Describe this image in detail.';
if (!file) {
  console.error('usage: node scripts/analyze-image.mjs <image-file> ["<question>"]');
  process.exit(1);
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const ext = path.extname(file).toLowerCase();
const base64 = readFileSync(file).toString('base64');

const text = await analyzeImage({ base64, mimeType: MIME[ext] || 'image/png', prompt });
console.log(text);
