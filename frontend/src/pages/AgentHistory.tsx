import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Award, Briefcase, GraduationCap, User } from "lucide-react";
import { fetchAgentRuns } from "../store/slices/agentSlice";
import type { AppDispatch, RootState, AgentRun } from "../store";
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
    dispatch(fetchAgentRuns(50));
  }, [dispatch]);

  useEffect(() => {
    const runId = searchParams.get("id");
    if (runId) {
      setExpandedRuns(prev => [...prev, runId]);
    }
  }, [searchParams]);

  const handleRefresh = () => {
    dispatch(fetchAgentRuns(50));
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
        <h1 className="text-3xl font-bold tracking-tight">Candidates</h1>
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
            {runs.map((run: AgentRun, index: number) => {
              const matchScore = getMatchScore(run);
              const scoreColor = getScoreColor(matchScore);
              
              return (
                <AccordionItem 
                  key={index} 
                  value={index.toString()}
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
                      {/* Fit Assessment Section - Highlighted */}
                      {run.output?.fit_assessment && (
                        <Card className="border-2 border-primary/20 bg-primary/5 shadow-md">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center">
                              <Award className="h-5 w-5 mr-2 text-primary" />
                              Candidate Fit Assessment
                            </CardTitle>
                            <CardDescription>
                              {run.output.fit_assessment.fit_score || 
                                (matchScore >= 80 ? "Strong Fit" : 
                                 matchScore >= 60 ? "Moderate Fit" : "Low Fit")}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {/* Overall Score */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-medium">Overall Match</h4>
                                  <span className={cn("font-semibold", scoreColor)}>{matchScore}%</span>
                                </div>
                                <Progress 
                                  value={matchScore} 
                                  className={cn("h-2",
                                    matchScore >= 80 ? "[&>div]:bg-green-500" :
                                    matchScore >= 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
                                  )}
                                />
                                
                                {/* Score Details */}
                                {run.output.fit_assessment.score_details && (
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                                    {run.output.fit_assessment.score_details.experience_years && (
                                      <div className="bg-background rounded-md p-2 text-center">
                                        <div className="text-xs text-muted-foreground">Experience</div>
                                        <div className="font-medium">{run.output.fit_assessment.score_details.experience_years} years</div>
                                      </div>
                                    )}
                                    {run.output.fit_assessment.score_details.domain_signal && (
                                      <div className="bg-background rounded-md p-2 text-center">
                                        <div className="text-xs text-muted-foreground">Domain Signal</div>
                                        <div className="font-medium">{run.output.fit_assessment.score_details.domain_signal}</div>
                                      </div>
                                    )}
                                    <div className="bg-background rounded-md p-2 text-center">
                                      <div className="text-xs text-muted-foreground">Skill Match</div>
                                      <div className="font-medium">{matchScore}%</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Comparison Matrix */}
                              {run.output.fit_assessment.comparison_matrix && (
                                <div className="mt-4">
                                  <h5 className="text-sm font-medium mb-2">Skills Assessment</h5>
                                  <div className="bg-background rounded-md p-3 overflow-auto max-h-64">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b">
                                          <th className="text-left pb-2 font-medium">Required Skill</th>
                                          <th className="text-center pb-2 font-medium w-24">Match</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {run.output.fit_assessment.comparison_matrix.map((item: any, i: number) => (
                                          <tr key={i} className="border-b border-muted last:border-0">
                                            <td className="py-2">{item.skill}</td>
                                            <td className="py-2 text-center">
                                              {item.candidate_has ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-500 inline-block" />
                                              ) : (
                                                <XCircle className="h-5 w-5 text-red-500 inline-block" />
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                              
                              {/* Reasoning */}
                              {run.output.fit_assessment.reasoning && (
                                <div className="mt-4">
                                  <h5 className="text-sm font-medium mb-2">Assessment Reasoning</h5>
                                  <div className="bg-background rounded-md p-3 text-sm">
                                    <p className="text-muted-foreground">{run.output.fit_assessment.reasoning}</p>
                                  </div>
                                </div>
                              )}
                              
                              {/* Strengths & Gaps */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                {run.output.fit_assessment.strengths && (
                                  <div>
                                    <h5 className="text-sm font-medium mb-2">Strengths</h5>
                                    <ul className="space-y-1 bg-background rounded-md p-3">
                                      {run.output.fit_assessment.strengths.map((strength: string, i: number) => (
                                        <li key={i} className="text-sm flex items-start">
                                          <div className="mr-2 mt-0.5 text-green-500 flex-shrink-0">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                          </div>
                                          <span className="text-muted-foreground">{strength}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {run.output.fit_assessment.gaps && (
                                  <div>
                                    <h5 className="text-sm font-medium mb-2">Areas for Improvement</h5>
                                    <ul className="space-y-1 bg-background rounded-md p-3">
                                      {run.output.fit_assessment.gaps.map((gap: string, i: number) => (
                                        <li key={i} className="text-sm flex items-start">
                                          <div className="mr-2 mt-0.5 text-red-500 flex-shrink-0">
                                            <XCircle className="h-3.5 w-3.5" />
                                          </div>
                                          <span className="text-muted-foreground">{gap}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                              
                              {/* Recommendation */}
                              {run.output.fit_assessment.recommendation && (
                                <div className="mt-4 pt-4 border-t">
                                  <h5 className="text-sm font-medium mb-2 flex items-center">
                                    <Award className="h-4 w-4 mr-2" />
                                    Recommendation
                                  </h5>
                                  <p className="text-sm font-medium">{run.output.fit_assessment.recommendation}</p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
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
                              {run.output?.resume_structured?.skills_list && (
                                <div>
                                  <h5 className="text-sm font-medium mb-2">Skills</h5>
                                  <div className="flex flex-wrap gap-1.5">
                                    {run.output.resume_structured.skills_list.map((skill: string, i: number) => (
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
                      {run.output?.candidate_analysis?.summary && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Analysis</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <p className="text-sm whitespace-pre-line">{run.output.candidate_analysis.summary}</p>
                              
                              {run.output.candidate_analysis.strengths && (
                                <div className="mt-4">
                                  <h5 className="text-sm font-medium mb-2">Strengths</h5>
                                  <ul className="space-y-1">
                                    {run.output.candidate_analysis.strengths.map((strength: string, i: number) => (
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
                              
                              {run.output.candidate_analysis.weaknesses && (
                                <div className="mt-4">
                                  <h5 className="text-sm font-medium mb-2">Areas for Improvement</h5>
                                  <ul className="space-y-1">
                                    {run.output.candidate_analysis.weaknesses.map((weakness: string, i: number) => (
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
