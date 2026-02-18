import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button, Card, CardBody, Chip, Spinner, Tab, Tabs } from "@heroui/react";
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
type TrainingEntry = { exercise: string; date: string; weight: number; reps: string | number; workoutType?: string };
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

type LooksPayload = {
  updatedAt: string;
  dailyCount: number;
  fitnessCount: number;
  productsCount: number;
  goalsCount: number;
  latestDaily: { title: string; date?: string }[];
  latestGoals: { title: string; status?: string }[];
};

const TARGETS = { calories: 2800, protein: 170, caloriesMin: 2700, proteinMin: 160, bodyFatGoal: 20 };
const TABS = ["Nutrition", "Body Comp", "Training", "Portfolio", "Looksmaxx"] as const;
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
  const [looks, setLooks] = useState<LooksPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, portfolioRes, looksRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/portfolio", { cache: "no-store" }),
        fetch("/api/looksmaxx", { cache: "no-store" }),
      ]);
      const json = (await res.json()) as DashboardPayload & { error?: string };
      const portfolioJson = (await portfolioRes.json()) as PortfolioPayload & { error?: string };
      const looksJson = (await looksRes.json()) as LooksPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to fetch dashboard data");
      if (portfolioRes.ok) setPortfolio(portfolioJson);
      if (looksRes.ok) setLooks(looksJson);
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
  const latestExerciseEntries = useMemo(
    () => [...training].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6),
    [training],
  );


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
    if (tab === "Looksmaxx") {
      return [
        { label: "Daily Logs", val: looks?.dailyCount || 0, sub: "Looksmaxx HQ" },
        { label: "Fitness Logs", val: looks?.fitnessCount || 0, sub: "Workout + body" },
        { label: "Products", val: looks?.productsCount || 0, sub: "Stack tracked" },
        { label: "Goals", val: looks?.goalsCount || 0, sub: "Milestones" },
      ];
    }
    return [
      { label: "Today Calories", val: todayTotals.cal, sub: `Target ${TARGETS.calories}` },
      { label: "Today Protein", val: todayTotals.pro, suffix: "g", sub: `Target ${TARGETS.protein}g` },
      { label: "Cal Goal Hits", val: calHits, sub: `${dailyData.length} tracked days` },
      { label: "Protein Hits", val: proteinHits, sub: `${dailyData.length} tracked days` },
    ];
  }, [tab, portfolio, looks, latestBody, weightDelta, bodyFatDelta, muscleDelta, workoutDays.length, exercises, lastWorkout, todayTotals.cal, todayTotals.pro, calHits, proteinHits, dailyData.length]);

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
          <Tab key="Looksmaxx" title="✨ Looksmaxx" />
        </Tabs>
      </div>

      {loading && <div className="state"><Spinner size="lg" color="primary" /><span>Loading your latest data…</span></div>}
      {error && <Card className="error"><CardBody>{error}</CardBody></Card>}

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

          <Card className="panel">
            <CardBody>
              <h3>Latest exercises (weight × reps)</h3>
              <div className="list">
                {latestExerciseEntries.map((e, i) => (
                  <div key={`${e.exercise}-${e.date}-${i}`} className="item">
                    <div>
                      <strong>{e.exercise}</strong>
                      <p className="muted">{e.date || "No date"} · {e.workoutType || "Workout"}</p>
                    </div>
                    <div className="right">{e.weight} lbs × {String(e.reps)}</div>
                  </div>
                ))}
                {!latestExerciseEntries.length && <p className="muted">No exercise entries yet.</p>}
              </div>
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

      {!loading && tab === "Looksmaxx" && (
        <div className="grid">
          <Card className="panel">
            <CardBody>
              <h3>Latest Daily Logs</h3>
              <div className="list">
                {(looks?.latestDaily || []).map((d, idx) => (
                  <div key={`${d.title}-${idx}`} className="item">
                    <div>
                      <strong>{d.title || "Untitled"}</strong>
                      <p className="muted">{d.date || "No date"}</p>
                    </div>
                  </div>
                ))}
                {!looks?.latestDaily?.length && <p className="muted">No daily entries found yet.</p>}
              </div>
            </CardBody>
          </Card>

          <Card className="panel">
            <CardBody>
              <h3>Goals & Milestones</h3>
              <div className="list">
                {(looks?.latestGoals || []).map((g, idx) => (
                  <div key={`${g.title}-${idx}`} className="item">
                    <div>
                      <strong>{g.title || "Untitled goal"}</strong>
                      <p className="muted">{g.status || "No status"}</p>
                    </div>
                  </div>
                ))}
                {!looks?.latestGoals?.length && <p className="muted">No goals found yet.</p>}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="mobile-nav">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "active" : ""}>
            {t === "Nutrition" ? "🍽️" : t === "Body Comp" ? "📊" : t === "Training" ? "🏋️" : t === "Portfolio" ? "📈" : "✨"}
            <span>{t}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
