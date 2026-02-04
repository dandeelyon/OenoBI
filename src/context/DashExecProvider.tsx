import React, { createContext, useContext } from "react";
import { useDashExec, DashExecPayload } from "../hooks/useDashExec";

type DashExecState = {
  data: DashExecPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const DashExecContext = createContext<DashExecState>({
  data: null,
  loading: true,
  error: null,
  refresh: async () => {},
});

export function DashExecProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useDashExec();
  return <DashExecContext.Provider value={value}>{children}</DashExecContext.Provider>;
}

export function useDashExecContext() {
  return useContext(DashExecContext);
}
