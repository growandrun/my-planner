"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("theme")) as "dark" | "light" | null;
    const initial = saved === "light" ? "light" : "dark";
    setTheme(initial);
    apply(initial);
  }, []);

  function apply(t: "dark" | "light") {
    const root = document.documentElement;
    if (t === "light") root.classList.add("light");
    else root.classList.remove("light");
  }

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    localStorage.setItem("theme", next);
  }

  return (
    <button
      onClick={toggle}
      aria-label="테마 전환"
      className="fixed top-2 right-2 z-50 w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 shadow-lg flex items-center justify-center text-lg"
    >
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}
