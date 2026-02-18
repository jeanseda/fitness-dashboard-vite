import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button, Card, CardBody, Chip, Input, Spinner, Tab, Tabs } from "@heroui/react";
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

type Meal = { food: string; date: string; meal: string; calories: number; protein: number; source?: string };
type BodyComp = { date: string; weight: number; bodyFat: number; muscleMass: number };
type TrainingEntry = { exercise: string; date: string; weight: number; reps: string | number };
type DashboardPayload = { meals: Meal[]; bodyComp: BodyComp[]; training: TrainingEntry[]; updatedAt: string };

type PortfolioPayload = {
  updatedAt: string;
  totalValue: number;
  dailyPnl: number;
  dailyPnlPct: number;
  allocation: { name: string; value: number }[];
  performance: { date: string; value: number; label: string }[];
  topPositions: { symbol: string; value: number; changePct: number; assetClass: string }[];
};

const TARGETS = { calories: 2800, protein: 170, caloriesMin: 2700, proteinMin: 160, bodyFatGoal: 16 };
const TABS = ["Nutrition", "Body Comp", "Training", "Portfolio"] as const;
const MEAL_ORDER: Record<string, number> = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3, Shake: 4 };
const MEAL_EMOJI: Record<string, string> = { Breakfast: "🌅", Lunch: "🌞", Dinner: "🌙", Snack: "🍫", Shake: "🥤" };
const SRC_CLR: Record<string, "success" | "danger" | "primary" | "secondary" | "default"> = {
  "Ideal Nutrition": "success",
  Restaurant: "danger",
  Homemade: "primary",
  Supplement: "secondary",
  Other: "default",
};

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 600;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{display}{suffix}</>;
}

export default function App() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Nutrition");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, portfolioRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/portfolio", { cache: "no-store" }),
      ]);
      const json = (await res.json()) as DashboardPayload & { error?: string };
      const portfolioJson = (await portfolioRes.json()) as PortfolioPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to fetch dashboard data");
      if (portfolioRes.ok) setPortfolio(portfolioJson);
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

  const dailyData = useMemo(() => {
    const byDate: Record<string, { date: string; calories: number; protein: number; label: string }> = {};
    meals.forEach((m) => {
      if (!m.date) return;
      if (!byDate[m.date]) {
        byDate[m.date] = {
          date: m.date,
          calories: 0,
          protein: 0,
          label: new Date(`${m.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        };
      }
      byDate[m.date].calories += m.calories || 0;
      byDate[m.date].protein += m.protein || 0;
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [meals]);

  const bodyCompSorted = useMemo(
    () => [...bodyComp].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ ...d, label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) })),
    [bodyComp],
  );

  const todayTotals = todayMeals.reduce((a, m) => ({ cal: a.cal + (m.calories || 0), pro: a.pro + (m.protein || 0) }), { cal: 0, pro: 0 });
  const avgCal = dailyData.length ? Math.round(dailyData.reduce((s, d) => s + d.calories, 0) / dailyData.length) : 0;
  const avgPro = dailyData.length ? Math.round(dailyData.reduce((s, d) => s + d.protein, 0) / dailyData.length) : 0;
  const calHits = dailyData.filter((d) => d.calories >= TARGETS.caloriesMin).length;
  const proteinHits = dailyData.filter((d) => d.protein >= TARGETS.proteinMin).length;

  const latestBody = bodyCompSorted[bodyCompSorted.length - 1];
  const prevBody = bodyCompSorted[bodyCompSorted.length - 2];
  const weightDelta = latestBody && prevBody ? Number((latestBody.weight - prevBody.weight).toFixed(1)) : 0;
  const bodyFatDelta = latestBody && prevBody ? Number((latestBody.bodyFat - prevBody.bodyFat).toFixed(1)) : 0;
  const muscleDelta = latestBody && prevBody ? Number((latestBody.muscleMass - prevBody.muscleMass).toFixed(1)) : 0;

  const exercises = useMemo(() => {
    const byEx: Record<string, TrainingEntry[]> = {};
    training.forEach((e) => {
      if (!e.exercise) return;
      if (!byEx[e.exercise]) byEx[e.exercise] = [];
      byEx[e.exercise].push(e);
    });
    return Object.entries(byEx).map(([name, entries]) => {
      const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
      return { name, latest: sorted[sorted.length - 1], first: sorted[0], sessions: sorted.length };
    });
  }, [training]);

  const workoutDays = useMemo(() => [...new Set(training.map((t) => t.date).filter(Boolean))], [training]);
  const lastWorkout = workoutDays.sort().at(-1);

  const coachReply = useMemo(() => {
    const q = question.toLowerCase();
    if (!q) return `Avg ${avgCal} cal / ${avgPro}g protein. Hit goals: ${calHits}/${dailyData.length || 0} cal days, ${proteinHits}/${dailyData.length || 0} protein days.`;
    if (q.includes("protein")) return avgPro >= TARGETS.protein ? `Protein is solid (${avgPro}g avg).` : `Protein is low (${avgPro}g avg). Add 20-30g early in day.`;
    if (q.includes("fat") || q.includes("body")) return latestBody ? `Latest body fat ${latestBody.bodyFat}%. Delta ${bodyFatDelta > 0 ? "+" : ""}${bodyFatDelta}% vs last scan.` : "No body comp trend yet.";
    if (q.includes("workout") || q.includes("train")) return `Tracked ${workoutDays.length} workout days. Keep +2.5 to +5 lbs progressive overload weekly.`;
    return `Tomorrow: protein to ${TARGETS.protein}g and calories above ${TARGETS.caloriesMin}.`;
  }, [question, avgCal, avgPro, calHits, proteinHits, dailyData.length, latestBody, bodyFatDelta, workoutDays.length]);

  const topCards = useMemo(() => {
    if (tab === "Body Comp") {
      return [
        { label: "Weight", val: latestBody?.weight || 0, suffix: " lbs", sub: `${weightDelta >= 0 ? "+" : ""}${weightDelta} vs prior` },
        { label: "Body Fat", val: latestBody?.bodyFat || 0, suffix: "%", sub: `${bodyFatDelta >= 0 ? "+" : ""}${bodyFatDelta} vs prior` },
        { label: "Muscle", val: latestBody?.muscleMass || 0, suffix: " lbs", sub: `${muscleDelta >= 0 ? "+" : ""}${muscleDelta} vs prior` },
        { label: "Goal Gap", val: latestBody ? Math.max(0, Number((latestBody.bodyFat - TARGETS.bodyFatGoal).toFixed(1))) : 0, suffix: "%", sub: `to ${TARGETS.bodyFatGoal}% goal` },
      ];
    }
    if (tab === "Training") {
      return [
        { label: "Workout Days", val: workoutDays.length, sub: "Unique training dates" },
        { label: "Exercises", val: exercises.length, sub: "Tracked lifts" },
        { label: "Last Session", val: lastWorkout ? new Date(`${lastWorkout}T12:00:00`).getDate() : 0, sub: lastWorkout ? new Date(`${lastWorkout}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No data" },
        { label: "Progressing", val: exercises.filter((e) => e.latest.weight >= e.first.weight).length, sub: "Exercises moving up" },
      ];
    }
    if (tab === "Portfolio") {
      return [
        { label: "Portfolio Value", val: portfolio?.totalValue || 0, sub: "Stocks + crypto", suffix: "" },
        { label: "Daily P&L", val: portfolio?.dailyPnl || 0, sub: `${portfolio?.dailyPnlPct ?? 0}% today` },
        { label: "Positions", val: portfolio?.topPositions?.length || 0, sub: "Tracked symbols" },
        { label: "Data", val: portfolio ? 1 : 0, sub: portfolio ? `Updated ${new Date(portfolio.updatedAt).toLocaleTimeString()}` : "Waiting for imports" },
      ];
    }
    return [
      { label: "Today Calories", val: todayTotals.cal, sub: `Target ${TARGETS.calories}` },
      { label: "Today Protein", val: todayTotals.pro, suffix: "g", sub: `Target ${TARGETS.protein}g` },
      { label: "Cal Goal Hits", val: calHits, sub: `${dailyData.length} tracked days` },
      { label: "Protein Hits", val: proteinHits, sub: `${dailyData.length} tracked days` },
    ];
  }, [tab, portfolio, latestBody, weightDelta, bodyFatDelta, muscleDelta, workoutDays.length, exercises, lastWorkout, todayTotals.cal, todayTotals.pro, calHits, proteinHits, dailyData.length]);

  return (
    <div className="page">
      <div className="hero">
        <div>
          <h1>💪 Fitness Command Center</h1>
          <p>{data?.updatedAt ? `Last sync ${new Date(data.updatedAt).toLocaleTimeString()}` : "Connect to Notion to begin"}</p>
        </div>
        <Button color="primary" variant="shadow" onPress={() => void fetchAll()}>Refresh</Button>
      </div>

      <div className="kpis">
        {topCards.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card><CardBody><p>{k.label}</p><h3><AnimatedNumber value={Number(k.val) || 0} suffix={k.suffix} /></h3><small>{k.sub}</small></CardBody></Card>
          </motion.div>
        ))}
      </div>

      <div className="tab-wrap desktop-tabs">
        <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key) as (typeof TABS)[number])} aria-label="Dashboard tabs" color="primary" variant="underlined">
          <Tab key="Nutrition" title="🍽️ Nutrition" />
          <Tab key="Body Comp" title="📊 Body Comp" />
          <Tab key="Training" title="🏋️ Training" />
          <Tab key="Portfolio" title="📈 Portfolio" />
        </Tabs>
      </div>

      {loading && <div className="state"><Spinner size="lg" color="primary" /><span>Loading your latest data…</span></div>}
      {error && <Card className="error"><CardBody>{error}</CardBody></Card>}

      <Card className="panel coach-panel">
        <CardBody>
          <h3>🧠 AI Coach</h3>
          <Input size="sm" placeholder="Ask: how is my protein trend?" value={question} onValueChange={setQuestion} />
          <p className="muted coach-reply">{coachReply}</p>
        </CardBody>
      </Card>

      {!loading && tab === "Nutrition" && (
        <div className="grid">
          <Card className="panel">
            <CardBody>
              <h3>Today&apos;s meals</h3>
              <div className="list">
                {todayMeals.map((m, i) => (
                  <div key={i} className="item">
                    <div className="left">
                      <span>{MEAL_EMOJI[m.meal] || "🍴"}</span>
                      <div>
                        <strong>{m.food}</strong>
                        <Chip size="sm" color={SRC_CLR[m.source || "Other"]}>{m.source || "Other"}</Chip>
                      </div>
                    </div>
                    <div className="right">{m.calories} cal · {m.protein}g</div>
                  </div>
                ))}
                {!todayMeals.length && <p className="muted">Nothing logged yet today.</p>}
              </div>
            </CardBody>
          </Card>

          <Card className="panel">
            <CardBody>
              <h3>Calories trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b3250" />
                  <XAxis dataKey="label" tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <Tooltip />
                  <ReferenceLine y={TARGETS.caloriesMin} stroke="#22c55e" strokeDasharray="5 5" />
                  <Bar dataKey="calories" radius={[6, 6, 0, 0]}>
                    {dailyData.map((d, i) => <Cell key={i} fill={d.calories >= TARGETS.caloriesMin ? "#22c55e" : "#6366f1"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <h3 style={{ marginTop: 14 }}>Protein trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b3250" />
                  <XAxis dataKey="label" tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <Tooltip />
                  <ReferenceLine y={TARGETS.proteinMin} stroke="#f59e0b" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="protein" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>
      )}

      {!loading && tab === "Body Comp" && (
        <div className="grid">
          <Card className="panel">
            <CardBody>
              <h3>Weight + Muscle trend</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={bodyCompSorted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b3250" />
                  <XAxis dataKey="label" tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="weight" stroke="#60a5fa" strokeWidth={2.5} name="Weight" />
                  <Line type="monotone" dataKey="muscleMass" stroke="#34d399" strokeWidth={2.5} name="Muscle" />
                </LineChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card className="panel">
            <CardBody>
              <h3>Body fat trajectory</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={bodyCompSorted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b3250" />
                  <XAxis dataKey="label" tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <Tooltip />
                  <ReferenceLine y={TARGETS.bodyFatGoal} stroke="#22c55e" strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="bodyFat" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>
      )}

      {!loading && tab === "Training" && (
        <div className="grid">
          <Card className="panel">
            <CardBody>
              <h3>Exercise progression</h3>
              <div className="list">
                {exercises.map((ex) => {
                  const delta = ex.latest.weight - ex.first.weight;
                  return (
                    <div key={ex.name} className="item">
                      <div>
                        <strong>{ex.name}</strong>
                        <p className="muted">{ex.sessions} sessions · latest {ex.latest.weight} lbs × {ex.latest.reps}</p>
                      </div>
                      <Chip color={delta >= 0 ? "success" : "danger"} variant="flat">{delta >= 0 ? "+" : ""}{delta} lbs</Chip>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card className="panel">
            <CardBody>
              <h3>Body fat trend</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={bodyCompSorted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b3250" />
                  <XAxis dataKey="label" tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="bodyFat" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>
      )}

      {!loading && tab === "Portfolio" && (
        <div className="grid">
          <Card className="panel">
            <CardBody>
              <h3>Allocation</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={portfolio?.allocation || []} dataKey="value" nameKey="name" outerRadius={90} label />
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card className="panel">
            <CardBody>
              <h3>Portfolio performance</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={portfolio?.performance || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b3250" />
                  <XAxis dataKey="label" tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card className="panel">
            <CardBody>
              <h3>Top positions</h3>
              <div className="list">
                {(portfolio?.topPositions || []).map((p) => (
                  <div key={p.symbol} className="item">
                    <div>
                      <strong>{p.symbol}</strong>
                      <p className="muted">{p.assetClass}</p>
                    </div>
                    <div className="right">${p.value.toFixed(2)} · {p.changePct >= 0 ? "+" : ""}{p.changePct}%</div>
                  </div>
                ))}
                {!portfolio?.topPositions?.length && <p className="muted">No portfolio imports yet. Add CSV/PDF files and re-import.</p>}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="mobile-nav">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "active" : ""}>
            {t === "Nutrition" ? "🍽️" : t === "Body Comp" ? "📊" : t === "Training" ? "🏋️" : "📈"}
            <span>{t}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
