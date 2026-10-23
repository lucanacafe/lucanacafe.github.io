import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "@/app/App";
import { SiteProvider } from "@/app/SiteContext";
import "@/styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <SiteProvider>
        <App />
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            className: "!bg-night-800 !border-white/10 !text-smoke-50 !rounded-2xl",
          }}
        />
      </SiteProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
