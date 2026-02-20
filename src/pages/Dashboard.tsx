import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import DashboardSkeleton from "../skeletons/DashboardSkeleton";
import {
  Users,
  BadgeCheck,
  BadgeX,
  // Clock

} from "lucide-react";

import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* API Stats */
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

  const [loading, setLoading] = useState(true);

  // const [sessionType, setSessionType] = useState("Temporary");
  // const [expiresIn, setExpiresIn] = useState("");

  const { role } = useAuth();


  /* ================= LOAD STATS ================= */

  useEffect(() => {
    axios
      .get("http://172.30.2.13:5000/api/stats")
      .then((res) => setStats(res.data))
      .finally(() => setLoading(false));
  }, []);


  /* ================= SESSION ================= */

  // useEffect(() => {

  //   const session = localStorage.getItem("auth_session");

  //   if (!session) return;

  //   const data = JSON.parse(session);

  //   if (data.remember) {

  //     setSessionType("Persistent");

  //     const daysLeft =
  //       30 -
  //       Math.floor(
  //         (Date.now() - data.loginAt) /
  //         (1000 * 60 * 60 * 24)
  //       );

  //     setExpiresIn(`${daysLeft} days left`);

  //   } else {

  //     setSessionType("Temporary");
  //     setExpiresIn("");

  //   }

  // }, []);


  /* ================= LOAD CHART ================= */

  useEffect(() => {

    axios
      .get("http://172.30.2.13:5000/api/user-stats", {
        params: {
          range,
          from: fromDate,
          to: toDate,
          type: userType,
        },
      })
      .then((res) => setChartData(res.data))
      .catch(() => console.log("Chart load failed"));

  }, [range, fromDate, toDate, userType]);


  /* ================= LOADING ================= */

  if (loading) return <DashboardSkeleton />;


  /* ================= UI ================= */

  return (
    <>

      {/* ================= HEADER ================= */}

      <div className="mb-6">

        <h2 className="text-2xl font-bold" style={{ color: "var(--brand-color)" }}>
          {role === "admin" && "Admin Dashboard"}

          {role === "broker" && "Broker Dashboard"}

          {role === "client" && "Client Dashboard"}
        </h2>


        <p className="text-gray-500 text-sm dark:text-gray-300">
          Your current system overview.
        </p>

      </div>


      {/* ================= FILTER BAR ================= */}

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


      {/* ================= CHART ================= */}

      <div className="bg-white rounded-xl shadow-sm p-6 mb-8 dark:bg-neutral-800">

        <div className="h-[260px]">

          <ResponsiveContainer width="100%" height="100%">

            <LineChart data={chartData}>

              <XAxis dataKey="name" />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="users"
                stroke={"var(--brand-color)"}
                strokeWidth={3}
                dot={false}
              />

            </LineChart>

          </ResponsiveContainer>

        </div>

      </div>


      {/* ================= INFO CARDS ================= */}

      <div className="grid md:grid-cols-3 gap-6 mb-8">

        <InfoCard
          icon={<Users size={20} />}
          title="Total Users"
          value={stats?.totalUsers}
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

        {/* <InfoCard
          icon={<Clock size={20} />}
          title="Session"
          value={sessionType}
          sub={expiresIn}
        /> */}

      </div>

    </>
  );
}


/* ================= COMPONENTS ================= */


function InfoCard({ title, value, color, sub, icon }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col dark:bg-neutral-800">

      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: "var(--brand-color)" }}>{icon}</span>
        <h4 className="text-gray-500 text-sm dark:text-gray-300">{title}</h4>
      </div>

      <p
        className={`
          text-2xl font-bold mt-2
          ${color === "green" && "text-green-600"}
          ${color === "red" && "text-red-600"}
          ${color === "indigo" && "text-indigo-600"}
        `}
      >
        {value}
      </p>

      {sub && (
        <p className="text-sm text-gray-300 mt-1 hidden dark:text-gray-300">{sub}</p>
      )}

    </div>
  );
}
