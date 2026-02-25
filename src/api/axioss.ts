import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,

  withCredentials: true,
});

let accessToken: string | null = null;

export const setToken = (token: string) => {
  accessToken = token;
};

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/refresh`,
        {},
        { withCredentials: true }
      );

      setToken(res.data.accessToken);

      original.headers.Authorization = `Bearer ${res.data.accessToken}`;

      return api(original);
    }

    return Promise.reject(err);
  }
);

export default api;
