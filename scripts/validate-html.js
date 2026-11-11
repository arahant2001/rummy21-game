// Validates that JavaScript blocks inside HTML files contain no syntax errors
import fs from 'node:fs';
import vm from 'node:vm';

const htmlPath = 'public/index.html';
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];

for (let i = 0; i < scriptMatches.length; i++) {
  const code = scriptMatches[i][1];
  const startLine = html.substring(0, scriptMatches[i].index).split('\n').length;
  try {
    new vm.Script(code, { lineOffset: startLine, filename: htmlPath });
  } catch (err) {
    console.error(`Syntax error in ${htmlPath} script ${i}:`, err.message);
    console.error(err.stack);
    process.exit(1);
  }
}
console.log('HTML scripts validated successfully.');
