import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { Client } from "@notionhq/client";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const notionToken = process.env.NOTION_TOKEN;
const normalizeId = (v) => (v || "").toLowerCase().replace(/[^a-f0-9-]/g, "").trim();
const dbMeals = normalizeId(process.env.NOTION_DB_MEALS);
const dbBodyComp = normalizeId(process.env.NOTION_DB_BODYCOMP);
const dbTraining = normalizeId(process.env.NOTION_DB_TRAINING);

const looksDbs = {
  daily: "fc92cf89-d93f-48e8-bb23-217e6d001716",
  fitness: "c1f09f44-3490-418d-9da3-8177895062ec",
  products: "de7c9cbc-0706-4400-8402-c9c873904e70",
  goals: "0d5d9ab6-8907-40a5-becd-965bbf6bd13a",
};

function textArrayToString(value) {
  if (!Array.isArray(value)) return "";
  return value.map((v) => v.plain_text || "").join("").trim();
}

function propTitle(prop) { return textArrayToString(prop?.title); }
function propRichText(prop) { return textArrayToString(prop?.rich_text); }
function propNumber(prop) { return typeof prop?.number === "number" ? prop.number : 0; }
function propDate(prop) { return prop?.date?.start || ""; }
function propSelect(prop) { return prop?.select?.name || ""; }
function firstExisting(props, keys) { for (const k of keys) if (props[k] !== undefined) return props[k]; }

app.get("/api/dashboard", async (_req, res) => {
  try {
    if (!notionToken || !dbMeals || !dbBodyComp || !dbTraining) {
      return res.status(400).json({
        meals: [], bodyComp: [], training: [], updatedAt: new Date().toISOString(),
        error: "Missing Notion env vars. Set NOTION_TOKEN, NOTION_DB_MEALS, NOTION_DB_BODYCOMP, NOTION_DB_TRAINING in .env"
      });
    }

    const notion = new Client({ auth: notionToken });
    const [mealsRes, bodyRes, trainRes] = await Promise.all([
      notion.dataSources.query({ data_source_id: dbMeals, page_size: 100 }),
      notion.dataSources.query({ data_source_id: dbBodyComp, page_size: 100 }),
      notion.dataSources.query({ data_source_id: dbTraining, page_size: 100 }),
    ]);

    const meals = mealsRes.results.map((r) => {
      const p = r.properties || {};
      return {
        food: propTitle(firstExisting(p, ["Food", "Name", "Meal", "Title"])),
        date: propDate(firstExisting(p, ["Date", "Log Date"])),
        meal: propSelect(firstExisting(p, ["Meal", "Meal Type"])),
        calories: propNumber(firstExisting(p, ["Calories", "kcal"])),
        protein: propNumber(firstExisting(p, ["Protein", "Protein (g)"])),
        carbs: propNumber(firstExisting(p, ["Carbs", "Carbs (g)"])) || null,
        fat: propNumber(firstExisting(p, ["Fat", "Fat (g)"])) || null,
        source: propSelect(firstExisting(p, ["Source", "Type"])) || "Other",
      };
    });

    const bodyComp = bodyRes.results.map((r) => {
      const p = r.properties || {};
      const rawBodyFat = propNumber(firstExisting(p, ["Body Fat", "Body Fat %"]));
      const bodyFat = rawBodyFat > 0 && rawBodyFat <= 1 ? Number((rawBodyFat * 100).toFixed(1)) : rawBodyFat;
      return {
        date: propDate(firstExisting(p, ["Date", "Log Date"])),
        weight: propNumber(firstExisting(p, ["Weight", "Weight (lbs)"])),
        bodyFat,
        muscleMass: propNumber(firstExisting(p, ["Muscle Mass (lbs)", "Muscle Mass", "Muscle (lbs)"])),
        leanMass: propNumber(firstExisting(p, ["Lean Mass (lbs)", "Lean Mass", "Lean (lbs)"])) || null,
        bmi: propNumber(firstExisting(p, ["BMI"])) || null,
        bmr: propNumber(firstExisting(p, ["BMR", "BMR (kcal)"])) || null,
        notes: propRichText(firstExisting(p, ["Notes"])) || null,
      };
    });

    const training = trainRes.results.map((r) => {
      const p = r.properties || {};
      const repsText = propRichText(firstExisting(p, ["Actual Reps", "Target Reps", "Reps"]));
      const repsNum = propNumber(firstExisting(p, ["Actual Reps", "Reps"]));
      return {
        exercise: propSelect(firstExisting(p, ["Exercise"])) || propTitle(firstExisting(p, ["Name", "Title"])),
        date: propDate(firstExisting(p, ["Date", "Log Date"])),
        weight: propNumber(firstExisting(p, ["Weight (lbs)", "Weight"])),
        sets: propNumber(firstExisting(p, ["Sets"])),
        reps: repsText || repsNum || "Unknown",
        workoutType: propSelect(firstExisting(p, ["Workout", "Workout Type", "Type"])),
        notes: propRichText(firstExisting(p, ["Notes"])) || null,
      };
    });

    return res.json({ meals, bodyComp, training, updatedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({
      meals: [], bodyComp: [], training: [], updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown server error"
    });
  }
});

app.get("/api/portfolio", (_req, res) => {
  const fallback = {
    updatedAt: new Date().toISOString(),
    totalValue: 9575.04,
    dailyPnl: 25.22,
    dailyPnlPct: 0.26,
    allocation: [
      { name: "Stocks", value: 78 },
      { name: "Crypto", value: 17 },
      { name: "Cash", value: 5 },
    ],
    performance: [
      { date: "2026-02-11", label: "Feb 11", value: 9480 },
      { date: "2026-02-12", label: "Feb 12", value: 9512 },
      { date: "2026-02-13", label: "Feb 13", value: 9468 },
      { date: "2026-02-14", label: "Feb 14", value: 9525 },
      { date: "2026-02-15", label: "Feb 15", value: 9541 },
      { date: "2026-02-16", label: "Feb 16", value: 9549 },
      { date: "2026-02-17", label: "Feb 17", value: 9575 },
    ],
    topPositions: [
      { symbol: "TSLA", value: 6504, changePct: -1.24, assetClass: "Stock" },
      { symbol: "PLTR", value: 5298, changePct: 1.51, assetClass: "Stock" },
      { symbol: "BTC", value: 2166, changePct: -1.17, assetClass: "Crypto" },
      { symbol: "DOGE", value: 721, changePct: 0.88, assetClass: "Crypto" },
    ],
  };

  const filePath = process.env.PORTFOLIO_JSON_PATH || path.join(__dirname, "data", "portfolio.json");
  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return res.json(parsed);
    } catch {
      return res.json(fallback);
    }
  }

  return res.json(fallback);
});

app.get("/api/looksmaxx", async (_req, res) => {
  const fallback = {
    updatedAt: new Date().toISOString(),
    dailyCount: 0,
    fitnessCount: 0,
    productsCount: 0,
    goalsCount: 0,
    latestDaily: [],
    latestGoals: [],
  };

  if (!notionToken) return res.json(fallback);

  try {
    const notion = new Client({ auth: notionToken });
    const [dailyRes, fitnessRes, productsRes, goalsRes] = await Promise.all([
      notion.dataSources.query({ data_source_id: looksDbs.daily, page_size: 10 }),
      notion.dataSources.query({ data_source_id: looksDbs.fitness, page_size: 10 }),
      notion.dataSources.query({ data_source_id: looksDbs.products, page_size: 10 }),
      notion.dataSources.query({ data_source_id: looksDbs.goals, page_size: 10 }),
    ]);

    const mapTitle = (props) => propTitle(firstExisting(props || {}, ["Name", "Title", "Goal", "Entry", "Task"])) || "Untitled";
    const mapDate = (props) => propDate(firstExisting(props || {}, ["Date", "Created", "When", "Log Date"])) || "";
    const mapStatus = (props) => {
      const p = firstExisting(props || {}, ["Status", "State", "Progress"]);
      return propSelect(p) || propRichText(p) || "";
    };

    return res.json({
      updatedAt: new Date().toISOString(),
      dailyCount: dailyRes.results.length,
      fitnessCount: fitnessRes.results.length,
      productsCount: productsRes.results.length,
      goalsCount: goalsRes.results.length,
      latestDaily: dailyRes.results.slice(0, 5).map((r) => ({ title: mapTitle(r.properties), date: mapDate(r.properties) })),
      latestGoals: goalsRes.results.slice(0, 5).map((r) => ({ title: mapTitle(r.properties), status: mapStatus(r.properties) })),
    });
  } catch (error) {
    return res.json({ ...fallback, error: error instanceof Error ? error.message : "looksmaxx_error" });
  }
});

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "dist");
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

const PORT = process.env.PORT || process.env.API_PORT || 8787;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
