import { useCallback, useEffect, useMemo, useState } from "react";
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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Meal = {
  food: string;
  date: string;
  meal: string;
  calories: number;
  protein: number;
  carbs?: number | null;
  fat?: number | null;
  source?: string;
};

type BodyComp = {
  date: string;
  weight: number;
  bodyFat: number;
  muscleMass: number;
  leanMass?: number | null;
  bmi?: number | null;
  bmr?: number | null;
  notes?: string | null;
};

type TrainingEntry = {
  exercise: string;
  date: string;
  weight: number;
  sets: number;
  reps: string | number;
  workoutType?: string;
  notes?: string | null;
};

type DashboardPayload = {
  meals: Meal[];
  bodyComp: BodyComp[];
  training: TrainingEntry[];
  updatedAt: string;
};

const TARGETS = { calories: 2800, protein: 170, caloriesMin: 2700, proteinMin: 160 };
const MEAL_ORDER: Record<string, number> = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3, Shake: 4 };
const MEAL_EMOJI: Record<string, string> = {
  Breakfast: "🌅",
  Lunch: "🌞",
  Dinner: "🌙",
  Snack: "🍫",
  Shake: "🥤",
};
const SRC_CLR: Record<string, string> = {
  "Ideal Nutrition": "#22c55e",
  Restaurant: "#ef4444",
  Homemade: "#3b82f6",
  Supplement: "#a855f7",
  Other: "#64748b",
};
const TABS = ["Nutrition", "Body Comp", "Training"] as const;

export default function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Nutrition");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const json = (await res.json()) as DashboardPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to fetch dashboard data");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const meals = useMemo(() => data?.meals ?? [], [data]);
  const bodyComp = useMemo(() => data?.bodyComp ?? [], [data]);
  const training = useMemo(() => data?.training ?? [], [data]);

  const today = new Date().toLocaleDateString("en-CA");
  const todayMeals = useMemo(
    () => meals.filter((m) => m.date === today).sort((a, b) => (MEAL_ORDER[a.meal] ?? 9) - (MEAL_ORDER[b.meal] ?? 9)),
    [meals, today],
  );

  const todayTotals = todayMeals.reduce(
    (a, m) => ({ cal: a.cal + (m.calories || 0), pro: a.pro + (m.protein || 0) }),
    { cal: 0, pro: 0 },
  );

  const dailyData = useMemo(() => {
    const byDate: Record<string, { date: string; calories: number; protein: number; count: number }> = {};
    meals.forEach((m) => {
      if (!m.date) return;
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, calories: 0, protein: 0, count: 0 };
      byDate[m.date].calories += m.calories || 0;
      byDate[m.date].protein += m.protein || 0;
      byDate[m.date].count++;
    });
    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
      }));
  }, [meals]);

  const avgCal = dailyData.length ? Math.round(dailyData.reduce((s, d) => s + d.calories, 0) / dailyData.length) : 0;
  const avgPro = dailyData.length ? Math.round(dailyData.reduce((s, d) => s + d.protein, 0) / dailyData.length) : 0;
  const daysHitCal = dailyData.filter((d) => d.calories >= TARGETS.caloriesMin).length;

  const exercises = useMemo(() => {
    const byEx: Record<string, TrainingEntry[]> = {};
    training.forEach((e) => {
      if (!e.exercise) return;
      if (!byEx[e.exercise]) byEx[e.exercise] = [];
      byEx[e.exercise].push(e);
    });
    return Object.entries(byEx).map(([name, entries]) => {
      const sorted = entries.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      return { name, entries: sorted, first: sorted[0], latest: sorted[sorted.length - 1] };
    });
  }, [training]);

  const workoutCount = [...new Set(training.map((e) => e.date).filter(Boolean))].length;
  const lastWorkout = [...new Set(training.map((e) => e.date).filter(Boolean))].sort().pop() ?? null;

  const Box = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: "#1e1e2e", borderRadius: 12, padding: 20, marginBottom: 16, ...style }}>{children}</div>
  );

  const Err = ({ msg }: { msg: string | null }) =>
    msg ? (
      <div style={{ background: "#2d1b1b", border: "1px solid #7f1d1d", borderRadius: 8, padding: 10, color: "#fca5a5", fontSize: 12, marginBottom: 12 }}>{msg}</div>
    ) : null;

  const ttStyle = {
    contentStyle: {
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: 8,
      color: "#e2e8f0",
      fontSize: 12,
    },
  };

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", paddingBottom: 24 }}>
      <div style={{ padding: "18px 18px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>💪 Fitness Dashboard</h1>
          <div style={{ color: "#475569", fontSize: 10, marginTop: 2 }}>
            {data?.updatedAt ? `Refreshed ${new Date(data.updatedAt).toLocaleTimeString()}` : "Not loaded yet"}
          </div>
        </div>
        <button onClick={() => void fetchAll()} style={{ background: "#6366f1", color: "white", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          ↻ Refresh
        </button>
      </div>

      <div style={{ display: "flex", gap: 2, padding: "12px 18px 0", borderBottom: "1px solid #1e293b" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? "#1e293b" : "transparent", color: tab === t ? "#e2e8f0" : "#64748b", border: "none", borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", borderRadius: "8px 8px 0 0" }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: 18 }}>
        {loading && <div style={{ color: "#94a3b8" }}>Loading…</div>}
        <Err msg={error} />

        {tab === "Nutrition" && (
          <>
            <Box>
              <h3 style={{ marginTop: 0 }}>🍽️ Today&apos;s Meals</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {todayMeals.map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 12px", background: "#0f172a", borderRadius: 8, gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{MEAL_EMOJI[m.meal] || "🍴"}</span>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{m.food}</div><span style={{ fontSize: 10, color: SRC_CLR[m.source || ""] || "#94a3b8" }}>{m.source || "Other"}</span></div>
                    <div>{m.calories} cal</div>
                    <div style={{ color: "#f59e0b" }}>{m.protein}g pro</div>
                  </div>
                ))}
                {!todayMeals.length && <div style={{ color: "#64748b" }}>Nothing logged yet today.</div>}
              </div>
              <div style={{ marginTop: 12, color: "#94a3b8", fontSize: 12 }}>{todayTotals.cal}/{TARGETS.calories} cal · {todayTotals.pro}/{TARGETS.protein}g protein</div>
            </Box>
            <Box>
              <h3 style={{ marginTop: 0 }}>Calories by Day</h3>
              <ResponsiveContainer width="100%" height={220}><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} /><YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} /><Tooltip {...ttStyle} /><ReferenceLine y={TARGETS.calories} stroke="#22c55e" strokeDasharray="5 5" /><Bar dataKey="calories">{dailyData.map((d, i) => (<Cell key={i} fill={d.calories >= TARGETS.caloriesMin ? "#22c55e" : "#ef4444"} />))}</Bar></BarChart></ResponsiveContainer>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Avg: {avgCal} cal · Avg Protein: {avgPro}g · Days Hit: {daysHitCal}/{dailyData.length}</div>
            </Box>
          </>
        )}

        {tab === "Body Comp" && (
          <Box>
            <h3 style={{ marginTop: 0 }}>📊 Body Comp</h3>
            <ResponsiveContainer width="100%" height={240}><LineChart data={bodyComp.map((d) => ({ ...d, label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) }))}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} /><YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} /><Tooltip {...ttStyle} /><Legend /><Line type="monotone" dataKey="weight" stroke="#6366f1" name="Weight" /><Line type="monotone" dataKey="muscleMass" stroke="#22c55e" name="Muscle" /></LineChart></ResponsiveContainer>
          </Box>
        )}

        {tab === "Training" && (
          <>
            <Box>
              <h3 style={{ marginTop: 0 }}>🏋️ Training</h3>
              <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>Workouts: {workoutCount} · Exercises: {exercises.length} · Last: {lastWorkout || "—"}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {exercises.map((ex) => {
                  const delta = ex.entries.length > 1 ? ex.latest.weight - ex.first.weight : 0;
                  return <div key={ex.name} style={{ padding: 10, background: "#0f172a", borderRadius: 8 }}><strong>{ex.name}</strong> · {ex.latest.weight} lbs × {ex.latest.reps}{delta !== 0 && <span style={{ marginLeft: 8, color: delta > 0 ? "#22c55e" : "#ef4444" }}>{delta > 0 ? "+" : ""}{delta}</span>}</div>;
                })}
                {!exercises.length && <div style={{ color: "#64748b" }}>No training data yet.</div>}
              </div>
            </Box>
            <Box>
              <h3 style={{ marginTop: 0 }}>Body Fat Trend</h3>
              <ResponsiveContainer width="100%" height={220}><AreaChart data={bodyComp.map((d) => ({ ...d, label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) }))}><CartesianGrid strokeDasharray="3 3" stroke="#334155" /><XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} /><YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} /><Tooltip {...ttStyle} /><Area type="monotone" dataKey="bodyFat" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} /></AreaChart></ResponsiveContainer>
            </Box>
          </>
        )}
      </div>
    </div>
  );
}
