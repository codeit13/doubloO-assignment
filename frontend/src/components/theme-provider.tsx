import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";
import { useDispatch, useSelector } from "react-redux";
import { setThemeMode } from "../store/slices/themeSlice";
import type { RootState } from "../store";

// Export useTheme for use in components
export const useTheme = useNextTheme;

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: string;
  attribute?: string;
  enableSystem?: boolean;
};

export function ThemeProvider({ 
  children, 
  defaultTheme = "dark",
  attribute = "class",
  enableSystem = true,
  ...props 
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute={attribute as "class"}
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      {...props}
    >
      <ThemeSynchronizer>{children}</ThemeSynchronizer>
    </NextThemesProvider>
  );
}

// Component to sync theme between next-themes and Redux
function ThemeSynchronizer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const reduxTheme = useSelector((state: RootState) => state.theme.mode);
  const { resolvedTheme: theme } = useNextTheme();
  
  // Sync Redux theme to next-themes on mount
  useEffect(() => {
    if (theme && theme !== reduxTheme) {
      dispatch(setThemeMode(theme as 'light' | 'dark' | 'system'));
    }
  }, [theme, reduxTheme, dispatch]);
  
  return <>{children}</>;
}
