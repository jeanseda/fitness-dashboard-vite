import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@notionhq/client";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

const TARGETS = { calories: 2800, protein: 170 };
const BULK_START_DATE = "2026-01-07";
const BULK_END_DATE = "2026-03-23";
const BULK_START_WEIGHT = 161;
const BULK_TARGET_WEIGHT = 170;

const notionToken = process.env.NOTION_TOKEN;
const normalizeId = (v) => (v || "").toLowerCase().replace(/[^a-f0-9-]/g, "").trim();
const dbMeals = normalizeId(process.env.NOTION_DB_MEALS);
const dbBodyComp = normalizeId(process.env.NOTION_DB_BODYCOMP);
const dbTraining = normalizeId(process.env.NOTION_DB_TRAINING);

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

function safeDate(date, fallback = new Date()) {
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function getDailyMacros(meals) {
  const byDate = {};
  for (const m of meals) {
    if (!m.date) continue;
    if (!byDate[m.date]) byDate[m.date] = { date: m.date, calories: 0, protein: 0, meals: [] };
    byDate[m.date].calories += m.calories || 0;
    byDate[m.date].protein += m.protein || 0;
    byDate[m.date].meals.push(m);
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function parseReps(reps) {
  if (typeof reps === "number") return reps;
  const match = String(reps).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function makeFallback() {
  return {
    generatedAt: new Date().toISOString(),
    daily: {
      greeting: "GM! Log breakfast and we’ll build momentum.",
      focus: "Today's priority: hit protein early so dinner isn't a panic.",
      tip: "Add one shake between meals to make protein easier.",
    },
    weekly: {
      summary: "No fresh data yet. Track at least 4 days to unlock real insights.",
      mvp_meal: "No MVP meal yet.",
      concern: "Tracking consistency is too low to detect useful patterns.",
    },
    bodyComp: {
      trend: "Not enough body comp entries yet.",
      projection: "Need at least 2 weigh-ins to project timeline.",
      actionable: "Log weight and body fat 2-3x/week for cleaner trend detection.",
    },
    training: {
      highlight: "No PR signal yet.",
      gap: "Need more sessions logged this week.",
      suggestion: "Start with your main compound lifts and track every set.",
    },
    ropitiQuote: "Small daily wins beat heroic weekends.",
  };
}

async function fetchData() {
  if (!notionToken || !dbMeals || !dbBodyComp || !dbTraining) {
    throw new Error("Missing Notion env vars. Set NOTION_TOKEN, NOTION_DB_MEALS, NOTION_DB_BODYCOMP, NOTION_DB_TRAINING.");
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
      reps: repsText || repsNum || "Unknown",
      workoutType: propSelect(firstExisting(p, ["Workout", "Workout Type", "Type"])),
    };
  });

  return { meals, bodyComp, training };
}

function buildCommentary({ meals, bodyComp, training }) {
  const daily = getDailyMacros(meals);
  const latestDay = daily[daily.length - 1];
  const weekly = daily.slice(-7);
  const weeklyDays = weekly.length || 1;
  const avgCal = Math.round(weekly.reduce((s, d) => s + d.calories, 0) / weeklyDays);
  const avgPro = Math.round(weekly.reduce((s, d) => s + d.protein, 0) / weeklyDays);

  let proteinDrought = 0;
  for (let i = daily.length - 1; i >= 0; i -= 1) {
    if (daily[i].protein < TARGETS.protein) proteinDrought += 1;
    else break;
  }

  const bodySorted = [...bodyComp].sort((a, b) => a.date.localeCompare(b.date));
  const latestBody = bodySorted[bodySorted.length - 1];
  const daysIntoBulk = Math.max(1, Math.round((Date.now() - new Date(`${BULK_START_DATE}T12:00:00`).getTime()) / 86400000));
  const gained = latestBody ? latestBody.weight - BULK_START_WEIGHT : 0;
  const pace = gained / daysIntoBulk;
  const remaining = latestBody ? BULK_TARGET_WEIGHT - latestBody.weight : BULK_TARGET_WEIGHT - BULK_START_WEIGHT;
  const projectedDate = pace > 0 ? new Date(Date.now() + (remaining / pace) * 86400000) : null;
  const pctToGoal = latestBody ? Math.round(((latestBody.weight - BULK_START_WEIGHT) / (BULK_TARGET_WEIGHT - BULK_START_WEIGHT)) * 100) : 0;

  const mvpMeal = weekly
    .flatMap((d) => d.meals.map((m) => ({ ...m, score: (m.protein || 0) - Math.abs((m.calories || 0) - 650) * 0.03 })))
    .sort((a, b) => b.score - a.score)[0];

  const trainingSorted = [...training].sort((a, b) => a.date.localeCompare(b.date));
  const byExercise = {};
  for (const row of trainingSorted) (byExercise[row.exercise] ??= []).push(row);
  let prLine = "No new PR logged this week.";
  for (const [exercise, entries] of Object.entries(byExercise)) {
    if (entries.length < 2) continue;
    const latest = entries[entries.length - 1];
    const priorMax = Math.max(...entries.slice(0, -1).map((e) => e.weight));
    if (latest.weight > priorMax) {
      prLine = `${exercise} hit ${latest.weight} lbs for a new PR.`;
      break;
    }
  }

  const now = new Date();
  const lastLeg = trainingSorted
    .filter((t) => (t.workoutType || "").toLowerCase().includes("leg") || (t.exercise || "").toLowerCase().includes("squat"))
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const legGapDays = lastLeg ? Math.max(0, Math.round((now.getTime() - safeDate(lastLeg.date, now).getTime()) / 86400000)) : 999;
  const weeklyTrainingDays = new Set(trainingSorted.filter((t) => {
    const tDate = safeDate(t.date);
    return (now.getTime() - tDate.getTime()) <= 6 * 86400000;
  }).map((t) => t.date)).size;

  const latest7 = trainingSorted.slice(-7);
  const prev7 = trainingSorted.slice(-14, -7);
  const volume = (rows) => rows.reduce((s, r) => s + (r.weight || 0) * parseReps(r.reps), 0);
  const volNow = volume(latest7);
  const volPrev = volume(prev7);
  const volumeSignal = volPrev > 0 ? Math.round(((volNow - volPrev) / volPrev) * 100) : 0;

  const weeklySummary = `This week: ${avgCal.toLocaleString()} avg cal (need ${TARGETS.calories.toLocaleString()}), ${avgPro}g avg protein (need ${TARGETS.protein}g). Tracking ${weekly.length}/7 days.`;
  const mvpLine = mvpMeal
    ? `${new Date(`${mvpMeal.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })}'s ${mvpMeal.food || "meal"} was your best macro-balanced meal this week.`
    : "No clear MVP meal this week.";

  const latestAndWeekStart = bodySorted.length >= 2
    ? { latest: bodySorted[bodySorted.length - 1], weekStart: bodySorted[Math.max(0, bodySorted.length - 2)] }
    : null;
  const bodyTrend = latestAndWeekStart
    ? (() => {
      const wDelta = Number((latestAndWeekStart.latest.weight - latestAndWeekStart.weekStart.weight).toFixed(1));
      const mDelta = Number((latestAndWeekStart.latest.muscleMass - latestAndWeekStart.weekStart.muscleMass).toFixed(1));
      const ratio = wDelta > 0 ? Math.max(0, Math.round((mDelta / wDelta) * 100)) : 0;
      return `Up ${wDelta} lbs this week. Muscle gained: ~${mDelta} lbs. Ratio: ${ratio}% muscle gain${ratio >= 55 ? " — decent for a bulk." : " — tighten execution."}`;
    })()
    : "Not enough recent body comp data for trend analysis.";

  const projection = projectedDate && latestBody
    ? `At current rate: ${BULK_TARGET_WEIGHT} lbs by ${projectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, BF% at ~${(latestBody.bodyFat + 0.6).toFixed(1)}%.`
    : "Projection pending more weigh-ins.";

  const action = `To improve muscle-to-fat ratio, push protein toward ${(latestBody?.weight ? Math.round(latestBody.weight * 1.1) : 180)}g and keep training at least 4x/week.`;
  const daysToCut = Math.max(0, Math.ceil((new Date(`${BULK_END_DATE}T00:00:00`).getTime() - now.getTime()) / 86400000));

  return {
    generatedAt: new Date().toISOString(),
    daily: {
      greeting: `GM! Your bulk is ${Math.max(0, Math.min(100, pctToGoal))}% done and you're ${latestBody ? Math.round((latestBody.weight / BULK_TARGET_WEIGHT) * 100) : 0}% of target weight.`,
      focus: `Today's priority: hit ${TARGETS.protein}g protein. You've been averaging ${avgPro}g.`,
      tip: latestDay && latestDay.protein < TARGETS.protein
        ? "Add a shake between lunch and dinner. Easy 30g protein without stuffing yourself."
        : "Keep protein spread across 3-4 meals so late-night catch-up isn't required.",
    },
    weekly: {
      summary: weeklySummary,
      mvp_meal: mvpLine,
      concern: proteinDrought >= 4
        ? `Protein has been under target for ${proteinDrought} straight days. Pattern says dinner protein is lagging.`
        : "No major red flags this week, but consistency still has room to improve.",
    },
    bodyComp: {
      trend: bodyTrend,
      projection,
      actionable: action,
    },
    training: {
      highlight: prLine,
      gap: legGapDays >= 10 ? `No leg day logged in ${legGapDays} days. Don’t skip legs.` : `Training frequency is ${weeklyTrainingDays} days this week.`,
      suggestion: volumeSignal < 0
        ? "Volume dipped lately. Add one top set on your key compounds this week."
        : "Try adding a drop set on your last set for 1-2 accessories.",
    },
    ropitiQuote: `You're ${daysToCut} days from the cut. Every calorie is either a vote for abs or fluff.`,
  };
}

async function main() {
  const outPath = path.join(rootDir, "data", "commentary.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  try {
    const data = await fetchData();
    const commentary = buildCommentary(data);
    fs.writeFileSync(outPath, JSON.stringify(commentary, null, 2));
    console.log(`Commentary generated: ${outPath}`);
  } catch (error) {
    const fallback = makeFallback();
    fs.writeFileSync(outPath, JSON.stringify(fallback, null, 2));
    console.error(`Commentary fallback generated due to error: ${error instanceof Error ? error.message : "unknown_error"}`);
    process.exitCode = 1;
  }
}

void main();
