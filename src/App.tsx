import { useCallback, useEffect, useMemo, useState } from "react";
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

const TARGETS = { calories: 2800, protein: 170, caloriesMin: 2700 };
const MEAL_ORDER: Record<string, number> = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3, Shake: 4 };
const MEAL_EMOJI: Record<string, string> = { Breakfast: "🌅", Lunch: "🌞", Dinner: "🌙", Snack: "🍫", Shake: "🥤" };
const SRC_CLR: Record<string, string> = { "Ideal Nutrition": "success", Restaurant: "danger", Homemade: "primary", Supplement: "secondary", Other: "default" };

export default function App() {
  const [tab, setTab] = useState("Nutrition");
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

  const dailyData = useMemo(() => {
    const byDate: Record<string, { date: string; calories: number; protein: number; label: string }> = {};
    meals.forEach((m) => {
      if (!m.date) return;
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, calories: 0, protein: 0, label: new Date(`${m.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
      byDate[m.date].calories += m.calories || 0;
      byDate[m.date].protein += m.protein || 0;
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [meals]);

  const todayTotals = todayMeals.reduce((a, m) => ({ cal: a.cal + (m.calories || 0), pro: a.pro + (m.protein || 0) }), { cal: 0, pro: 0 });
  const avgCal = dailyData.length ? Math.round(dailyData.reduce((s, d) => s + d.calories, 0) / dailyData.length) : 0;
  const avgPro = dailyData.length ? Math.round(dailyData.reduce((s, d) => s + d.protein, 0) / dailyData.length) : 0;

  const exercises = useMemo(() => {
    const byEx: Record<string, TrainingEntry[]> = {};
    training.forEach((e) => {
      if (!e.exercise) return;
      if (!byEx[e.exercise]) byEx[e.exercise] = [];
      byEx[e.exercise].push(e);
    });
    return Object.entries(byEx).map(([name, entries]) => {
      const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
      return { name, latest: sorted[sorted.length - 1], first: sorted[0] };
    });
  }, [training]);

  return (
    <div className="page">
      <div className="hero">
        <div>
          <h1>💪 Fitness Command Center</h1>
          <p>{data?.updatedAt ? `Last sync ${new Date(data.updatedAt).toLocaleTimeString()}` : "Connect to Notion to begin"}</p>
        </div>
        <Button color="primary" variant="shadow" onPress={() => void fetchAll()}>
          Refresh
        </Button>
      </div>

      <div className="kpis">
        <Card><CardBody><p>Today Calories</p><h3>{todayTotals.cal}</h3><small>Target {TARGETS.calories}</small></CardBody></Card>
        <Card><CardBody><p>Today Protein</p><h3>{todayTotals.pro}g</h3><small>Target {TARGETS.protein}g</small></CardBody></Card>
        <Card><CardBody><p>Avg Calories</p><h3>{avgCal}</h3><small>{dailyData.filter((d) => d.calories >= TARGETS.caloriesMin).length}/{dailyData.length} days hit</small></CardBody></Card>
        <Card><CardBody><p>Avg Protein</p><h3>{avgPro}g</h3><small>Consistency trend</small></CardBody></Card>
      </div>

      <div className="tab-wrap">
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => setTab(String(key))}
          aria-label="Dashboard tabs"
          color="primary"
          variant="underlined"
        >
          <Tab key="Nutrition" title="🍽️ Nutrition" />
          <Tab key="Body Comp" title="📊 Body Comp" />
          <Tab key="Training" title="🏋️ Training" />
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
                        <Chip size="sm" color={SRC_CLR[m.source || "Other"] as "default"}>{m.source || "Other"}</Chip>
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
              <h3>Calorie trend</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2b3250" />
                  <XAxis dataKey="label" tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#96a0c8", fontSize: 11 }} />
                  <Tooltip />
                  <ReferenceLine y={TARGETS.calories} stroke="#22c55e" strokeDasharray="5 5" />
                  <Bar dataKey="calories" radius={[6, 6, 0, 0]}>
                    {dailyData.map((d, i) => <Cell key={i} fill={d.calories >= TARGETS.caloriesMin ? "#22c55e" : "#6366f1"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>
      )}

      {!loading && tab === "Body Comp" && (
        <Card className="panel">
          <CardBody>
            <h3>Body composition trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={bodyComp.map((d) => ({ ...d, label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b3250" />
                <XAxis dataKey="label" tick={{ fill: "#96a0c8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#96a0c8", fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="weight" stroke="#60a5fa" strokeWidth={2.5} />
                <Line type="monotone" dataKey="muscleMass" stroke="#34d399" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
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
                        <p className="muted">Latest: {ex.latest.weight} lbs × {ex.latest.reps}</p>
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
                <AreaChart data={bodyComp.map((d) => ({ ...d, label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) }))}>
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
    </div>
  );
}
