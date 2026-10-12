import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import WorkspaceLayout from "./components/WorkspaceLayout.tsx";
import "./app.css";
import Landing from "./landing/Landing.tsx";
import NotFound from "./landing/NotFound.tsx";
import Applications from "./pages/Applications.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import CareerTwin from "./pages/CareerTwin.tsx";
import InterviewArena from "./pages/InterviewArena.tsx";
import OpportunityMirror from "./pages/OpportunityMirror.tsx";
import Passport from "./pages/Passport.tsx";
import PlacementTower from "./pages/PlacementTower.tsx";
import SkillSprint from "./pages/SkillSprint.tsx";

/**
 * Routes:
 *   /            public landing page (no API dependency)
 *   /app         student workspace overview
 *   /twin … /tower  the existing authenticated pages, unchanged
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<WorkspaceLayout />}>
          <Route path="app" element={<Dashboard />} />
          <Route path="twin" element={<CareerTwin />} />
          <Route path="mirror" element={<OpportunityMirror />} />
          <Route path="sprint" element={<SkillSprint />} />
          <Route path="applications" element={<Applications />} />
          <Route path="arena" element={<InterviewArena />} />
          <Route path="passport" element={<Passport />} />
          <Route path="tower" element={<PlacementTower />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
