import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import { useDispatch } from "react-redux";
import { setThemeMode } from "../store/slices/themeSlice";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const dispatch = useDispatch();
  
  // Ensure component is mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Function to cycle through themes
  const cycleTheme = () => {
    if (resolvedTheme === "light") {
      setTheme("dark");
      dispatch(setThemeMode("dark"));
    } else if (resolvedTheme === "dark") {
      setTheme("light");
      dispatch(setThemeMode("light"));
    }
  };

  if (!mounted) return null;

  return (
    <Button 
      variant="outline" 
      size="icon" 
      onClick={cycleTheme}
      className="relative overflow-hidden transition-all duration-500 ease-in-out"
    >
      {/* Sun icon */}
      <Sun 
        className={`h-[1.2rem] w-[1.2rem] transition-all duration-500 ${
          resolvedTheme === "light" 
            ? "rotate-0 scale-100" 
            : "rotate-90 scale-0 absolute"
        }`} 
      />
      
      {/* Moon icon */}
      <Moon 
        className={`h-[1.2rem] w-[1.2rem] transition-all duration-500 ${
          resolvedTheme === "dark" 
            ? "rotate-0 scale-100" 
            : "rotate-90 scale-0 absolute"
        }`} 
      />
      
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
