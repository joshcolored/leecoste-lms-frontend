import { useEffect, useState, type JSX } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  ShieldUser,
  Smile,
  BriefcaseBusiness,
} from "lucide-react";

import {
  Search,
  Trash2,
  MoreVertical,
} from "lucide-react";
import UsersSkeleton from "../skeletons/UsersSkeleton";

/* ================= TYPES ================= */

interface UserItem {
  id: string;
  email: string;
  role: string;
  createdAt?: any;
}

/* ================= COMPONENT ================= */

export default function Users() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] =
    useState<string | null>(null);

  const [confirmBox, setConfirmBox] = useState<{
    type: "single" | "bulk";
    ids: string[];
  } | null>(null);

  /* Pagination */
  const [page, setPage] = useState(1);
  const perPage = 8;

  /* ================= LOAD ================= */
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true); // start loading

    try {
      const snap = await getDocs(collection(db, "users"));

      setUsers(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false); // stop loading AFTER fetch
    }
  };

  /* ================= RESET PAGE ON FILTER ================= */

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  /* ================= FILTER ================= */

  const filteredUsers = users.filter((u) => {
    const keyword = search.toLowerCase();

    const name = u.email?.split("@")[0] || "";

    const matchesSearch =
      u.email?.toLowerCase().includes(keyword) ||
      u.role?.toLowerCase().includes(keyword) ||
      name.toLowerCase().includes(keyword);

    const matchesRole =
      roleFilter === "all" || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  /* ================= PAGINATION ================= */

  const totalPages = Math.ceil(
    filteredUsers.length / perPage
  );

  const pagedUsers = filteredUsers.slice(
    (page - 1) * perPage,
    page * perPage
  );

  /* ================= SELECT ================= */

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selected.length === pagedUsers.length) {
      setSelected([]);
    } else {
      setSelected(pagedUsers.map((u) => u.id));
    }
  };

  /* ================= DELETE ================= */

  const deleteUser = (id: string) => {
    setConfirmBox({
      type: "single",
      ids: [id],
    });
  };

  const deleteSelected = () => {
    if (!selected.length) return;

    setConfirmBox({
      type: "bulk",
      ids: selected,
    });
  };

  const confirmDelete = async () => {
    if (!confirmBox) return;

    for (const id of confirmBox.ids) {
      await fetch(
        `http://172.30.2.13:5000/api/users/${id}`,
        { method: "DELETE" }
      );
    }

    setUsers((prev) =>
      prev.filter(
        (u) => !confirmBox.ids.includes(u.id)
      )
    );

    setSelected([]);
    setConfirmBox(null);
  };

  /* ================= HELPERS ================= */

  const avatar = (email: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      email
    )}&background=random`;

  const formatDate = (d: any) => {
    if (!d) return "—";

    const date = d.toDate?.() || new Date(d);

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatRole = (role: string) => {
    if (!role) return "";

    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };



  if (loading) return <UsersSkeleton />;






  /* ================= UI ================= */

  return (
    <div className="space-y-4">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-3">

        {/* CONFIRM TOAST */}
        {confirmBox && (
          <div
            className="
              fixed top-16 right-6 z-[999]
              bg-white border rounded-xl shadow-xl
              p-4 w-[280px] dark:bg-neutral-800 dark:border-gray-700
            "
          >

            <p className="text-sm font-medium mb-3 dark:text-gray-300">
              {confirmBox.type === "single"
                ? "Delete this user?"
                : `Delete ${confirmBox.ids.length} users?`}
            </p>

            <div className="flex justify-end gap-2">

              <button
                onClick={() => setConfirmBox(null)}
                className="
                  px-3 py-1.5 text-sm
                  rounded-lg border
                  hover:bg-gray-50 dark:hover:bg-neutral-700
                  dark:border-gray-700 dark:text-gray-300
                "
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                className="
                  px-3 py-1.5 text-sm
                  rounded-lg bg-red-600 text-white
                  hover:bg-red-700
                "
              >
                Delete
              </button>

            </div>
          </div>
        )}

        <h2 className="text-xl font-bold dark:text-gray-300">
          Users
        </h2>

        <div className="flex gap-2 w-full sm:w-auto">

          {/* ROLE FILTER */}
          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value)
            }
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--brand-color)";
              e.currentTarget.style.boxShadow = `0 0 0 2px var(--brand-color)40`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#d1d5db5a";
              e.currentTarget.style.boxShadow = "none";
            }}
            className="
              border rounded-lg px-3 py-2 text-sm
              text-gray-900 focus:outline-none
              outline-none bg-white dark:bg-neutral-800 dark:border-gray-700 dark:text-gray-300
            "
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="broker">Broker</option>
            <option value="user">User</option>
          </select>

          {/* SEARCH */}
          <div className="relative flex-1 sm:w-64 ">

            <Search
              size={18}
              className="
                absolute left-3 top-2.5
                text-gray-800 pointer-events-none dark:text-gray-300
              "
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search users..."
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--brand-color)";
                e.currentTarget.style.boxShadow = `0 0 0 2px var(--brand-color)40`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#d1d5db5a";
                e.currentTarget.style.boxShadow = "none";
              }}
              className="
                w-full pl-9 pr-3 py-2
                border rounded-lg text-sm
                text-gray-900 focus:outline-none
                outline-none bg-white dark:bg-neutral-800 dark:border-gray-700 dark:text-gray-300
              "
            />
          </div>

          {/* BULK DELETE */}
          {selected.length > 0 && (
            <button
              onClick={deleteSelected}
              className="
                px-3 py-2 border rounded-lg
                text-red-600 text-sm
                hover:bg-red-50
                dark:hover:bg-neutral-900
                dark:bg-neutral-800
                dark:border-gray-500
                flex gap-1 items-center
              "
            >
              <Trash2 size={16} />
              {selected.length}
            </button>
          )}

        </div>
      </div>
      {/* ================= TABLE MOBILE ================= */}
      {/* MOBILE LIST */}
      <div className="md:hidden space-y-3">

        {pagedUsers.length === 0 && (
          <div className="p-6 text-center text-gray-500 text-sm dark:text-gray-400">
            No users found.
          </div>
        )}

        {pagedUsers.map((u) => (
          <div
            key={u.id}
            className="bg-white dark:bg-neutral-800 rounded-xl p-4 shadow space-y-3"
          >
            <div className="flex items-center gap-3">

              <img
                src={avatar(u.email)}
                className="w-10 h-10 rounded-full"
              />

              <div className="flex-1">
                <p className="text-sm font-semibold dark:text-gray-300">
                  {u.email.split("@")[0]}
                </p>
                <p className="text-xs text-gray-400">
                  {u.email}
                </p>
              </div>

              <Badge text={formatRole(u.role)} />
            </div>

            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Added: {formatDate(u.createdAt)}</span>
              <span>Active: {formatDate(u.createdAt)}</span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => toggleSelect(u.id)}
              />

              <button
                onClick={() => deleteUser(u.id)}
                className="text-red-600 text-sm"
              >
                Delete
              </button>
            </div>

          </div>
        ))}

      </div>


      {/* TABLE DESKTOP*/}
      <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden dark:bg-neutral-800">

        {/* HEAD */}
        <div
          className="
            grid grid-cols-[40px_2fr_1fr_1fr_1fr_40px]
            gap-3 px-4 py-3
            text-xs font-semibold text-gray-500
            border-b bg-gray-50 dark:bg-neutral-700 dark:border-gray-700
          "
        >

          <input
            type="checkbox"
            checked={
              pagedUsers.length > 0 &&
              selected.length === pagedUsers.length
            }
            onChange={selectAll}
          />

          <span className="dark:text-gray-300">User</span>
          <span className="dark:text-gray-300">Role</span>
          <span className="dark:text-gray-300">Last Active</span>
          <span className="dark:text-gray-300">Date Added</span>
          <span className="dark:text-gray-300" />


        </div>

        {/* NO RESULTS */}
        {pagedUsers.length === 0 && (
          <div className="p-6 text-center text-gray-500 text-sm dark:text-gray-400">
            No users found.
          </div>
        )}

        {/* ROWS */}
        {pagedUsers.map((u) => (
          <div
            key={u.id}
            className="
              grid grid-cols-[40px_2fr_1fr_1fr_1fr_40px]
              gap-3 px-4 py-3 items-center
              border-b hover:bg-gray-50 
              relative dark:border-gray-700 dark:hover:bg-neutral-700
            "
          >

            <input
              type="checkbox"
              checked={selected.includes(u.id)}
              onChange={() =>
                toggleSelect(u.id)
              }
            />

            {/* USER */}
            <div className="flex gap-3">

              <img
                src={avatar(u.email)}
                className="w-9 h-9 rounded-full"
              />

              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-300">
                  {u.email.split("@")[0]}
                </p>

                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {u.email}
                </p>
              </div>

            </div>

            <Badge text={formatRole(u.role)} />

            <span className="text-sm text-gray-500 dark:text-gray-400">
              {formatDate(u.createdAt)}
            </span>

            <span className="text-sm text-gray-500 dark:text-gray-400">
              {formatDate(u.createdAt)}
            </span>

            {/* MENU */}
            <div className="relative">

              <button
                onClick={() =>
                  setActiveMenu(
                    activeMenu === u.id
                      ? null
                      : u.id
                  )
                }
                className="p-2 hover:bg-gray-100 rounded dark:hover:bg-neutral-700 dark:text-gray-300"
              >
                <MoreVertical size={18} />
              </button>

              {activeMenu === u.id && (
                <div
                  className="
                    absolute right-0 top-full mt-2
                    bg-white border rounded-lg
                    shadow-lg w-32 z-50
                  "
                >

                  <button
                    onClick={() => {
                      deleteUser(u.id);
                      setActiveMenu(null);
                    }}
                    className="
                      w-full px-4 py-2 text-left
                      text-sm text-red-600
                      hover:bg-red-50
                    "
                  >
                    Delete
                  </button>

                </div>
              )}

            </div>

          </div>
        ))}

      </div>

      {/* PAGINATION */}
      <div className="flex justify-between">

        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          className="px-3 py-1 border rounded 
             dark:border-gray-700 
             dark:bg-neutral-800 
             dark:text-gray-300 
             disabled:opacity-50 
             disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <div className="flex gap-1">

          {Array.from(
            { length: totalPages },
            (_, i) => i + 1
          ).map((n) => (

            <button
              key={n}
              onClick={() => setPage(n)}
              style={{
                backgroundColor:
                  page === n
                    ? "var(--brand-color)"
                    : undefined,
                color:
                  page === n ? "#fff" : undefined,
              }}
              className={`
    w-8 h-8 rounded
    text-gray-700
    dark:text-neutral-300
    hover:bg-gray-200
    dark:hover:bg-neutral-700
    transition-colors
  `}
            >
              {n}
            </button>

          ))}

        </div>

        <button
          disabled={page === totalPages}
          onClick={() =>
            setPage((p) => p + 1)
          }
          className="px-3 py-1 border rounded 
             dark:border-gray-700 
             dark:bg-neutral-800 
             dark:text-gray-300 
             disabled:opacity-50 
             disabled:cursor-not-allowed"
        >

          Next
        </button>

      </div>

    </div>
  );
}

/* ================= BADGE ================= */

function Badge({ text }: { text: string }) {

  const role = text.toLowerCase();

  const config: Record<
    string,
    {
      bg: string;
      icon: JSX.Element;
      shadow: string;
    }
  > = {
    admin: {
      bg: "bg-yellow-500",
      shadow: "hover:shadow-yellow-400/50",
      icon: <ShieldUser size={12} color="#ffffff" />,
    },
    client: {
      bg: "bg-sky-500",
      shadow: "hover:shadow-sky-400/50",
      icon: <Smile size={12} color="#ffffff" />,
    },
    broker: {
      bg: "bg-green-500",
      shadow: "hover:shadow-green-400/50",
      icon: <BriefcaseBusiness size={12} color="#ffffff" />,
    },
  };

  const item = config[role];

  return (
    <span
      className={`
        inline-flex items-center gap-1
        text-xs px-2 py-1 rounded-full
        font-medium text-white w-[70px] text-center
        cursor-default

        transition-all duration-200 ease-out
        hover:scale-105 hover:shadow-lg

        ${item?.bg || "bg-gray-400"}
        ${item?.shadow || ""}
      `}
    >
      {item?.icon}

      <span>{text}</span>
    </span>
  );
}
