import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

export default function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem("theme") as ThemeMode) || "system";
  });

  const [brandColor, setBrandColor] = useState<string>(() => {
    return localStorage.getItem("brand-color") || "#7F56D9";
  });

  /* ================= APPLY THEME ================= */
  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      if (theme === "dark") {
        root.classList.add("dark");
      } else if (theme === "light") {
        root.classList.remove("dark");
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.toggle("dark", prefersDark);
      }
    };

    applyTheme();
    localStorage.setItem("theme", theme);
  }, [theme]);

  /* ================= APPLY BRAND COLOR ================= */
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--brand-color",
      brandColor
    );
    localStorage.setItem("brand-color", brandColor);
  }, [brandColor]);

    const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";

    setTheme(next);

    document.documentElement.classList.toggle(
      "dark",
      next === "dark"
    );

    localStorage.setItem("theme", next);
  };

  return {
    theme,
    setTheme,
    brandColor,
    setBrandColor,
    toggleTheme,
  };
}
