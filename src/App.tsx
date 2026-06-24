import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { isPasswordRecoveryUrl, passwordRecoveryRedirectPath } from "@/lib/authUtils";
import Landing from "./pages/Landing";

// Lazy-loaded routes — keeps Konva/Recharts/etc out of the initial bundle
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Editor = lazy(() => import("./pages/Editor"));
const PublicViewer = lazy(() => import("./pages/PublicViewer"));
const Analytics = lazy(() => import("./pages/Analytics"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminContacts = lazy(() => import("./pages/AdminContacts"));
const AdminJobs = lazy(() => import("./pages/AdminJobs"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const FlyerPortal = lazy(() => import("./pages/FlyerPortal"));
const PublicFlyerPortal = lazy(() => import("./pages/PublicFlyerPortal"));
const SubmitJob = lazy(() => import("./pages/SubmitJob"));
const MyJobs = lazy(() => import("./pages/MyJobs"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const EditJob = lazy(() => import("./pages/EditJob"));
const WaiterPortal = lazy(() => import("./pages/WaiterPortal"));
const Examples = lazy(() => import("./pages/Examples"));
const AdminExamples = lazy(() => import("./pages/AdminExamples"));
const AdminEditors = lazy(() => import("./pages/AdminEditors"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminMiniAds = lazy(() => import("./pages/AdminMiniAds"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid spinner flashes from re-fetching on every tab focus / remount.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const FullScreenSpinner = () => (
  <div className="flex h-screen items-center justify-center bg-background">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

/** Send recovery email links to the reset form even when Supabase lands on /dashboard or /auth. */
function PasswordRecoveryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPasswordRecoveryUrl()) return;
    if (location.pathname === "/auth/reset-password") return;
    navigate(passwordRecoveryRedirectPath(), { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PasswordRecoveryRedirect />
          <Suspense fallback={<FullScreenSpinner />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/editor/:flyerId" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
              <Route path="/analytics/:flyerId" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/preview/:flyerId" element={<ProtectedRoute><PublicViewer previewMode /></ProtectedRoute>} />
              <Route path="/f/:slug" element={<PublicViewer />} />
              <Route path="/admin" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/contacts" element={<ProtectedRoute><AdminContacts /></ProtectedRoute>} />
              <Route path="/admin/jobs" element={<ProtectedRoute><AdminJobs /></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute><AdminAnalytics /></ProtectedRoute>} />
              <Route path="/submit-job" element={<ProtectedRoute><SubmitJob /></ProtectedRoute>} />
              <Route path="/my-jobs" element={<ProtectedRoute><MyJobs /></ProtectedRoute>} />
              <Route path="/my-jobs/:jobId" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
              <Route path="/my-jobs/:jobId/edit" element={<ProtectedRoute><EditJob /></ProtectedRoute>} />
              <Route path="/flyer/:flyerId/portal" element={<ProtectedRoute><FlyerPortal /></ProtectedRoute>} />
              <Route path="/p/:token" element={<PublicFlyerPortal />} />
              <Route path="/w/:token" element={<WaiterPortal />} />
              <Route path="/examples" element={<Examples />} />
              <Route path="/admin/examples" element={<ProtectedRoute><AdminExamples /></ProtectedRoute>} />
              <Route path="/admin/editors" element={<ProtectedRoute><AdminEditors /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
