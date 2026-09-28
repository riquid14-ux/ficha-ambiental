import React, { createContext, useContext, type ReactNode } from "react";

import { trpc } from "@/lib/trpc";
import { resolveBrandImage } from "@/lib/brand-images";

type BrandImageSettings = Record<string, string> | undefined;

const BrandImageSettingsContext = createContext<BrandImageSettings>(undefined);

/**
 * Faz uma única leitura cacheada das configurações de imagens institucionais.
 * Componentes isolados em testes continuam a usar o fallback oficial, sem
 * exigirem um Provider tRPC.
 */
export function BrandImageProvider({ children }: { children: ReactNode }) {
  const query = trpc.appSettings.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return React.createElement(
    BrandImageSettingsContext.Provider,
    { value: query.data },
    children,
  );
}

/** Resolução partilhada de imagem por página, com fallback institucional seguro. */
export function useBrandImage(pageKey: string) {
  const settings = useContext(BrandImageSettingsContext);
  return {
    ...resolveBrandImage(settings, pageKey),
    isLoading: false,
  };
}
