import { createBrowserRouter } from "react-router-dom";
import RootLayout from "../layouts/RootLayout";
import Dashboard from "../pages/Dashboard";
import RunAgent from "../pages/RunAgent";
import AgentHistory from "../pages/AgentHistory";
import NotFound from "../pages/NotFound";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <NotFound />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "run-agent",
        element: <RunAgent />,
      },
      {
        path: "history",
        element: <AgentHistory />,
      },
    ],
  },
]);

export default router;
