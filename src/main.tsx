import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
			// best-effort; app should still run without SW
		});
	});
}

createRoot(document.getElementById("root")!).render(<App />);
