import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import {
  Users,
  BadgeCheck,
  BadgeX,
} from "lucide-react";

import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from "recharts";

/* ================= TYPES ================= */

interface Stats {
  totalUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  systemStatus: string;
  security: string;
}

export default function Dashboard() {

  /* ================= STATE ================= */

  const [chartData, setChartData] = useState<any[]>([]);
  const [range, setRange] = useState("12m");

  const [stats, setStats] = useState<Stats | null>(null);


  const [loadingChart, setLoadingChart] = useState(true);

  const { role } = useAuth();

  /* ================= LOAD DATA ================= */

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingChart(true);

        const res = await api.get("/user-stats", {
          params: { range },
        });

        setStats(res.data.summary);
        setChartData(res.data.chart);

      } catch (err) {
        console.error("Dashboard load failed", err);
      } finally {
        setLoadingChart(false);
      }
    };

    loadData();
  }, [range]);

  /* ================= GROWTH CALCULATION ================= */

  const calculateGrowth = () => {
    if (!chartData || chartData.length < 2) return 0;

    const last = chartData[chartData.length - 1].users;
    const prev = chartData[chartData.length - 2].users;

    if (prev === 0) return 100;
    return (((last - prev) / prev) * 100).toFixed(1);
  };

  const growth = calculateGrowth();

  /* ================= UI ================= */

  return (
    <>
      {/* ================= HEADER ================= */}

      <div className="mb-6">
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--brand-color)" }}
        >
          {role === "admin" && "Admin Dashboard"}
          {role === "broker" && "Broker Dashboard"}
          {role === "client" && "Client Dashboard"}
        </h2>

        <p className="text-gray-500 text-sm dark:text-gray-300">
          Your current system overview.
        </p>
      </div>

      {/* ================= RANGE BUTTONS ================= */}

      <div className="flex gap-3 mb-6">
        {[
          { label: "12 months", value: "12m" },
          { label: "30 days", value: "30d" },
          { label: "7 days", value: "7d" },
          { label: "24 hours", value: "24h" },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setRange(t.value)}
            style={
              range === t.value
                ? {
                    backgroundColor: "var(--brand-color)",
                    color: "white",
                  }
                : {}
            }
            className="px-3 py-1.5 border border-gray-600 rounded-lg text-sm transition"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ================= LINE CHART ================= */}

      <div className="bg-white rounded-xl shadow-sm p-6 mb-8 dark:bg-neutral-800">
        <h3 className="text-sm font-medium mb-4 dark:text-gray-300">
          User Growth
        </h3>

        <div className="h-[260px] relative">
          {loadingChart && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-500"></div>
            </div>
          )}

          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="name" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="users"
                stroke="var(--brand-color)"
                strokeWidth={3}
                dot={false}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ================= STACKED BAR CHART ================= */}

      <div className="bg-white rounded-xl shadow-sm p-6 mb-8 dark:bg-neutral-800">
        <h3 className="text-sm font-medium mb-4 dark:text-gray-300">
          Verified vs Unverified
        </h3>

        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="users"
                stackId="a"
                fill="#4f46e5"
                animationDuration={800}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ================= INFO CARDS ================= */}

      <div className="grid md:grid-cols-3 gap-6">

        <InfoCard
          icon={<Users size={20} />}
          title="Total Users"
          value={stats?.totalUsers}
          growth={growth}
          color="indigo"
        />

        <InfoCard
          icon={<BadgeCheck size={20} />}
          title="Verified Users"
          value={stats?.verifiedUsers}
          color="green"
        />

        <InfoCard
          icon={<BadgeX size={20} />}
          title="Unverified Users"
          value={stats?.unverifiedUsers}
          color="red"
        />

      </div>
    </>
  );
}

/* ================= INFO CARD ================= */

function InfoCard({ title, value, color, icon, growth }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 dark:bg-neutral-800">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: "var(--brand-color)" }}>{icon}</span>
        <h4 className="text-gray-500 text-sm dark:text-gray-300">
          {title}
        </h4>
      </div>

      <div className="flex items-end gap-3">
        <p
          className={`
            text-2xl font-bold
            ${color === "green" && "text-green-600"}
            ${color === "red" && "text-red-600"}
            ${color === "indigo" && "text-indigo-600"}
          `}
        >
          {value}
        </p>

        {growth && (
          <span
            className={`text-sm font-medium ${
              Number(growth) >= 0
                ? "text-green-500"
                : "text-red-500"
            }`}
          >
            {Number(growth) >= 0 ? "+" : ""}
            {growth}%
          </span>
        )}
      </div>
    </div>
  );
}

