"use client";

import { createContext, useContext, type ReactNode } from "react";
import { normalizeBrandColors } from "@/lib/brand-colors";

const AccountBrandColorsContext = createContext<string[]>([]);

export function AccountBrandColorsProvider({
  colors,
  children,
}: {
  colors: string[];
  children: ReactNode;
}) {
  return (
    <AccountBrandColorsContext.Provider value={normalizeBrandColors(colors)}>
      {children}
    </AccountBrandColorsContext.Provider>
  );
}

export function useAccountBrandColors() {
  return useContext(AccountBrandColorsContext);
}
