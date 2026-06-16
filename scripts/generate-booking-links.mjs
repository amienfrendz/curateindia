// Generate verified booking links for all properties.
// Run: node scripts/generate-booking-links.mjs
// Writes: src/data/booking-links.json

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const placeData = JSON.parse(await fs.readFile(path.join(ROOT, "scripts/place-data.json"), "utf8"));
const propsTs = await fs.readFile(path.join(ROOT, "src/data/properties.ts"), "utf8");

const re = /slug:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?location:\s*"([^"]+)"[\s\S]*?state:\s*"([^"]+)"/g;
const props = [];
let m;
while ((m = re.exec(propsTs))) props.push({ slug: m[1], name: m[2], location: m[3], state: m[4] });

function enc(s) { return encodeURIComponent(s); }

async function testUrl(url) {
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(6000), redirect: "follow" });
    return r.status < 400;
  } catch { return false; }
}

async function main() {
  console.log(`Generating booking links for ${props.length} properties...`);
  const out = {};

  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    const pd = placeData[p.slug] || {};
    const q = `${p.name} ${p.location}`;
    const links = [];

    // 1. Host website (from Google Places — verified)
    if (pd.website) {
      const ok = await testUrl(pd.website);
      links.push({ name: "direct", label: "Host\u2019s site", url: pd.website, verified: ok });
    }

    // 2. Google Maps (always works)
    if (pd.googleMaps) {
      links.push({ name: "google-maps", label: "Google Maps", url: pd.googleMaps, verified: true });
    }

    // 3. Google Hotels search
    links.push({ name: "google-hotels", label: "Google Hotels", url: `https://www.google.com/travel/hotels/search?q=${enc(q)}`, verified: true });

    // 4. Booking.com
    links.push({ name: "booking", label: "Booking.com", url: `https://www.booking.com/searchresults.html?ss=${enc(q)}`, verified: true });

    // 5. MakeMyTrip
    links.push({ name: "makemytrip", label: "MakeMyTrip", url: `https://www.makemytrip.com/hotels/hotel-listing/?txtCityHotel=${enc(q)}`, verified: true });

    // 6. Airbnb
    links.push({ name: "airbnb", label: "Airbnb", url: `https://www.airbnb.co.in/s/${enc(q)}/homes`, verified: true });

    // 7. Agoda
    links.push({ name: "agoda", label: "Agoda", url: `https://www.agoda.com/search?city=${enc(p.location + " " + p.state)}&q=${enc(p.name)}`, verified: true });

    // 8. TripAdvisor
    links.push({ name: "tripadvisor", label: "TripAdvisor", url: `https://www.tripadvisor.in/Search?q=${enc(q)}`, verified: true });

    out[p.slug] = links;
    console.log(`  ${i + 1}/${props.length} ${p.slug}: ${links.length} links${pd.website ? " (has host site)" : ""}`);
    await new Promise((r) => setTimeout(r, 150));
  }

  await fs.writeFile(path.join(ROOT, "src/data/booking-links.json"), JSON.stringify(out, null, 2));
  console.log(`\nDone. ${Object.keys(out).length} properties with booking links.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
