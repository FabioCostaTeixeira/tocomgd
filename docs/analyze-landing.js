const fs = require('fs');
const path = require('path');

const htmlFile = 'C:\\Users\\2P CONNECT\\Downloads\\avatar_landing_page_melhorada.html';
const html = fs.readFileSync(htmlFile, 'utf-8');

// Parse parts
const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
const headMatch = html.match(/<head>([\s\S]*?)<\/head>/);
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);

if (!bodyMatch || !headMatch || !styleMatch) {
  console.error('Could not parse HTML structure');
  process.exit(1);
}

const body = bodyMatch[1];
const head = headMatch[1];
const style = styleMatch[1];

console.log('=== HTML Structure Analysis ===\n');
console.log(`Head size: ${head.length} bytes`);
console.log(`Style size: ${style.length} bytes`);
console.log(`Body size: ${body.length} bytes`);
console.log(`Total: ${html.length} bytes\n`);

// Find elements
const canvasCount = (body.match(/<canvas/g) || []).length;
const imgCount = (body.match(/<img/g) || []).length;
const scriptCount = (body.match(/<script/g) || []).length;
const dataUriCount = (body.match(/data:[^"'\\s;]+;base64/g) || []).length;

console.log('=== Content Breakdown ===');
console.log(`Canvas elements: ${canvasCount}`);
console.log(`IMG elements: ${imgCount}`);
console.log(`Script blocks: ${scriptCount}`);
console.log(`Data URIs (base64): ${dataUriCount}\n`);

// Find largest data URIs
const dataUriMatches = body.match(/data:[^"']+;base64,[A-Za-z0-9+/=]{100,}/g) || [];
console.log(`Large data URIs (>100 chars): ${dataUriMatches.length}`);
if (dataUriMatches.length > 0) {
  dataUriMatches.slice(0, 3).forEach((uri, i) => {
    console.log(`  ${i+1}. ${uri.substring(0, 80)}... (${uri.length} bytes)`);
  });
}

// Find script content types
const scripts = body.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
console.log(`\nScript blocks found: ${scripts.length}`);
scripts.forEach((script, i) => {
  const content = script.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
  const length = content.length;
  const type = script.includes('type="module"') ? 'module' : 'global';
  console.log(`  ${i+1}. [${type}] ${length} bytes`);
});

// Check for video or audio
const hasVideo = /video|\.mp4|\.webm/.test(body);
const hasAudio = /audio|\.mp3|\.wav/.test(body);
console.log(`\nHas video: ${hasVideo}`);
console.log(`Has audio: ${hasAudio}`);

// Extract sections from HTML
const sections = body.match(/<(header|nav|main|section|aside|footer)[^>]*>/g) || [];
console.log(`\nMajor sections: ${sections.length}`);
sections.forEach(s => console.log(`  - ${s.substring(0, 50)}`));
