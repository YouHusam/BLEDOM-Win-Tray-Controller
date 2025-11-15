import { createRouter, createWebHashHistory } from "vue-router";
import ControlView from "./views/ControlView.vue";
import ScanView from "./views/ScanView.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      name: "control",
      component: ControlView
    },
    {
      path: "/scan",
      name: "scan",
      component: ScanView
    }
  ]
});
