import React, { createContext, useContext, useEffect, useState } from "react";

export type DeploymentMode = "oss" | "cloud";

interface ConfigContextValue {
  mode: DeploymentMode;
  isLoaded: boolean;
}

const ConfigContext = createContext<ConfigContextValue>({
  mode: "oss",
  isLoaded: false,
});

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<DeploymentMode>("oss");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.mode === "cloud") setMode("cloud");
      })
      .catch(() => {
        // default to oss on error
      })
      .finally(() => setIsLoaded(true));
  }, []);

  return (
    <ConfigContext.Provider value={{ mode, isLoaded }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextValue {
  return useContext(ConfigContext);
}
