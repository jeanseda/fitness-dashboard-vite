import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Chip } from "@heroui/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

/* ── Types ──────────────────────────────────────────────────── */
type Meal        = { food: string; date: string; meal: string; calories: number; protein: number; source?: string };
type BodyComp    = { date: string; weight: number; bodyFat: number; muscleMass: number };
type TrainingEntry = { exercise: string; date: string; weight: number; reps: string | number; workoutType?: string };
type DashboardPayload = { meals: Meal[]; bodyComp: BodyComp[]; training: TrainingEntry[]; updatedAt: string };
type Insight = { text: string; type: "info" | "warning" | "success" | "alert" };
type DailyCommentary = { greeting: string; focus: string; tip: string };
type WeeklyCommentary = { summary: string; mvp_meal: string; concern: string };
type BodyCompCommentary = { trend: string; projection: string; actionable: string };
type TrainingCommentary = { highlight: string; gap: string; suggestion: string };
type CommentaryPayload = {
  generatedAt: string;
  daily: DailyCommentary;
  weekly: WeeklyCommentary;
  bodyComp: BodyCompCommentary;
  training: TrainingCommentary;
  ropitiQuote: string;
};
type DailyMacro = { date: string; calories: number; protein: number };
type RoadmapPayload = {
  updatedAt: string;
  items: { milestone: string; phase?: string; date?: string; type?: string; notes?: string; targetWeight?: number; targetBodyFat?: number; targetMuscle?: number }[];
  byPhase: { name: string; value: number }[];
  nextMilestones: { milestone: string; date?: string; phase?: string }[];
};
type LooksPayload = {
  updatedAt: string;
  dailyCount: number;
  fitnessCount: number;
  productsCount: number;
  goalsCount: number;
  latestDaily: { title: string; date?: string }[];
  latestGoals: { title: string; status?: string }[];
};

/* ── Constants ──────────────────────────────────────────────── */
const TARGETS = { calories: 2800, protein: 170, caloriesMin: 2700, proteinMin: 160, bodyFatGoal: 20 };
const BULK_START_DATE = "2026-01-07";
const BULK_END_DATE = "2026-03-23";
const BULK_START_WEIGHT = 161;
const BULK_TARGET_WEIGHT = 170;
const TABS    = ["Nutrition", "Body Comp", "Training", "Roadmap", "Looksmaxx"] as const;

const MEAL_ORDER: Record<string, number> = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3, Shake: 4 };
const MEAL_EMOJI: Record<string, string>  = { Breakfast: "🌅", Lunch: "🌞", Dinner: "🌙", Snack: "🍫", Shake: "🥤" };

const SRC_CLR: Record<string, "success" | "danger" | "primary" | "secondary" | "default"> = {
  "Ideal Nutrition": "success",
  Restaurant: "danger",
  Homemade: "primary",
  Supplement: "secondary",
  Other: "default",
};

const NAV_ITEMS = [
  { key: "Nutrition"  as const, icon: "🍽️", label: "Nutrition"  },
  { key: "Body Comp"  as const, icon: "📊", label: "Body Comp"  },
  { key: "Training"   as const, icon: "🏋️", label: "Training"   },
  { key: "Roadmap"    as const, icon: "🗺️", label: "Roadmap"    },
  { key: "Looksmaxx"  as const, icon: "✨", label: "Looksmaxx"  },
];

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "Nutrition":  { title: "Nutrition",          subtitle: "Daily intake & macro tracking"     },
  "Body Comp":  { title: "Body Composition",   subtitle: "Weight, fat & muscle trends"       },
  "Training":   { title: "Training",           subtitle: "Workout progression & history"     },
  "Roadmap":    { title: "Roadmap",            subtitle: "Milestones & phase planning"       },
  "Looksmaxx":  { title: "Looksmaxx",          subtitle: "Daily logs, products & goals"      },
};

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

/* ── Animation presets ──────────────────────────────────────── */
const fadeIn = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0,  transition: { duration: .36, ease: [.4, 0, .2, 1] as const } },
};

/* ═══════════════════════════════════════════════════════════════
   UTILITY COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

/* Animated counter */
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 700;
    const start    = performance.now();
    let frame      = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display}{suffix}</>;
}

/* SVG radial progress ring */
function RadialRing({
  value, max, color, size = 88, centerLabel, sublabel,
}: { value: number; max: number; color: string; size?: number; centerLabel: string; sublabel: string }) {
  const r     = (size - 14) / 2;
  const circ  = 2 * Math.PI * r;
  const pct   = Math.min(value / Math.max(max, 1), 1);
  const offset = circ * (1 - pct);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {/* track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(63,63,70,.35)"
          strokeWidth={8}
        />
        {/* fill */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: "stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)",
            filter: `drop-shadow(0 0 7px ${color})`,
          }}
        />
        {/* center label */}
        <text
          x={size / 2} y={size / 2 - 3}
          textAnchor="middle"
          fill={color}
          fontSize={13}
          fontWeight="700"
          fontFamily="inherit"
        >
          {centerLabel}
        </text>
        <text
          x={size / 2} y={size / 2 + 13}
          textAnchor="middle"
          fill="var(--tx3)"
          fontSize={9.5}
          fontFamily="inherit"
        >
          {sublabel}
        </text>
      </svg>
    </div>
  );
}

/* Skeleton primitives */
function SkLine({ w, h, mb = 0 }: { w: string | number; h: number; mb?: number }) {
  return <span className="sk" style={{ width: w, height: h, marginBottom: mb, display: "block" }} />;
}

function SkKpiCard() {
  return (
    <div className="sk-kpi">
      <SkLine w="52%" h={10} mb={9} />
      <SkLine w="58%" h={26} mb={7} />
      <SkLine w="68%" h={10} />
    </div>
  );
}

function SkPanel({ rows = 4 }: { rows?: number }) {
  return (
    <div className="sk-panel">
      <SkLine w="38%" h={13} mb={18} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid rgba(63,63,70,.2)" }}>
          <SkLine w={`${65 + (i % 3) * 12}%`} h={12} mb={6} />
          <SkLine w="42%" h={10} />
        </div>
      ))}
    </div>
  );
}

/* Glassy recharts tooltip */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function GlassTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label && <div className="chart-tip-label">{label}</div>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <div key={i} className="chart-tip-row" style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

/* Stagger-animated card wrapper */
function Card({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={`glass-panel ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: .38, delay, ease: [.4, 0, .2, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* Panel title bar */
function PanelTitle({ children, accentColor = "var(--indigo)" }: { children: React.ReactNode; accentColor?: string }) {
  return (
    <div className="panel-title">
      <span className="panel-dot" style={{ background: accentColor, boxShadow: `0 0 7px ${accentColor}` }} />
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COACH COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function getCalStatus(cal: number): { icon: string; color: string } {
  const pct = cal / TARGETS.calories;
  if (pct >= 0.9 && pct <= 1.1) return { icon: "🟢", color: "var(--emerald)" };
  if (pct >= 0.8) return { icon: "🟡", color: "var(--amber)" };
  return { icon: "🔴", color: "var(--rose)" };
}

function getProStatus(pro: number): { icon: string; color: string } {
  const pct = pro / TARGETS.protein;
  if (pct >= 0.9) return { icon: "🟢", color: "var(--emerald)" };
  if (pct >= 0.8) return { icon: "🟡", color: "var(--amber)" };
  return { icon: "🔴", color: "var(--rose)" };
}

function getDayGrade(cal: number, pro: number): string {
  const calPct = cal / TARGETS.calories;
  const proPct = pro / TARGETS.protein;
  const avg = (Math.min(calPct, 1.1) + Math.min(proPct, 1.1)) / 2;
  if (avg >= 0.95) return "A";
  if (avg >= 0.88) return "B+";
  if (avg >= 0.80) return "B";
  if (avg >= 0.70) return "C+";
  if (avg >= 0.60) return "C";
  if (avg >= 0.50) return "D";
  return "F";
}

/* Daily Score Card */
function DailyScoreCard({ cal, pro, trained }: { cal: number; pro: number; trained: boolean }) {
  const grade = getDayGrade(cal, pro);
  const calS = getCalStatus(cal);
  const proS = getProStatus(pro);

  return (
    <motion.div
      className="score-card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: .35 }}
    >
      <div className="score-grade">{grade}</div>
      <div className="score-details">
        <span className="score-headline">{grade.startsWith("A") ? "Great" : grade.startsWith("B") ? "Solid" : grade.startsWith("C") ? "Okay" : "Needs Work"} Day</span>
        <div className="score-metrics">
          <span>{calS.icon} Calories {cal.toLocaleString()}/{TARGETS.calories.toLocaleString()}</span>
          <span className="score-sep">|</span>
          <span>{proS.icon} Protein {pro}g/{TARGETS.protein}g</span>
          <span className="score-sep">|</span>
          <span>Training {trained ? "✅" : "⬜"}</span>
        </div>
      </div>
    </motion.div>
  );
}

function getDailyMacros(meals: Meal[]): DailyMacro[] {
  const byDate: Record<string, DailyMacro> = {};
  meals.forEach((m) => {
    if (!m.date) return;
    if (!byDate[m.date]) byDate[m.date] = { date: m.date, calories: 0, protein: 0 };
    byDate[m.date].calories += m.calories || 0;
    byDate[m.date].protein += m.protein || 0;
  });
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function daySeed() {
  const now = new Date();
  return Number(`${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`);
}

function rotateInsights(insights: Insight[], count = 3): Insight[] {
  if (!insights.length) return [];
  const shift = daySeed() % insights.length;
  const rotated = [...insights.slice(shift), ...insights.slice(0, shift)];
  return rotated.slice(0, count);
}

function generateNutritionInsights(meals: Meal[], bodyComp: BodyComp[]): Insight[] {
  const daily = getDailyMacros(meals);
  if (!daily.length) return [{ text: "No meals logged yet. Your macros can’t improve if they don’t exist, chief.", type: "info" }];
  const latest = daily[daily.length - 1];
  const grade = getDayGrade(latest.calories, latest.protein);
  const gradeLine: Record<string, string> = {
    A: "Chef's kiss day. Macro execution looked expensive.",
    "B+": "Strong day. A tiny protein bump and this is elite.",
    B: "Good base. Tighten one meal and this becomes clean.",
    "C+": "Mid day. Decent effort, weak finish.",
    C: "Survived, not thrived. Protein is asking for help.",
    D: "Rough day. We’re one snack away from a comeback.",
    F: "Did you even eat today?"
  };

  let proteinDrought = 0;
  for (let i = daily.length - 1; i >= 0; i -= 1) {
    if (daily[i].protein < TARGETS.protein) proteinDrought += 1;
    else break;
  }

  let proteinStreak = 0;
  for (let i = daily.length - 1; i >= 0; i -= 1) {
    if (daily[i].protein >= TARGETS.protein) proteinStreak += 1;
    else break;
  }

  const totalMeals = meals.length || 1;
  const lateCal = meals
    .filter((m) => ["Dinner", "Snack", "Shake"].includes(m.meal))
    .reduce((sum, m) => sum + (m.calories || 0), 0);
  const totalCal = meals.reduce((sum, m) => sum + (m.calories || 0), 0) || 1;
  const latePct = Math.round((lateCal / totalCal) * 100);

  const restaurantMeals = meals.filter((m) => (m.source || "").toLowerCase() === "restaurant").length;
  const restaurantPct = Math.round((restaurantMeals / totalMeals) * 100);

  const list: Insight[] = [
    { text: `Daily grade: ${grade}. ${gradeLine[grade] || "Keep stacking better days."}`, type: grade.startsWith("A") || grade.startsWith("B") ? "success" : "warning" },
  ];

  if (proteinDrought >= 3) {
    list.push({ text: `Protein drought: ${proteinDrought} days without hitting target. Your muscles are filing a complaint.`, type: "alert" });
  } else if (proteinStreak >= 2) {
    list.push({ text: `🔥 ${proteinStreak}-day protein target streak. Keep feeding the gains.`, type: "success" });
  }

  if (latePct >= 70) {
    list.push({ text: `${latePct}% of your calories are from later meals. You’re basically a nocturnal eater.`, type: "warning" });
  }

  if (restaurantPct >= 60) {
    list.push({ text: `Restaurant meals are ${restaurantPct}% of your logs. Your wallet and macros are both sweating.`, type: "warning" });
  }

  if (latest.protein < TARGETS.protein) {
    const need = TARGETS.protein - latest.protein;
    list.push({ text: `You’re ${need}g short on protein today. One shake + lean meal closes it.`, type: "info" });
  }

  const bodySorted = [...bodyComp].sort((a, b) => a.date.localeCompare(b.date));
  if (bodySorted.length >= 2) {
    const latestBody = bodySorted[bodySorted.length - 1];
    const prevBody = bodySorted[bodySorted.length - 2];
    const weightDelta = Number((latestBody.weight - prevBody.weight).toFixed(1));
    if (weightDelta <= 0 && proteinDrought >= 2) {
      list.push({ text: `Scale moved ${weightDelta} lbs while protein stayed low. Gains need building blocks, not vibes.`, type: "warning" });
    }
  }

  return list;
}

function generateBodyCompInsights(bodyComp: BodyComp[]): Insight[] {
  const sorted = [...bodyComp].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return [{ text: "Need more body comp entries before I roast your trend line.", type: "info" }];
  const latest = sorted[sorted.length - 1];
  const weekStart = sorted.find((x) => (new Date(latest.date).getTime() - new Date(x.date).getTime()) >= 6 * 86400000) ?? sorted[Math.max(0, sorted.length - 2)];
  const weightDelta = Number((latest.weight - weekStart.weight).toFixed(1));
  const muscleDelta = Number((latest.muscleMass - weekStart.muscleMass).toFixed(1));
  const bfDelta = Number((latest.bodyFat - weekStart.bodyFat).toFixed(1));

  const ratio = weightDelta > 0 ? Math.round((muscleDelta / weightDelta) * 100) : 0;
  const today = new Date();
  const daysPassed = Math.max(1, Math.round((today.getTime() - new Date(BULK_START_DATE).getTime()) / 86400000));
  const gained = latest.weight - BULK_START_WEIGHT;
  const rate = gained / daysPassed;
  const remaining = BULK_TARGET_WEIGHT - latest.weight;
  const projectionDate = rate > 0 ? new Date(today.getTime() + (remaining / rate) * 86400000) : null;

  const list: Insight[] = [];
  if (weightDelta > 0) {
    list.push({
      text: `Weight up ${weightDelta} lbs this week, muscle up ${muscleDelta} lbs. ${Math.max(0, weightDelta - muscleDelta).toFixed(1)} lbs wasn’t lean gain, bro.`,
      type: muscleDelta >= weightDelta * 0.5 ? "info" : "warning",
    });
  } else {
    list.push({ text: `Scale is down ${Math.abs(weightDelta)} lbs this week. Fine for a cut, sus for a bulk.`, type: "warning" });
  }

  if (projectionDate) {
    list.push({
      text: `At this pace, you hit ${BULK_TARGET_WEIGHT} lbs by ${projectionDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`,
      type: "success",
    });
  }

  if (latest.bodyFat > 0 && weekStart.bodyFat > 0) {
    list.push({
      text: `Body fat moved ${weekStart.bodyFat.toFixed(1)}% → ${latest.bodyFat.toFixed(1)}% (${bfDelta >= 0 ? "+" : ""}${bfDelta}). Normal during bulk, just keep eyes on trend.`,
      type: bfDelta > 0.8 ? "warning" : "info",
    });
  }

  if (weightDelta > 0) {
    list.push({
      text: `Muscle-to-weight gain ratio: ${Math.max(0, ratio)}%. ${ratio >= 60 ? "Solid partitioning." : ratio >= 40 ? "Decent, but room to clean up." : "Too much fluff, tighten nutrition."}`,
      type: ratio >= 60 ? "success" : ratio >= 40 ? "info" : "alert",
    });
  }

  return list;
}

function parseRepsToNumber(reps: string | number): number {
  if (typeof reps === "number") return reps;
  const match = String(reps).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function generateTrainingInsights(training: TrainingEntry[]): Insight[] {
  if (!training.length) return [{ text: "No training logs yet. The barbell doesn’t lift itself.", type: "warning" }];
  const sorted = [...training].sort((a, b) => a.date.localeCompare(b.date));
  const byExercise: Record<string, TrainingEntry[]> = {};
  sorted.forEach((t) => { (byExercise[t.exercise] ??= []).push(t); });

  const list: Insight[] = [];
  for (const [exercise, entries] of Object.entries(byExercise)) {
    if (entries.length < 2) continue;
    const latest = entries[entries.length - 1];
    const priorMax = Math.max(...entries.slice(0, -1).map((x) => x.weight));
    if (latest.weight > priorMax) {
      list.push({ text: `New PR! ${exercise} ${latest.weight} lbs. Keep cooking.`, type: "success" });
      break;
    }
  }

  for (const [exercise, entries] of Object.entries(byExercise)) {
    const recent = entries.slice(-3);
    if (recent.length < 3) continue;
    const sameWeight = recent.every((x) => x.weight === recent[0].weight);
    if (sameWeight) {
      list.push({ text: `${exercise} has been parked at ${recent[0].weight} lbs for 3 sessions. Deload or switch rep scheme time.`, type: "warning" });
      break;
    }
  }

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const weeklyDays = new Set(sorted.filter((t) => t.date >= weekAgo).map((t) => t.date)).size;
  if (weeklyDays < 4) {
    list.push({ text: `You trained ${weeklyDays}x this week. Program says 4x. The gym misses you.`, type: weeklyDays <= 1 ? "alert" : "warning" });
  } else {
    list.push({ text: `Training consistency is ${weeklyDays}x this week. That’s momentum.`, type: "success" });
  }

  const latest7 = sorted.slice(-7);
  const prev7 = sorted.slice(-14, -7);
  const vol = (rows: TrainingEntry[]) => rows.reduce((sum, r) => sum + (r.weight || 0) * parseRepsToNumber(r.reps), 0);
  const volNow = vol(latest7);
  const volPrev = vol(prev7);
  if (volPrev > 0) {
    const delta = Math.round(((volNow - volPrev) / volPrev) * 100);
    list.push({ text: `Volume trend: ${delta >= 0 ? "+" : ""}${delta}% vs prior block. ${delta >= 8 ? "Productive overload." : delta <= -8 ? "Volume dropped, watch recovery/training effort." : "Holding steady."}`, type: delta >= 8 ? "success" : delta <= -8 ? "warning" : "info" });
  }

  return list;
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <motion.div
      className={`insight-card insight-${insight.type}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <span className="insight-icon">🦞</span>
      <p>{insight.text}</p>
    </motion.div>
  );
}

function CoachInsights({ insights }: { insights: Insight[] }) {
  const top = rotateInsights(insights, 3);
  return (
    <Card delay={0.04} className="coach-card">
      <div className="panel-body">
        <PanelTitle accentColor="#8b5cf6">Coach Insights</PanelTitle>
        <div className="coach-text">
          {top.map((insight, i) => <InsightCard key={`${insight.type}-${i}`} insight={insight} />)}
        </div>
      </div>
    </Card>
  );
}

/* Bulk Progress Tracker */
function BulkProgress({ bodyComp }: { bodyComp: BodyComp[] }) {
  const sorted = [...bodyComp].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const currentWeight = latest?.weight ?? BULK_START_WEIGHT;
  const totalGain = BULK_TARGET_WEIGHT - BULK_START_WEIGHT;
  const gained = currentWeight - BULK_START_WEIGHT;
  const pct = Math.min(Math.max(gained / totalGain, 0), 1);

  const now = new Date();
  const bulkEnd = new Date(BULK_END_DATE + "T00:00:00");
  const bulkStart = new Date(BULK_START_DATE + "T00:00:00");
  const daysRemaining = Math.max(0, Math.ceil((bulkEnd.getTime() - now.getTime()) / 86400000));
  const totalDays = Math.ceil((bulkEnd.getTime() - bulkStart.getTime()) / 86400000);
  const daysPassed = totalDays - daysRemaining;
  const timePct = daysPassed / totalDays;

  let pace = "On track";
  let paceColor = "var(--emerald)";
  if (pct > timePct + 0.1) { pace = "Ahead of schedule 🚀"; paceColor = "var(--cyan)"; }
  else if (pct < timePct - 0.15) { pace = "Behind — push harder 💪"; paceColor = "var(--amber)"; }

  // Linear regression for projected date
  let projectedDate = BULK_END_DATE;
  if (sorted.length >= 3 && gained > 0) {
    const ratePerDay = gained / Math.max(daysPassed, 1);
    const remaining = BULK_TARGET_WEIGHT - currentWeight;
    const daysNeeded = remaining / ratePerDay;
    const proj = new Date(now.getTime() + daysNeeded * 86400000);
    projectedDate = proj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <Card delay={0.06}>
      <div className="panel-body">
        <PanelTitle accentColor="var(--cyan)">Bulk Progress</PanelTitle>
        <div className="bulk-bar-wrap">
          <div className="bulk-bar-labels">
            <span>{BULK_START_WEIGHT} lbs</span>
            <span style={{ color: "var(--tx1)", fontWeight: 700 }}>{currentWeight} lbs</span>
            <span>{BULK_TARGET_WEIGHT} lbs</span>
          </div>
          <div className="bulk-bar-track">
            <div className="bulk-bar-fill" style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="bulk-meta">
            <span>{Math.round(pct * 100)}% complete</span>
            <span>{daysRemaining} days left</span>
            <span style={{ color: paceColor }}>{pace}</span>
          </div>
          {sorted.length >= 3 && (
            <div className="bulk-projected">
              Projected to hit {BULK_TARGET_WEIGHT} lbs: <strong>{projectedDate}</strong>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* Weekly Trends */
function WeeklyTrends({ dailyData }: { dailyData: { date: string; calories: number; protein: number; label: string }[] }) {
  const last7 = dailyData.slice(-7);
  if (last7.length === 0) return null;

  const avgCal = Math.round(last7.reduce((s, d) => s + d.calories, 0) / last7.length);
  const avgPro = Math.round(last7.reduce((s, d) => s + d.protein, 0) / last7.length);
  const onTarget = last7.filter(d => d.calories >= TARGETS.caloriesMin && d.protein >= TARGETS.proteinMin).length;
  const compliance = Math.round((onTarget / last7.length) * 100);

  // Pattern detection
  const dayNames = last7.map(d => {
    const dow = new Date(d.date + "T12:00:00").getDay();
    return { ...d, isWeekend: dow === 0 || dow === 6 };
  });
  const weekendPro = dayNames.filter(d => d.isWeekend);
  const weekdayPro = dayNames.filter(d => !d.isWeekend);
  const avgWeekendPro = weekendPro.length ? weekendPro.reduce((s, d) => s + d.protein, 0) / weekendPro.length : 0;
  const avgWeekdayPro = weekdayPro.length ? weekdayPro.reduce((s, d) => s + d.protein, 0) / weekdayPro.length : 0;

  let pattern = compliance >= 85 ? "Consistent week! 🔥" : compliance >= 60 ? "Decent consistency." : "Inconsistent — focus on daily tracking.";
  if (weekendPro.length > 0 && avgWeekendPro < avgWeekdayPro * 0.85) {
    pattern = "Protein tends to dip on weekends. Plan ahead! 📋";
  }

  return (
    <Card delay={0.08}>
      <div className="panel-body">
        <PanelTitle accentColor="var(--violet)">Last 7 Days</PanelTitle>
        <div className="weekly-dots">
          {last7.map((d, i) => {
            const hit = d.calories >= TARGETS.caloriesMin && d.protein >= TARGETS.proteinMin;
            const close = !hit && d.calories >= TARGETS.caloriesMin * 0.85 && d.protein >= TARGETS.proteinMin * 0.85;
            const dayLabel = new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
            return (
              <div key={i} className="weekly-dot-col">
                <div className={`weekly-dot ${hit ? "dot-green" : close ? "dot-yellow" : "dot-red"}`} />
                <span className="weekly-dot-label">{dayLabel}</span>
              </div>
            );
          })}
        </div>
        <div className="weekly-stats">
          <div><span className="weekly-stat-label">Avg Calories</span><span className="weekly-stat-value">{avgCal.toLocaleString()}</span></div>
          <div><span className="weekly-stat-label">Avg Protein</span><span className="weekly-stat-value">{avgPro}g</span></div>
          <div><span className="weekly-stat-label">Compliance</span><span className="weekly-stat-value">{compliance}%</span></div>
        </div>
        <p className="weekly-pattern">{pattern}</p>
      </div>
    </Card>
  );
}

/* Body Composition Story */
function BodyCompStory({ bodyComp }: { bodyComp: BodyComp[] }) {
  const sorted = [...bodyComp].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;

  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const weeks = Math.max(1, Math.round((new Date(latest.date).getTime() - new Date(first.date).getTime()) / (7 * 86400000)));
  const weightChange = Number((latest.weight - first.weight).toFixed(1));
  const bfChange = Number((latest.bodyFat - first.bodyFat).toFixed(1));
  const muscleChange = Number((latest.muscleMass - first.muscleMass).toFixed(1));

  const arrow = (v: number, invert = false) => {
    const good = invert ? v < 0 : v > 0;
    return v > 0 ? (good ? "↑" : "↑") : v < 0 ? (good ? "↓" : "↓") : "→";
  };
  const arrowColor = (v: number, invert = false) => {
    const good = invert ? v <= 0 : v >= 0;
    return good ? "var(--emerald)" : "var(--amber)";
  };

  return (
    <Card delay={0.10}>
      <div className="panel-body">
        <PanelTitle accentColor="var(--blue)">Body Comp Story</PanelTitle>
        <div className="story-lines">
          <p>Over the last <strong>{weeks} week{weeks > 1 ? "s" : ""}</strong>:</p>
          <div className="story-stat">
            <span style={{ color: arrowColor(weightChange) }}>{arrow(weightChange)} {Math.abs(weightChange)} lbs</span>
            <span className="story-label">Weight {weightChange >= 0 ? "gained" : "lost"}</span>
          </div>
          {latest.bodyFat > 0 && (
            <div className="story-stat">
              <span style={{ color: arrowColor(bfChange, true) }}>{arrow(bfChange, true)} {Math.abs(bfChange)}%</span>
              <span className="story-label">Body fat {bfChange >= 0 ? "increase" : "decrease"}</span>
            </div>
          )}
          {latest.muscleMass > 0 && (
            <div className="story-stat">
              <span style={{ color: arrowColor(muscleChange) }}>{arrow(muscleChange)} {Math.abs(muscleChange)} lbs</span>
              <span className="story-label">Muscle mass {muscleChange >= 0 ? "gained" : "lost"}</span>
            </div>
          )}
          {muscleChange > 0 && weightChange > 0 && (
            <p className="story-ratio">
              ~{Math.round((muscleChange / weightChange) * 100)}% of weight gain was lean mass 💪
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/* Last Synced Indicator */
function LastSynced({ updatedAt, lastMealDate }: { updatedAt?: string; lastMealDate?: string }) {
  const now = Date.now();
  const synced = updatedAt ? new Date(updatedAt).getTime() : 0;
  const mealTs = lastMealDate ? new Date(lastMealDate + "T23:59:59").getTime() : 0;
  const staleData = synced > 0 && (now - synced) > 24 * 3600000;
  const staleMeals = mealTs > 0 && (now - mealTs) > 24 * 3600000;

  return (
    <div className="last-synced">
      <span className={`synced-item${staleData ? " stale" : ""}`}>
        {staleData ? "⚠️" : "✓"} Data synced {updatedAt ? new Date(updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "never"}
      </span>
      {lastMealDate && (
        <span className={`synced-item${staleMeals ? " stale" : ""}`}>
          {staleMeals ? "⚠️" : "✓"} Meals logged {new Date(lastMealDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      )}
    </div>
  );
}

function CommentaryBanner({ commentary }: { commentary: CommentaryPayload | null }) {
  if (!commentary) return null;
  return (
    <motion.div
      className="commentary-banner"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34 }}
    >
      <div className="commentary-badge">🦞 Max Says</div>
      <div className="commentary-main">
        <p className="commentary-greeting">{commentary.daily.greeting}</p>
        <p className="commentary-focus">{commentary.daily.focus}</p>
      </div>
    </motion.div>
  );
}

function MaxSaysCard({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <Card delay={0.03} className="max-card">
      <div className="panel-body">
        <PanelTitle accentColor="#6366f1">🦞 Max Says</PanelTitle>
        <div className="max-lines">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [tab,         setTab]         = useState<(typeof TABS)[number]>("Nutrition");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data,        setData]        = useState<DashboardPayload | null>(null);
  const [roadmap,     setRoadmap]     = useState<RoadmapPayload   | null>(null);
  const [looks,       setLooks]       = useState<LooksPayload     | null>(null);
  const [commentary,  setCommentary]  = useState<CommentaryPayload | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  /* ── Data fetch ───────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, roadmapRes, looksRes, commentaryRes] = await Promise.all([
        fetch("/api/dashboard",  { cache: "no-store" }),
        fetch("/api/roadmap",    { cache: "no-store" }),
        fetch("/api/looksmaxx",  { cache: "no-store" }),
        fetch("/api/commentary", { cache: "no-store" }),
      ]);
      const json       = (await res.json())       as DashboardPayload & { error?: string };
      const roadmapJson= (await roadmapRes.json())as RoadmapPayload   & { error?: string };
      const looksJson  = (await looksRes.json())  as LooksPayload     & { error?: string };
      const commentaryJson = commentaryRes.ok
        ? (await commentaryRes.json()) as CommentaryPayload
        : null;
      if (!res.ok) throw new Error(json.error ?? "Failed to fetch dashboard");
      if (roadmapRes.ok) setRoadmap(roadmapJson);
      if (looksRes.ok)   setLooks(looksJson);
      setCommentary(commentaryJson);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  /* ── Memos ────────────────────────────────────────────────── */
  const meals     = useMemo(() => data?.meals     ?? [], [data]);
  const bodyComp  = useMemo(() => data?.bodyComp  ?? [], [data]);
  const training  = useMemo(() => data?.training  ?? [], [data]);
  const today     = new Date().toLocaleDateString("en-CA");

  const todayMeals = useMemo(
    () => meals
      .filter((m) => m.date === today)
      .sort((a, b) => (MEAL_ORDER[a.meal] ?? 9) - (MEAL_ORDER[b.meal] ?? 9)),
    [meals, today],
  );

  const dailyData = useMemo(() => {
    return getDailyMacros(meals).map((d) => ({
      ...d,
      label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  }, [meals]);

  const bodyCompSorted = useMemo(
    () => [...bodyComp]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      })),
    [bodyComp],
  );

  const todayTotals = todayMeals.reduce(
    (a, m) => ({ cal: a.cal + (m.calories || 0), pro: a.pro + (m.protein || 0) }),
    { cal: 0, pro: 0 },
  );
  const calHits     = dailyData.filter((d) => d.calories >= TARGETS.caloriesMin).length;
  const proteinHits = dailyData.filter((d) => d.protein  >= TARGETS.proteinMin).length;
  const last7Cal    = dailyData.slice(-7);

  const lastMealDate = useMemo(() => {
    const dates = meals.map(m => m.date).filter(Boolean).sort();
    return dates[dates.length - 1] || undefined;
  }, [meals]);

  const todayTrained = useMemo(() => {
    return training.some(t => t.date === today);
  }, [training, today]);

  const latestBody = bodyCompSorted[bodyCompSorted.length - 1];
  const prevBody   = bodyCompSorted[bodyCompSorted.length - 2];
  const weightDelta  = latestBody && prevBody ? Number((latestBody.weight    - prevBody.weight).toFixed(1))    : 0;
  const bodyFatDelta = latestBody && prevBody ? Number((latestBody.bodyFat   - prevBody.bodyFat).toFixed(1))   : 0;
  const muscleDelta  = latestBody && prevBody ? Number((latestBody.muscleMass - prevBody.muscleMass).toFixed(1)): 0;

  const exercises = useMemo(() => {
    const byEx: Record<string, TrainingEntry[]> = {};
    training.forEach((e) => {
      if (!e.exercise) return;
      (byEx[e.exercise] ??= []).push(e);
    });
    return Object.entries(byEx).map(([name, entries]) => {
      const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
      return { name, latest: sorted[sorted.length - 1], first: sorted[0], sessions: sorted.length };
    });
  }, [training]);

  const workoutDays = useMemo(
    () => [...new Set(training.map((t) => t.date).filter(Boolean))],
    [training],
  );
  const lastWorkout = workoutDays.sort().at(-1);
  const latestExerciseEntries = useMemo(
    () => [...training].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6),
    [training],
  );

  const nutritionInsights = useMemo(() => generateNutritionInsights(meals, bodyComp), [meals, bodyComp]);
  const bodyCompInsights = useMemo(() => generateBodyCompInsights(bodyComp), [bodyComp]);
  const trainingInsights = useMemo(() => generateTrainingInsights(training), [training]);

  const nutritionMaxLines = useMemo(
    () => commentary
      ? [commentary.weekly.summary, commentary.weekly.mvp_meal, commentary.weekly.concern]
      : rotateInsights(nutritionInsights, 2).map((i) => i.text),
    [commentary, nutritionInsights],
  );
  const bodyCompMaxLines = useMemo(
    () => commentary
      ? [commentary.bodyComp.trend, commentary.bodyComp.projection, commentary.bodyComp.actionable]
      : rotateInsights(bodyCompInsights, 2).map((i) => i.text),
    [commentary, bodyCompInsights],
  );
  const trainingMaxLines = useMemo(
    () => commentary
      ? [commentary.training.highlight, commentary.training.gap, commentary.training.suggestion]
      : rotateInsights(trainingInsights, 2).map((i) => i.text),
    [commentary, trainingInsights],
  );

  /* ── KPI cards data ───────────────────────────────────────── */
  const topCards = useMemo(() => {
    if (tab === "Body Comp") return [
      { label: "Weight",   val: latestBody?.weight    || 0, suffix: " lbs", sub: `${weightDelta  >= 0 ? "+" : ""}${weightDelta} vs prior` },
      { label: "Body Fat", val: latestBody?.bodyFat   || 0, suffix: "%",    sub: `${bodyFatDelta >= 0 ? "+" : ""}${bodyFatDelta} vs prior` },
      { label: "Muscle",   val: latestBody?.muscleMass|| 0, suffix: " lbs", sub: `${muscleDelta  >= 0 ? "+" : ""}${muscleDelta} vs prior` },
      { label: "Goal Gap", val: latestBody ? Math.max(0, Number((latestBody.bodyFat - TARGETS.bodyFatGoal).toFixed(1))) : 0, suffix: "%", sub: `to ${TARGETS.bodyFatGoal}% goal` },
    ];
    if (tab === "Training") return [
      { label: "Workout Days", val: workoutDays.length, sub: "Unique training dates" },
      { label: "Exercises",    val: exercises.length,   sub: "Tracked lifts" },
      { label: "Last Session", val: lastWorkout ? new Date(`${lastWorkout}T12:00:00`).getDate() : 0,
        sub: lastWorkout ? new Date(`${lastWorkout}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No data" },
      { label: "Progressing",  val: exercises.filter((e) => e.latest.weight >= e.first.weight).length, sub: "Exercises moving up" },
    ];
    if (tab === "Roadmap") {
      const next   = roadmap?.nextMilestones?.[0];
      const latest = roadmap?.items?.[0];
      return [
        { label: "Roadmap Items",  val: roadmap?.items?.length || 0, sub: "Total milestones" },
        { label: "Next Milestone", val: next ? 1 : 0,                sub: next?.milestone ?? "No upcoming" },
        { label: "Target BF",      val: latest?.targetBodyFat ?? 0,  suffix: "%",    sub: "Latest target" },
        { label: "Target Muscle",  val: latest?.targetMuscle  ?? 0,  suffix: " lbs", sub: "Latest target" },
      ];
    }
    if (tab === "Looksmaxx") return [
      { label: "Daily Logs",   val: looks?.dailyCount    || 0, sub: "Looksmaxx HQ"    },
      { label: "Fitness Logs", val: looks?.fitnessCount  || 0, sub: "Workout + body"  },
      { label: "Products",     val: looks?.productsCount || 0, sub: "Stack tracked"   },
      { label: "Goals",        val: looks?.goalsCount    || 0, sub: "Milestones"      },
    ];
    // Nutrition
    return [
      { label: "Today's Calories", val: todayTotals.cal,  sub: `Target ${TARGETS.calories}`  },
      { label: "Today's Protein",  val: todayTotals.pro,  suffix: "g", sub: `Target ${TARGETS.protein}g` },
      { label: "Cal Goal Hits",    val: calHits,          sub: `${dailyData.length} tracked days` },
      { label: "Protein Hits",     val: proteinHits,      sub: `${dailyData.length} tracked days` },
    ];
  }, [tab, roadmap, looks, latestBody, weightDelta, bodyFatDelta, muscleDelta,
      workoutDays.length, exercises, lastWorkout,
      todayTotals.cal, todayTotals.pro, calHits, proteinHits, dailyData.length]);

  const meta = PAGE_META[tab];

  /* ── Close sidebar on navigation (mobile UX) ─────────────── */
  function navigate(t: typeof tab) {
    setTab(t);
    setSidebarOpen(false);
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="shell">

      {/* Sidebar overlay (mobile) */}
      <div
        className={`sidebar-overlay${sidebarOpen ? " visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="sidebar-logo">
          <div className="logo-badge">FC</div>
          <div>
            <div className="logo-name">FitCore</div>
            <span className="logo-tagline">Command Center</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ key, icon, label }) => (
            <button
              key={key}
              className={`nav-item${tab === key ? " active" : ""}`}
              onClick={() => navigate(key)}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="sync-dot" />
          <span className="sync-text">
            {data?.updatedAt
              ? `Synced ${new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Not connected"}
          </span>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────── */}
      <div className="main">

        {/* Header */}
        <header className="header">
          <div className="header-left">
            <button
              className="hamburger"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              <div className="ham-lines"><span /><span /><span /></div>
            </button>
            <div className="header-title">
              <h2>{meta.title}</h2>
              <p>{meta.subtitle}</p>
            </div>
          </div>
          <div className="header-right">
            <button className="refresh-btn" onClick={() => void fetchAll()}>
              <span className="refresh-icon">↻</span> Refresh
            </button>
          </div>
        </header>

        {/* Scroll area */}
        <div className="scroll-area">

          <CommentaryBanner commentary={commentary} />

          {/* Error bar */}
          {error && (
            <div className="error-bar">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* ── KPI Row ───────────────────────────────────── */}
          <div className="kpis">
            {loading
              ? [0,1,2,3].map((i) => <SkKpiCard key={i} />)
              : topCards.map((k, i) => (
                <motion.div
                  key={k.label}
                  className="kpi-card"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: .35, ease: [.4,0,.2,1] }}
                >
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-value">
                    <AnimatedNumber value={Number(k.val) || 0} suffix={k.suffix ?? ""} />
                  </div>
                  <div className="kpi-sub">{k.sub}</div>

                  {/* Sparklines for Nutrition tab */}
                  {tab === "Nutrition" && i === 0 && last7Cal.length > 1 && (
                    <div className="sparkline-wrap">
                      <ResponsiveContainer width="100%" height={34}>
                        <LineChart data={last7Cal} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                          <Line type="monotone" dataKey="calories" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {tab === "Nutrition" && i === 1 && last7Cal.length > 1 && (
                    <div className="sparkline-wrap">
                      <ResponsiveContainer width="100%" height={34}>
                        <LineChart data={last7Cal} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                          <Line type="monotone" dataKey="protein" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="kpi-glow" />
                </motion.div>
              ))
            }
          </div>

          {/* ── Tab Content ───────────────────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={loading ? "__loading__" : tab}
              variants={fadeIn}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: .18 } }}
            >

              {/* LOADING SKELETONS */}
              {loading && (
                <div className="content-grid">
                  <SkPanel rows={4} />
                  <SkPanel rows={4} />
                </div>
              )}

              {/* ── NUTRITION ─────────────────────────────── */}
              {!loading && tab === "Nutrition" && (
                <div className="content-grid nutrition-grid">

                  {/* Daily Score Card - full width */}
                  <div className="full-width">
                    <DailyScoreCard cal={todayTotals.cal} pro={todayTotals.pro} trained={todayTrained} />
                    <CoachInsights insights={nutritionInsights} />
                    <MaxSaysCard lines={nutritionMaxLines} />
                    <LastSynced updatedAt={data?.updatedAt} lastMealDate={lastMealDate} />
                  </div>

                  {/* Bulk Progress & Weekly Trends */}
                  <BulkProgress bodyComp={bodyComp} />
                  <WeeklyTrends dailyData={dailyData} />
                  <BodyCompStory bodyComp={bodyComp} />

                  {/* Daily Goals radial rings */}
                  <Card delay={0}>
                    <div className="panel-body">
                      <PanelTitle>Daily Goals</PanelTitle>
                      <div className="rings-row">
                        <RadialRing
                          value={todayTotals.cal}
                          max={TARGETS.calories}
                          color="#6366f1"
                          centerLabel={`${Math.round((todayTotals.cal / TARGETS.calories) * 100)}%`}
                          sublabel="Calories"
                        />
                        <RadialRing
                          value={todayTotals.pro}
                          max={TARGETS.protein}
                          color="#f59e0b"
                          centerLabel={`${Math.round((todayTotals.pro / TARGETS.protein) * 100)}%`}
                          sublabel="Protein"
                        />
                        <RadialRing
                          value={calHits}
                          max={Math.max(dailyData.length, 1)}
                          color="#10b981"
                          centerLabel={`${Math.round((calHits / Math.max(dailyData.length, 1)) * 100)}%`}
                          sublabel="Cal Hit Rate"
                        />
                        <RadialRing
                          value={proteinHits}
                          max={Math.max(dailyData.length, 1)}
                          color="#8b5cf6"
                          centerLabel={`${Math.round((proteinHits / Math.max(dailyData.length, 1)) * 100)}%`}
                          sublabel="Pro Hit Rate"
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Today's meals */}
                  <Card delay={0.07}>
                    <div className="panel-body">
                      <PanelTitle accentColor="#f59e0b">Today&apos;s Meals</PanelTitle>
                      <div className="list-stack">
                        {todayMeals.map((m, i) => (
                          <div key={i} className="list-row">
                            <div className="row-left">
                              <span className="row-emoji">{MEAL_EMOJI[m.meal] || "🍴"}</span>
                              <div style={{ minWidth: 0 }}>
                                <span className="row-title">{m.food}</span>
                                <Chip size="sm" color={SRC_CLR[m.source ?? "Other"]} variant="flat"
                                  style={{ fontSize: 10, marginTop: 3 }}>
                                  {m.source ?? "Other"}
                                </Chip>
                              </div>
                            </div>
                            <div className="row-right">{m.calories} kcal · {m.protein}g</div>
                          </div>
                        ))}
                        {!todayMeals.length && (
                          <p style={{ color: "var(--tx3)", fontSize: ".85rem", padding: "6px 0" }}>
                            Nothing logged yet today.
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Calories chart */}
                  <Card delay={0.14}>
                    <div className="panel-body">
                      <PanelTitle>Weekly Calories</PanelTitle>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={dailyData} barSize={18}>
                          <defs>
                            <linearGradient id="barHit"  x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity={.9} />
                              <stop offset="100%" stopColor="#10b981" stopOpacity={.4} />
                            </linearGradient>
                            <linearGradient id="barMiss" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#6366f1" stopOpacity={.9} />
                              <stop offset="100%" stopColor="#6366f1" stopOpacity={.4} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(63,63,70,.35)" vertical={false} />
                          <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<GlassTip />} />
                          <ReferenceLine y={TARGETS.caloriesMin} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={.6} />
                          <Bar dataKey="calories" name="Calories" radius={[6, 6, 0, 0]}>
                            {dailyData.map((d, i) => (
                              <Cell key={i} fill={d.calories >= TARGETS.caloriesMin ? "url(#barHit)" : "url(#barMiss)"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* Protein chart */}
                  <Card delay={0.21}>
                    <div className="panel-body">
                      <PanelTitle accentColor="#f59e0b">Protein Trend</PanelTitle>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={dailyData}>
                          <defs>
                            <linearGradient id="protGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={.38} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}   />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(63,63,70,.35)" vertical={false} />
                          <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<GlassTip />} />
                          <ReferenceLine y={TARGETS.proteinMin} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={.6} />
                          <Area type="monotone" dataKey="protein" name="Protein (g)"
                            stroke="#f59e0b" strokeWidth={2.5} fill="url(#protGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                </div>
              )}

              {/* ── BODY COMP ──────────────────────────────── */}
              {!loading && tab === "Body Comp" && (
                <div className="content-grid">

                  <MaxSaysCard lines={bodyCompMaxLines} />
                  <CoachInsights insights={bodyCompInsights} />

                  <Card delay={0}>
                    <div className="panel-body">
                      <PanelTitle accentColor="#60a5fa">Weight &amp; Muscle Trend</PanelTitle>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={bodyCompSorted}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(63,63,70,.35)" vertical={false} />
                          <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<GlassTip />} />
                          <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
                          <Line type="monotone" dataKey="weight"     stroke="#60a5fa" strokeWidth={2.5} name="Weight (lbs)"
                            dot={{ r: 3, fill: "#60a5fa", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                          <Line type="monotone" dataKey="muscleMass" stroke="#34d399" strokeWidth={2.5} name="Muscle (lbs)"
                            dot={{ r: 3, fill: "#34d399", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card delay={0.07}>
                    <div className="panel-body">
                      <PanelTitle accentColor="#f59e0b">Body Fat Trajectory</PanelTitle>
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={bodyCompSorted}>
                          <defs>
                            <linearGradient id="bfGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={.38} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}   />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(63,63,70,.35)" vertical={false} />
                          <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<GlassTip />} />
                          <ReferenceLine y={TARGETS.bodyFatGoal} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={.7} label={{ value: "Goal", fill: "#10b981", fontSize: 10 }} />
                          <Area type="monotone" dataKey="bodyFat" name="Body Fat %"
                            stroke="#f59e0b" strokeWidth={2.5} fill="url(#bfGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card delay={0.14}>
                    <div className="panel-body">
                      <PanelTitle>Recent Training Sessions</PanelTitle>
                      <div className="list-stack">
                        {latestExerciseEntries.map((e, i) => (
                          <div key={`${e.exercise}-${e.date}-${i}`} className="list-row">
                            <div>
                              <span className="row-title">{e.exercise}</span>
                              <span className="row-sub">{e.date || "No date"} · {e.workoutType || "Workout"}</span>
                            </div>
                            <div className="row-right">{e.weight} lbs × {String(e.reps)}</div>
                          </div>
                        ))}
                        {!latestExerciseEntries.length && (
                          <p style={{ color: "var(--tx3)", fontSize: ".85rem" }}>No exercise entries yet.</p>
                        )}
                      </div>
                    </div>
                  </Card>

                </div>
              )}

              {/* ── TRAINING ──────────────────────────────── */}
              {!loading && tab === "Training" && (
                <div className="content-grid">

                  <MaxSaysCard lines={trainingMaxLines} />
                  <CoachInsights insights={trainingInsights} />

                  <Card delay={0}>
                    <div className="panel-body">
                      <PanelTitle>Exercise Progression</PanelTitle>
                      <div className="list-stack">
                        {exercises.map((ex) => {
                          const delta = ex.latest.weight - ex.first.weight;
                          return (
                            <div key={ex.name} className="list-row">
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <span className="row-title">{ex.name}</span>
                                <span className="row-sub">{ex.sessions} sessions · latest {ex.latest.weight} lbs × {ex.latest.reps}</span>
                              </div>
                              <Chip color={delta >= 0 ? "success" : "danger"} variant="flat" size="sm">
                                {delta >= 0 ? "+" : ""}{delta} lbs
                              </Chip>
                            </div>
                          );
                        })}
                        {!exercises.length && (
                          <p style={{ color: "var(--tx3)", fontSize: ".85rem" }}>No exercise data yet.</p>
                        )}
                      </div>
                    </div>
                  </Card>

                  <Card delay={0.07}>
                    <div className="panel-body">
                      <PanelTitle accentColor="#f59e0b">Body Fat Trend</PanelTitle>
                      <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={bodyCompSorted}>
                          <defs>
                            <linearGradient id="bfGrad2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={.38} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}   />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(63,63,70,.35)" vertical={false} />
                          <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<GlassTip />} />
                          <Area type="monotone" dataKey="bodyFat" name="Body Fat %"
                            stroke="#f59e0b" strokeWidth={2.5} fill="url(#bfGrad2)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                </div>
              )}

              {/* ── ROADMAP ────────────────────────────────── */}
              {!loading && tab === "Roadmap" && (
                <div className="content-grid">

                  <Card delay={0}>
                    <div className="panel-body">
                      <PanelTitle accentColor="#8b5cf6">Roadmap Phases</PanelTitle>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={roadmap?.byPhase || []}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={90}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            label={({ name, percent }: any) => `${String(name)} ${(Number(percent) * 100).toFixed(0)}%`}
                            strokeWidth={2}
                            stroke="rgba(9,9,11,.8)"
                          >
                            {(roadmap?.byPhase || []).map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<GlassTip />} />
                          <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card delay={0.07}>
                    <div className="panel-body">
                      <PanelTitle>Next Milestones</PanelTitle>
                      <div className="list-stack">
                        {(roadmap?.nextMilestones || []).map((m, i) => (
                          <div key={`${m.milestone}-${i}`} className="list-row">
                            <div>
                              <span className="row-title">{m.milestone}</span>
                              <span className="row-sub">{m.date || "No date"} · {m.phase || "No phase"}</span>
                            </div>
                          </div>
                        ))}
                        {!roadmap?.nextMilestones?.length && (
                          <p style={{ color: "var(--tx3)", fontSize: ".85rem" }}>No upcoming milestones yet.</p>
                        )}
                      </div>
                    </div>
                  </Card>

                  <Card delay={0.14}>
                    <div className="panel-body">
                      <PanelTitle>All Roadmap Items</PanelTitle>
                      <div className="list-stack">
                        {(roadmap?.items || []).slice(0, 8).map((it, i) => (
                          <div key={`${it.milestone}-${i}`} className="list-row">
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <span className="row-title">{it.milestone}</span>
                              <span className="row-sub">{it.phase || "Phase"} · {it.type || "Type"} · {it.date || "No date"}</span>
                            </div>
                            <div className="row-right">
                              {it.targetWeight ? `${it.targetWeight} lbs` : ""}
                              {it.targetBodyFat ? ` · ${it.targetBodyFat}% BF` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>

                </div>
              )}

              {/* ── LOOKSMAXX ──────────────────────────────── */}
              {!loading && tab === "Looksmaxx" && (
                <div className="content-grid">

                  <Card delay={0}>
                    <div className="panel-body">
                      <PanelTitle accentColor="#06b6d4">Latest Daily Logs</PanelTitle>
                      <div className="list-stack">
                        {(looks?.latestDaily || []).map((d, idx) => (
                          <div key={`${d.title}-${idx}`} className="list-row">
                            <div>
                              <span className="row-title">{d.title || "Untitled"}</span>
                              <span className="row-sub">{d.date || "No date"}</span>
                            </div>
                          </div>
                        ))}
                        {!looks?.latestDaily?.length && (
                          <p style={{ color: "var(--tx3)", fontSize: ".85rem" }}>No daily entries found yet.</p>
                        )}
                      </div>
                    </div>
                  </Card>

                  <Card delay={0.07}>
                    <div className="panel-body">
                      <PanelTitle accentColor="#8b5cf6">Goals &amp; Milestones</PanelTitle>
                      <div className="list-stack">
                        {(looks?.latestGoals || []).map((g, idx) => (
                          <div key={`${g.title}-${idx}`} className="list-row">
                            <div>
                              <span className="row-title">{g.title || "Untitled goal"}</span>
                              <span className="row-sub">{g.status || "No status"}</span>
                            </div>
                          </div>
                        ))}
                        {!looks?.latestGoals?.length && (
                          <p style={{ color: "var(--tx3)", fontSize: ".85rem" }}>No goals found yet.</p>
                        )}
                      </div>
                    </div>
                  </Card>

                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────── */}
      <nav className="mobile-nav">
        {TABS.map((t) => (
          <button
            key={t}
            className={`mob-btn${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            <span className="mob-icon">
              {t === "Nutrition" ? "🍽️" : t === "Body Comp" ? "📊" : t === "Training" ? "🏋️" : t === "Roadmap" ? "🗺️" : "✨"}
            </span>
            <span>{t === "Body Comp" ? "Body" : t === "Looksmaxx" ? "Looks" : t}</span>
          </button>
        ))}
      </nav>

    </div>
  );
}
