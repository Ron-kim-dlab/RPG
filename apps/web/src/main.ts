import "./style.css";
import { AppController } from "./AppController";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app container");
}

const app = new AppController(root);
void app.start();
