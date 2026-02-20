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
  const [showFilters, setShowFilters] = useState(false);
  const [showDate, setShowDate] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [tempFrom, setTempFrom] = useState("");
  const [tempTo, setTempTo] = useState("");

  const [userType, setUserType] = useState("all");

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

      <div className="flex flex-wrap gap-3 mb-6 items-center">


        {/* Range Buttons */}

        {[
          { label: "12 months", value: "12m" },
          { label: "30 days", value: "30d" },
          { label: "7 days", value: "7d" },
          { label: "24 hours", value: "24h" },
        ].map((t) => (

          <button
            key={t.value}
            onClick={() => {
              setRange(t.value);
              setFromDate("");
              setToDate("");
            }}
            style={
              range === t.value
                ? { backgroundColor: "var(--brand-color)", color: "white", borderColor: "var(--brand-color)" }
                : {}
            }
            className={`
    px-3 py-1.5 border border-gray-600 rounded-lg text-sm
    transition
    hover:bg-gray-50 dark:hover:bg-neutral-700
    dark:text-gray-300
  `}
          >
            {t.label}
          </button>


        ))}


        {/* ================= RIGHT SIDE ================= */}

        <div className="ml-auto flex gap-2 relative">


          {/* Date Button */}

          <button
            onClick={() => setShowDate(!showDate)}
            className="px-3 py-1.5 border border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-neutral-700 dark:text-gray-300"
          >
            {fromDate && toDate
              ? `${fromDate} → ${toDate}`
              : "Select dates"}
          </button>


          {/* Date Panel */}

          {showDate && (
            <div
              className="
                absolute right-0 top-12 z-30
                bg-white border border-gray-600 rounded-xl shadow-lg
                p-4 w-72 dark:bg-neutral-800 dark:border-gray-700
              "
            >

              <p className="text-sm font-medium mb-3 dark:text-gray-300">
                Select Date Range
              </p>

              <div className="space-y-3">

                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-300">
                    From
                  </label>

                  <input
                    type="date"
                    value={tempFrom}
                    onChange={(e) => setTempFrom(e.target.value)}
                    className="w-[250px] md:w-full border border-gray-600 rounded px-3 py-2 text-sm dark:bg-neutral-700 dark:border-gray-600 dark:text-gray-300"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-300">
                    To
                  </label>

                  <input
                    type="date"
                    value={tempTo}
                    onChange={(e) => setTempTo(e.target.value)}
                    className="w-[250px] md:w-full border border-gray-600 rounded px-3 py-2 text-sm dark:bg-neutral-700 dark:border-gray-600 dark:text-gray-300"
                  />
                </div>

              </div>


              <div className="flex justify-end gap-2 mt-4">

                <button
                  onClick={() => {
                    setShowDate(false);
                    setTempFrom("");
                    setTempTo("");
                  }}
                  className="text-sm px-3 py-1.5 border border-gray-600 rounded dark:text-gray-300 dark:border-gray-600"
                >
                  Cancel
                </button>

                <button
                  onClick={() => {
                    setFromDate(tempFrom);
                    setToDate(tempTo);
                    setRange("");
                    setShowDate(false);
                  }}
                  disabled={!tempFrom || !tempTo}
                  className="
                   text-white
                    px-3 py-1.5 rounded text-sm
                    disabled:opacity-50
                  "
                  style={{ backgroundColor: "var(--brand-color)" }}
                >
                  Apply
                </button>

              </div>

            </div>
          )}


          {/* Filters Button */}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-1.5 border border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-neutral-700 dark:text-gray-300"
          >
            Filters
          </button>


          {/* Filters Panel */}

          {showFilters && (
            <div
              className="
                absolute right-0 top-12 z-20
                bg-white border border-gray-600 rounded-xl shadow-lg
                p-4 w-64 dark:bg-neutral-800 dark:border-gray-700
              "
            >

              <p className="text-sm font-medium mb-2 dark:text-gray-300">
                User Type
              </p>

              <select
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
                className="w-full border border-gray-600 rounded px-3 py-2 text-sm mb-4 dark:bg-neutral-700 dark:border-gray-700 dark:text-gray-300"
              >
                <option value="all">All Users</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>


              <button
                onClick={() => setShowFilters(false)}
                className="
                  w-full text-white
                  py-1.5 rounded-lg text-sm
                "
                style={{ backgroundColor: "var(--brand-color)" }}
              >
                Apply
              </button>

            </div>
          )}

        </div>

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
                fill="var(--brand-color)"
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
            className={`text-sm font-medium ${Number(growth) >= 0
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
