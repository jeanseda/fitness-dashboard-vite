import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Client } from "@notionhq/client";

dotenv.config({ path: ".env" });

const REQUIRED = [
  "NOTION_TOKEN",
  "NOTION_DB_BODYCOMP",
  "WITHINGS_CLIENT_ID",
  "WITHINGS_CLIENT_SECRET",
  "WITHINGS_REFRESH_TOKEN",
];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`Missing env var: ${key}`);
    process.exit(1);
  }
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const tokenStatePath = path.join(process.cwd(), "data", "withings-token.json");

function toLbs(kg) {
  return Number((kg * 2.2046226218).toFixed(1));
}

function toPercent(decimalOrPercent) {
  const n = Number(decimalOrPercent || 0);
  if (n <= 1) return Number((n * 100).toFixed(1));
  return Number(n.toFixed(1));
}

function getMeasureValue(measures, type) {
  const m = measures.find((x) => x.type === type);
  if (!m) return null;
  return m.value * Math.pow(10, m.unit);
}

async function refreshWithingsToken() {
  const form = new URLSearchParams({
    action: "requesttoken",
    grant_type: "refresh_token",
    client_id: process.env.WITHINGS_CLIENT_ID,
    client_secret: process.env.WITHINGS_CLIENT_SECRET,
    refresh_token: process.env.WITHINGS_REFRESH_TOKEN,
  });

  const res = await fetch("https://wbsapi.withings.net/v2/oauth2", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  const json = await res.json();
  if (json.status !== 0) {
    throw new Error(`Withings token refresh failed: ${JSON.stringify(json)}`);
  }

  const body = json.body;
  fs.mkdirSync(path.dirname(tokenStatePath), { recursive: true });
  fs.writeFileSync(
    tokenStatePath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        access_token: body.access_token,
        refresh_token: body.refresh_token,
        expires_in: body.expires_in,
      },
      null,
      2,
    ),
  );

  return body;
}

async function fetchLatestWithingsMeasure(accessToken) {
  const now = Math.floor(Date.now() / 1000);
  const lastMonth = now - 60 * 60 * 24 * 35;
  const url = `https://wbsapi.withings.net/measure?action=getmeas&category=1&lastupdate=${lastMonth}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const json = await res.json();
  if (json.status !== 0) {
    throw new Error(`Withings getmeas failed: ${JSON.stringify(json)}`);
  }

  const groups = json.body?.measuregrps || [];
  if (!groups.length) return null;

  groups.sort((a, b) => (b.date || 0) - (a.date || 0));
  return groups[0];
}

function mapGroupToBodyComp(group) {
  const measures = group.measures || [];

  const weightKg = getMeasureValue(measures, 1); // weight
  const fatRatio = getMeasureValue(measures, 8); // fat ratio
  const muscleKg = getMeasureValue(measures, 76); // muscle mass
  const leanKg = getMeasureValue(measures, 6); // fat free mass
  const bmr = getMeasureValue(measures, 11); // basal metabolic rate

  const date = new Date((group.date || 0) * 1000).toISOString().slice(0, 10);

  return {
    date,
    weight: weightKg ? toLbs(weightKg) : null,
    bodyFat: fatRatio != null ? toPercent(fatRatio) : null,
    muscleMass: muscleKg ? toLbs(muscleKg) : null,
    leanMass: leanKg ? toLbs(leanKg) : null,
    bmr: bmr != null ? Number(Math.round(bmr)) : null,
  };
}

async function upsertNotionBodyComp(entry) {
  const dsId = process.env.NOTION_DB_BODYCOMP;

  const existing = await notion.dataSources.query({
    data_source_id: dsId,
    filter: {
      property: "Date",
      date: { equals: entry.date },
    },
    page_size: 1,
  });

  const properties = {
    Date: { date: { start: entry.date } },
    "Weight (lbs)": { number: entry.weight ?? undefined },
    "Body Fat %": { number: entry.bodyFat != null ? Number((entry.bodyFat / 100).toFixed(4)) : undefined },
    "Muscle Mass (lbs)": { number: entry.muscleMass ?? undefined },
    "Lean Mass (lbs)": { number: entry.leanMass ?? undefined },
    "BMR (kcal)": { number: entry.bmr ?? undefined },
    Notes: {
      rich_text: [
        {
          type: "text",
          text: { content: `Synced from Withings on ${new Date().toLocaleString()}` },
        },
      ],
    },
  };

  if (existing.results?.length) {
    await notion.pages.update({
      page_id: existing.results[0].id,
      properties,
    });
    return { mode: "update", pageId: existing.results[0].id };
  }

  await notion.pages.create({
    parent: { data_source_id: dsId },
    properties: {
      ...properties,
      "Date Entry": { title: [{ text: { content: new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) } }] },
    },
  });

  return { mode: "create" };
}

async function main() {
  const token = await refreshWithingsToken();
  const latest = await fetchLatestWithingsMeasure(token.access_token);

  if (!latest) {
    console.log("No Withings body comp measurements found.");
    return;
  }

  const mapped = mapGroupToBodyComp(latest);
  const upsert = await upsertNotionBodyComp(mapped);

  console.log(
    JSON.stringify(
      {
        ok: true,
        mapped,
        upsert,
        tokenStatePath,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
