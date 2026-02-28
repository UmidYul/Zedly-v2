import { Moon, Sun } from "lucide-react";
import type { ThemeMode } from "../../lib/theme";

interface ThemeToggleButtonProps {
  theme: ThemeMode;
  onToggle: () => void;
}

export function ThemeToggleButton({ theme, onToggle }: ThemeToggleButtonProps) {
  return (
    <button type="button" className="theme-toggle" onClick={onToggle} aria-label="Toggle theme">
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

