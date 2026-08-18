"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { runCase } = require("./harness");

const ROOT = path.resolve(__dirname, "..");
const FIXTURES = path.join(__dirname, "fixtures");
const DEFAULT_CASES = [
  "12mp.jpg",
  "48mp.jpg",
  "exif1.jpg",
  "exif2.jpg",
  "exif3.jpg",
  "exif4.jpg",
  "exif5.jpg",
  "exif6.jpg",
  "exif7.jpg",
  "exif8.jpg",
  "transparente.png",
  "foto.webp",
  "pesada.jpg",
];
const EXPECTED_TOP_MARKERS = {
  1: ["verde", "vermelho"],
  2: ["vermelho", "verde"],
  3: ["magenta", "azul"],
  4: ["azul", "magenta"],
  5: ["verde", "azul"],
  6: ["azul", "verde"],
  7: ["magenta", "vermelho"],
  8: ["vermelho", "magenta"],
};

function runPythonCompare(preview, download) {
  const result = spawnSync(
    process.env.PYTHON || "python",
    [path.join(__dirname, "compare.py"), preview, download],
    { encoding: "utf8" }
  );
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) {
    throw new Error(`comparação WYSIWYG falhou para ${path.basename(preview)}`);
  }
}

function runPythonCorners(imagePath) {
  const result = spawnSync(
    process.env.PYTHON || "python",
    [path.join(__dirname, "compare.py"), "--corners", imagePath],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`leitura de marcadores falhou para ${path.basename(imagePath)}`);
  }
  return JSON.parse(result.stdout);
}

function assertNoApiRequests(urls, caseName) {
  const apiRequests = urls.filter((requestUrl) => {
    try {
      return new URL(requestUrl).pathname.startsWith("/api/");
    } catch {
      return false;
    }
  });
  if (apiRequests.length) {
    throw new Error(`${caseName}: requests proibidos: ${apiRequests.join(", ")}`);
  }
}

function assertExifMarkers(caseName, imagePath) {
  const match = /^exif([1-8])\.jpg$/.exec(caseName);
  if (!match) return;
  const markers = runPythonCorners(imagePath).markers;
  const found = Object.entries(markers)
    .filter(([, marker]) => marker.found)
    .map(([name, marker]) => ({ name, x: marker.x, y: marker.y }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (found.length < 2) {
    throw new Error(`${caseName}: menos de dois marcadores encontrados`);
  }
  const topY = Math.min(...found.map((marker) => marker.y));
  const top = found
    .filter((marker) => marker.y <= topY + 120)
    .sort((a, b) => a.x - b.x);
  const expected = EXPECTED_TOP_MARKERS[Number(match[1])];
  if (top.length < 2 || top.slice(0, 2).map((marker) => marker.name).join(",") !== expected.join(",")) {
    throw new Error(`${caseName}: marcadores no topo não indicam orientação esperada`);
  }
}

async function main() {
  const [url = "http://127.0.0.1:8000/", outDirArg = "tests/.tmp-matrix", timeoutArg] = process.argv.slice(2);
  const outDir = path.resolve(ROOT, outDirArg);
  const timeoutMs = timeoutArg ? Number(timeoutArg) : 120_000;
  const cases = process.env.CASES ? process.env.CASES.split(",") : DEFAULT_CASES;
  fs.mkdirSync(outDir, { recursive: true });

  for (const caseName of cases) {
    const photoPath = path.join(FIXTURES, caseName);
    const caseDir = path.join(outDir, path.basename(caseName, path.extname(caseName)));
    fs.mkdirSync(caseDir, { recursive: true });
    process.stdout.write(`\n> ${caseName}\n`);

    const result = await runCase({
      url,
      photoPath,
      viewport: { width: 1280, height: 1024, deviceScaleFactor: 1 },
      timeoutMs,
    });
    assertNoApiRequests(result.networkRequests, caseName);

    const previewPath = path.join(caseDir, "preview.png");
    const downloadPath = path.join(caseDir, "download.png");
    fs.writeFileSync(previewPath, result.previewPng);
    fs.writeFileSync(downloadPath, result.downloadPng);
    runPythonCompare(previewPath, downloadPath);
    assertExifMarkers(caseName, previewPath);
  }

  process.stdout.write("\n> corrida de exportação com zoom\n");
  const race = await runCase({
    url,
    photoPath: path.join(FIXTURES, "12mp.jpg"),
    viewport: { width: 1280, height: 1024, deviceScaleFactor: 1 },
    timeoutMs,
    raceDuringExport: true,
  });
  if (!race.raceState || race.raceState.resultHidden !== true || race.raceState.resultImageSrc) {
    throw new Error("corrida de exportação: resultCard exibiu blob obsoleto após mudança de zoom");
  }
  if (race.raceState.zoomValue !== "150") {
    throw new Error("corrida de exportação: mudança de zoom não foi aplicada");
  }

  console.log(`\nOK: ${cases.length} casos, corrida de zoom, WYSIWYG e rede verificados`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
