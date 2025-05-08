import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Loader2, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Award, Briefcase, GraduationCap, User } from "lucide-react";
import { fetchAgentRuns, setCurrentRun } from "../store/slices/agentSlice";
import type { AppDispatch, RootState, AgentState, AgentRun } from "../store";
import { Badge } from "../components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Progress } from "../components/ui/progress";
import { cn } from "../lib/utils";

export default function AgentHistory() {
  const dispatch = useDispatch<AppDispatch>();
  const { runs, loading } = useSelector((state: RootState) => state.agent);
  const [searchParams] = useSearchParams();
  const [expandedRuns, setExpandedRuns] = useState<string[]>([]);

  useEffect(() => {
    dispatch(fetchAgentRuns(10));
  }, [dispatch]);

  useEffect(() => {
    const runId = searchParams.get("id");
    if (runId) {
      setExpandedRuns(prev => [...prev, runId]);
    }
  }, [searchParams]);

  const handleRefresh = () => {
    dispatch(fetchAgentRuns(10));
  };

  const getInitials = (run: any) => {
    const name = run.input?.candidate_name || "User";
    return name
      .split(" ")
      .map((part: string) => part[0])
      .join("")
      .toUpperCase();
  };
  
  const getMatchScore = (run: AgentRun) => {
    return run.output?.fit_assessment?.score_details?.skill_match_percentage || 0;
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-amber-500";
    return "text-red-500";
  };
  
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Agent History</h1>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
      
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : runs.length > 0 ? (
          <Accordion 
            type="multiple" 
            value={expandedRuns}
            onValueChange={setExpandedRuns}
            className="space-y-4"
          >
            {runs.map((run: AgentRun) => {
              const matchScore = getMatchScore(run);
              const scoreColor = getScoreColor(matchScore);
              
              return (
                <AccordionItem 
                  key={run.id} 
                  value={run.id}
                  className="border rounded-lg overflow-hidden shadow-sm"
                >
                  <AccordionTrigger className="px-6 py-4 hover:bg-accent/50 transition-colors">
                    <div className="flex flex-1 items-center">
                      <Avatar className="h-10 w-10 mr-4">
                        <AvatarFallback>{getInitials(run)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold truncate">
                            {run.input?.candidate_name || "Unknown Candidate"}
                          </h3>
                          <Badge 
                            className={cn("ml-2", scoreColor)}
                            variant="outline"
                          >
                            {matchScore}% Match
                          </Badge>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 mr-1" />
                          <span>{formatDate(run.timestamp)} at {formatTime(run.timestamp)}</span>
                          <span className="mx-2">•</span>
                          <Briefcase className="h-3.5 w-3.5 mr-1" />
                          <span className="truncate">{run.output?.jd_structured?.title || "N/A"}</span>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="space-y-6 mt-2">
                      {/* Match Score Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium flex items-center">
                            <Award className="h-4 w-4 mr-2" />
                            Match Score
                          </h4>
                          <span className={cn("font-semibold", scoreColor)}>{matchScore}%</span>
                        </div>
                        <Progress value={matchScore} className="h-2" />
                        <p className="text-sm text-muted-foreground mt-1">
                          {matchScore >= 80 ? (
                            <span className="flex items-center">
                              <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                              Strong match for this position
                            </span>
                          ) : matchScore >= 60 ? (
                            <span className="flex items-center">
                              <Clock className="h-4 w-4 mr-1 text-amber-500" />
                              Moderate match, may need additional skills
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <XCircle className="h-4 w-4 mr-1 text-red-500" />
                              Low match, missing key requirements
                            </span>
                          )}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Job Description Section */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center">
                              <Briefcase className="h-4 w-4 mr-2" />
                              Job Requirements
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <h5 className="text-sm font-medium mb-2">Required Qualifications</h5>
                                <ul className="space-y-1">
                                  {run.output?.jd_structured?.required_qualifications?.map((qual: string, i: number) => (
                                    <li key={i} className="text-sm flex items-start">
                                      <div className="mr-2 mt-0.5 text-primary">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                      </div>
                                      <span>{qual}</span>
                                    </li>
                                  )) || <li className="text-sm text-muted-foreground">No data available</li>}
                                </ul>
                              </div>
                              
                              {run.output?.jd_structured?.preferred_qualifications && (
                                <div>
                                  <h5 className="text-sm font-medium mb-2">Preferred Qualifications</h5>
                                  <ul className="space-y-1">
                                    {run.output.jd_structured.preferred_qualifications.map((qual: string, i: number) => (
                                      <li key={i} className="text-sm flex items-start">
                                        <div className="mr-2 mt-0.5 text-primary/70">
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                        </div>
                                        <span>{qual}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                        
                        {/* Resume Section */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center">
                              <User className="h-4 w-4 mr-2" />
                              Candidate Profile
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {run.output?.resume_structured?.skills && (
                                <div>
                                  <h5 className="text-sm font-medium mb-2">Skills</h5>
                                  <div className="flex flex-wrap gap-1.5">
                                    {run.output.resume_structured.skills.map((skill: string, i: number) => (
                                      <Badge key={i} variant="secondary" className="text-xs">
                                        {skill}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <div>
                                <h5 className="text-sm font-medium mb-2 flex items-center">
                                  <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                                  Experience
                                </h5>
                                <ul className="space-y-2">
                                  {run.output?.resume_structured?.experience?.map((exp: { title: string, company: string, duration?: string }, i: number) => (
                                    <li key={i} className="text-sm">
                                      <div className="font-medium">{exp.title}</div>
                                      <div className="text-muted-foreground flex items-center">
                                        <span>{exp.company}</span>
                                        {exp.duration && (
                                          <>
                                            <span className="mx-1">•</span>
                                            <span>{exp.duration}</span>
                                          </>
                                        )}
                                      </div>
                                    </li>
                                  )) || <li className="text-sm text-muted-foreground">No experience data available</li>}
                                </ul>
                              </div>
                              
                              {run.output?.resume_structured?.education && (
                                <div>
                                  <h5 className="text-sm font-medium mb-2 flex items-center">
                                    <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
                                    Education
                                  </h5>
                                  <ul className="space-y-2">
                                    {run.output.resume_structured.education.map((edu: { degree: string, institution: string, year?: string }, i: number) => (
                                      <li key={i} className="text-sm">
                                        <div className="font-medium">{edu.degree}</div>
                                        <div className="text-muted-foreground flex items-center">
                                          <span>{edu.institution}</span>
                                          {edu.year && (
                                            <>
                                              <span className="mx-1">•</span>
                                              <span>{edu.year}</span>
                                            </>
                                          )}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      
                      {/* Analysis Section */}
                      {run.output?.analysis && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Analysis</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <p className="text-sm whitespace-pre-line">{run.output.analysis}</p>
                              
                              {run.output.strengths && (
                                <div className="mt-4">
                                  <h5 className="text-sm font-medium mb-2">Strengths</h5>
                                  <ul className="space-y-1">
                                    {run.output.strengths.map((strength: string, i: number) => (
                                      <li key={i} className="text-sm flex items-start">
                                        <div className="mr-2 mt-0.5 text-green-500">
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                        </div>
                                        <span>{strength}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {run.output.weaknesses && (
                                <div className="mt-4">
                                  <h5 className="text-sm font-medium mb-2">Areas for Improvement</h5>
                                  <ul className="space-y-1">
                                    {run.output.weaknesses.map((weakness: string, i: number) => (
                                      <li key={i} className="text-sm flex items-start">
                                        <div className="mr-2 mt-0.5 text-red-500">
                                          <XCircle className="h-3.5 w-3.5" />
                                        </div>
                                        <span>{weakness}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No agent runs found.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
