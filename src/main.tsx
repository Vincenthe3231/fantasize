import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "tippy.js/dist/tippy.css";
import { ensureDraftIndexedDbOpened } from "@/lib/spaceDraftStorage";

void ensureDraftIndexedDbOpened();

createRoot(document.getElementById("root")!).render(<App />);
