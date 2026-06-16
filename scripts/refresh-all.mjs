// Master refresh script — run biweekly to update photos, reviews, and pricing.
// Usage: node scripts/refresh-all.mjs
//
// What it does:
//   1. Fetches Google Places photos for all properties (skips cached)
//   2. Fetches Google Places ratings + reviews for all properties
//   3. Re-generates LLM pricing for any new properties (skips cached)
//   4. Commits and pushes changes
//   5. Deploys to Vercel
//
// Prerequisites:
//   - .env.local must have GOOGLE_PLACES_API_KEY and GITHUB_TOKEN
//   - vercel CLI must be installed and logged in
//   - git remote must be set up

import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit", ...opts });
  } catch (e) {
    console.error(`Command failed: ${cmd}`);
    if (!opts.ignoreError) process.exit(1);
  }
}

async function main() {
  const envFile = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
  const googleKey = envFile.match(/GOOGLE_PLACES_API_KEY=(.+)/)?.[1]?.trim();
  const ghToken = envFile.match(/GITHUB_TOKEN=(.+)/)?.[1]?.trim();

  if (!googleKey) { console.error("❌ GOOGLE_PLACES_API_KEY not found in .env.local"); process.exit(1); }
  if (!ghToken) { console.error("❌ GITHUB_TOKEN not found in .env.local"); process.exit(1); }

  console.log("═══════════════════════════════════════════");
  console.log("  CurateIndia Biweekly Refresh");
  console.log("═══════════════════════════════════════════");

  // Step 1: Photos
  console.log("\n📷 Step 1/4: Refreshing property photos...");
  run("node scripts/fetch-google-photos.mjs");

  // Step 2: Reviews
  console.log("\n⭐ Step 2/4: Refreshing ratings & reviews...");
  run("node scripts/fetch-google-reviews.mjs");

  // Step 3: Pricing (only for new properties without pricing)
  console.log("\n💰 Step 3/4: Generating pricing for new properties...");
  run("node scripts/generate-pricing.mjs");

  // Step 4: Commit, push, deploy
  console.log("\n🚀 Step 4/4: Deploying...");
  run("git add -A");
  
  // Check if there are changes to commit
  try {
    execSync("git diff --cached --quiet", { cwd: ROOT });
    console.log("✓ No changes to commit — everything is up to date.");
    return;
  } catch {
    // There are changes
  }

  const date = new Date().toISOString().slice(0, 10);
  run(`git commit -m "chore: biweekly data refresh ${date}"`);
  run("git push");
  run("vercel --prod --yes", { ignoreError: true });

  console.log("\n═══════════════════════════════════════════");
  console.log("  ✅ Refresh complete!");
  console.log("═══════════════════════════════════════════");
}

main().catch((e) => { console.error(e); process.exit(1); });
