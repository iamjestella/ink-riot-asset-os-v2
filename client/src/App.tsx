import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import AssetCatalog from "./pages/AssetCatalog";
import AssetDetail from "./pages/AssetDetail";
import Bundles from "./pages/Bundles";
import BundleDetail from "./pages/BundleDetail";
import SocialCalendar from "./pages/SocialCalendar";
import EmailAgent from "./pages/EmailAgent";
import Settings from "./pages/Settings";
import GoogleDriveCallback from "./pages/GoogleDriveCallback";
import BundleDownload from "./pages/BundleDownload";

function DashboardRouter() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/catalog"} component={AssetCatalog} />
      <Route path={"/catalog/:id"} component={AssetDetail} />
      <Route path={"/bundles"} component={Bundles} />
      <Route path={"/bundles/:id"} component={BundleDetail} />
      <Route path={"/social"} component={SocialCalendar} />
      <Route path={"/email"} component={EmailAgent} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Switch>
            {/* Public routes — no dashboard/auth wrapper */}
            <Route path="/download/:id" component={BundleDownload} />
            {/* Google OAuth callback — must be public so Google can redirect here before session is established */}
            <Route path="/auth/google/callback" component={GoogleDriveCallback} />
            {/* All other routes — inside DashboardLayout with auth */}
            <Route>
              <DashboardLayout>
                <DashboardRouter />
              </DashboardLayout>
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
