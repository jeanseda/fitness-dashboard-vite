import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { Client } from "@notionhq/client";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const notionToken = process.env.NOTION_TOKEN;
const dbMeals = process.env.NOTION_DB_MEALS;
const dbBodyComp = process.env.NOTION_DB_BODYCOMP;
const dbTraining = process.env.NOTION_DB_TRAINING;

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
      return {
        date: propDate(firstExisting(p, ["Date", "Log Date"])),
        weight: propNumber(firstExisting(p, ["Weight", "Weight (lbs)"])),
        bodyFat: propNumber(firstExisting(p, ["Body Fat", "Body Fat %"])),
        muscleMass: propNumber(firstExisting(p, ["Muscle Mass", "Muscle (lbs)"])),
        leanMass: propNumber(firstExisting(p, ["Lean Mass", "Lean (lbs)"])) || null,
        bmi: propNumber(firstExisting(p, ["BMI"])) || null,
        bmr: propNumber(firstExisting(p, ["BMR"])) || null,
        notes: propRichText(firstExisting(p, ["Notes"])) || null,
      };
    });

    const training = trainRes.results.map((r) => {
      const p = r.properties || {};
      return {
        exercise: propTitle(firstExisting(p, ["Exercise", "Name", "Title"])),
        date: propDate(firstExisting(p, ["Date", "Log Date"])),
        weight: propNumber(firstExisting(p, ["Weight", "Weight (lbs)"])),
        sets: propNumber(firstExisting(p, ["Sets"])),
        reps: propRichText(firstExisting(p, ["Reps"])) || propNumber(firstExisting(p, ["Reps"])),
        workoutType: propSelect(firstExisting(p, ["Workout Type", "Type"])),
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
