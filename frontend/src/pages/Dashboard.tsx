import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Play, History, Loader2 } from "lucide-react";
import { fetchAgentRuns } from "../store/slices/agentSlice";
import type { AppDispatch, RootState, AgentState } from "../store";

export default function Dashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const { runs, loading } = useSelector((state: RootState) => state.agent as AgentState);

  useEffect(() => {
    dispatch(fetchAgentRuns(3));
  }, [dispatch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Run Agent</CardTitle>
            <CardDescription>
              Submit a resume and job description to run the Recruiter AI agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/run-agent">
              <Button className="w-full">
                <Play className="mr-2 h-4 w-4" />
                Run Agent
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>View History</CardTitle>
            <CardDescription>
              View previous recruiter agent runs and their results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/history">
              <Button variant="outline" className="w-full">
                <History className="mr-2 h-4 w-4" />
                View History
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Recent Runs</h2>
          <Link to="/history">
            <Button variant="link">View all</Button>
          </Link>
        </div>
        
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : runs.length > 0 ? (
          <div className="grid gap-4">
            {runs.slice(0, 3).map((run: any) => (
              <Card key={run.id}>
                <CardHeader className="pb-2">
                  <CardTitle>{run.candidate_name}</CardTitle>
                  <CardDescription>
                    {new Date(run.timestamp).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="text-sm">
                      Status: <span className="font-medium">{run.status}</span>
                    </div>
                    <Link to={`/history?id=${run.id}`}>
                      <Button variant="outline" size="sm">View Details</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No recent runs found.</p>
              <Link to="/run-agent" className="mt-4 inline-block">
                <Button>Run your first agent</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
