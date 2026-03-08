import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { MqttProvider } from "./providers/MqttProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MqttProvider>
      <App />
    </MqttProvider>
  </StrictMode>
);
