export default function App() {
  const { loading } = useAuth();

  /* ================= AUTO REFRESH TOKEN ================= */
  useEffect(() => {
    const refreshAccessToken = async () => {
      try {
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL}/refresh`,
          {},
          { withCredentials: true }
        );

        setToken(res.data.accessToken);
      } catch (err) {
        console.log("No refresh token available");
      }
    };

    refreshAccessToken();
  }, []);

  return (
    <>
      {/* Global Loader (Auth) */}
      {loading && <GlobalLoader />}

      {/* Lazy Loader */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        }
      >
        <Routes>

          {/* ================= PUBLIC ================= */}
          <Route path="/" element={<Auth />} />

          {/* ================= PROTECTED ================= */}
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/profile" element={<Profile />} />

            <Route
              path="/dashboard/users"
              element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              }
            />

            <Route
              path="/dashboard/settings"
              element={<Settings />}
            />
          </Route>

          {/* ================= FALLBACK ================= */}
          <Route
            path="*"
            element={<Navigate to="/dashboard" replace />}
          />

        </Routes>
      </Suspense>
    </>
  );
}
