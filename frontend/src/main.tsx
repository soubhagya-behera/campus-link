import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import WorkspaceLayout from "./components/WorkspaceLayout.tsx";
import "./app.css";
import Landing from "./landing/Landing.tsx";
import NotFound from "./landing/NotFound.tsx";
import Login from "./login/Login.tsx";
import Register from "./register/Register.tsx";
import Applications from "./pages/Applications.tsx";
import ApplicantReview from "./pages/ApplicantReview.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import CareerTwin from "./pages/CareerTwin.tsx";
import InterviewArena from "./pages/InterviewArena.tsx";
import Notifications from "./pages/Notifications.tsx";
import OpportunityMirror from "./pages/OpportunityMirror.tsx";
import Passport from "./pages/Passport.tsx";
import PlacementTower from "./pages/PlacementTower.tsx";
import SkillSprint from "./pages/SkillSprint.tsx";
import StaffAnnouncements from "./pages/StaffAnnouncements.tsx";
import StaffArena from "./pages/StaffArena.tsx";
import StudentDirectory from "./pages/StudentDirectory.tsx";
import StudentProfile from "./pages/StudentProfile.tsx";

/**
 * Routes:
 *   /            public landing page (no API dependency)
 *   /login       public sign-in (no live session required to view)
 *   /register    public student registration (email-verified signup)
 *   /app         student workspace overview
 *   /twin … /tower  the existing authenticated pages, unchanged
 *
 * /login and /register render OUTSIDE the session gate below, so a signed-out
 * visitor can always reach them and no redirect loop is possible.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<WorkspaceLayout />}>
          <Route path="app" element={<Dashboard />} />
          <Route path="twin" element={<CareerTwin />} />
          <Route path="mirror" element={<OpportunityMirror />} />
          <Route path="sprint" element={<SkillSprint />} />
          <Route path="applications" element={<Applications />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="tower/applications/:applicationId" element={<ApplicantReview />} />
          <Route path="tower/announcements" element={<StaffAnnouncements />} />
          <Route path="tower/arena" element={<StaffArena />} />
          <Route path="tower/students" element={<StudentDirectory />} />
          <Route path="tower/students/:studentId" element={<StudentProfile />} />
          <Route path="arena" element={<InterviewArena />} />
          <Route path="passport" element={<Passport />} />
          <Route path="tower" element={<PlacementTower />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
