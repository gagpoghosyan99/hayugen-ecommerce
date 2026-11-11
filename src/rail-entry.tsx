import { createRoot } from "react-dom/client";
import Showroom from "./showroom";
import "./rail.css";

const root = document.getElementById("home-selected");
if (root) {
  createRoot(root).render(<Showroom />);
}
