import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Shell from "./components/Shell.tsx";
import "./app.css";
import Applications from "./pages/Applications.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import CareerTwin from "./pages/CareerTwin.tsx";
import InterviewArena from "./pages/InterviewArena.tsx";
import OpportunityMirror from "./pages/OpportunityMirror.tsx";
import Passport from "./pages/Passport.tsx";
import PlacementTower from "./pages/PlacementTower.tsx";
import SkillSprint from "./pages/SkillSprint.tsx";
import { SessionProvider } from "./store/session.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
            <Route path="twin" element={<CareerTwin />} />
            <Route path="mirror" element={<OpportunityMirror />} />
            <Route path="sprint" element={<SkillSprint />} />
            <Route path="applications" element={<Applications />} />
            <Route path="arena" element={<InterviewArena />} />
            <Route path="passport" element={<Passport />} />
            <Route path="tower" element={<PlacementTower />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
);
