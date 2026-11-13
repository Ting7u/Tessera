import type { ThemeName } from "@shared/types";
import type { SliceCreator } from "../types";

export interface ThemeSlice {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

export const createThemeSlice: SliceCreator<ThemeSlice> = (set) => ({
  theme: "dark",
  setTheme: (theme) => set({ theme }),
});
