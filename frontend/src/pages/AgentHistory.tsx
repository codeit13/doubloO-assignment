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
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex flex-row sm:flex-row items-start sm:items-center justify-between gap-4">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Candidates</span>
        <Button variant="outline" onClick={handleRefresh} disabled={loading} className="self-end sm:self-auto">
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
                  className="border rounded-lg overflow-hidden shadow-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-shadow duration-200"
                >
                  <AccordionTrigger className="px-4 sm:px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                    <div className="flex flex-1 items-center w-full overflow-hidden">
                      <Avatar className="h-10 w-10 mr-3 sm:mr-4 flex-shrink-0 bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-300">
                        <AvatarFallback>{getInitials(run)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                          <h3 className="text-base sm:text-lg font-semibold truncate text-zinc-900 dark:text-zinc-50">
                            {run.input?.candidate_name || "Unknown Candidate"}
                          </h3>
                          <Badge 
                            className={cn("self-start sm:self-auto sm:ml-2 text-xs sm:text-sm", scoreColor)}
                            variant="outline"
                          >
                            {matchScore}% Match
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                          <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                          <span className="mr-2">{formatDate(run.timestamp)} at {formatTime(run.timestamp)}</span>
                          <span className="hidden sm:inline mx-1">•</span>
                          <div className="flex items-center mt-1 sm:mt-0">
                            <Briefcase className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                            <span className="truncate max-w-[200px] sm:max-w-[300px]">{run.output?.jd_structured?.title || "N/A"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 sm:px-6 pb-6">
                    <div className="space-y-6 mt-2">
                      {/* Fit Assessment Section - Highlighted */}
                      {run.output?.fit_assessment && (
                        <Card className="border-2 border-teal-200 dark:border-teal-800/30 bg-teal-50/50 dark:bg-teal-900/10 shadow-md">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center">
                              <Award className="h-5 w-5 mr-2 text-teal-600 dark:text-teal-400" />
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
                              <div className="space-y-2 bg-white dark:bg-zinc-900/50 rounded-md p-3 shadow-sm">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Overall Match</h4>
                                  <span className={cn("font-semibold", scoreColor)}>{matchScore}%</span>
                                </div>
                                <Progress 
                                  value={matchScore} 
                                  className={cn("h-2 bg-zinc-200 dark:bg-zinc-800",
                                    matchScore >= 80 ? "[&>div]:bg-green-500" :
                                    matchScore >= 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
                                  )}
                                />
                                
                                {/* Score Details */}
                                {run.output.fit_assessment.score_details && (
                                  <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                                    {run.output.fit_assessment.score_details.experience_years && (
                                      <div className="bg-white dark:bg-zinc-900/50 rounded-md p-2 text-center shadow-sm">
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Experience</div>
                                        <div className="font-medium text-zinc-800 dark:text-zinc-200">{run.output.fit_assessment.score_details.experience_years} years</div>
                                      </div>
                                    )}
                                    {run.output.fit_assessment.score_details.domain_signal && (
                                      <div className="bg-white dark:bg-zinc-900/50 rounded-md p-2 text-center shadow-sm">
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Domain Signal</div>
                                        <div className="font-medium text-zinc-800 dark:text-zinc-200">{run.output.fit_assessment.score_details.domain_signal}</div>
                                      </div>
                                    )}
                                    <div className="bg-white dark:bg-zinc-900/50 rounded-md p-2 text-center shadow-sm">
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400">Skill Match</div>
                                      <div className="font-medium">{matchScore}%</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Comparison Matrix */}
                              {run.output.fit_assessment.comparison_matrix && (
                                <div className="mt-4">
                                  <h5 className="text-sm font-medium mb-2">Skills Assessment</h5>
                                  <div className="bg-white dark:bg-zinc-900/50 rounded-md p-3 overflow-auto max-h-64 shadow-sm">
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
                                  <div className="bg-white dark:bg-zinc-900/50 rounded-md p-3 text-sm shadow-sm">
                                    <p className="text-muted-foreground">{run.output.fit_assessment.reasoning}</p>
                                  </div>
                                </div>
                              )}
                              
                              {/* Strengths & Gaps */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                {run.output.fit_assessment.strengths && (
                                  <div>
                                    <h5 className="text-sm font-medium mb-2">Strengths</h5>
                                    <ul className="space-y-1 bg-white dark:bg-zinc-900/50 rounded-md p-3 shadow-sm">
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
                                    <ul className="space-y-1 bg-white dark:bg-zinc-900/50 rounded-md p-3 shadow-sm">
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        {/* Job Description Section */}
                        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md transition-shadow duration-200">
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
                                  <ul className="space-y-1 bg-white dark:bg-zinc-900/50 rounded-md p-3 shadow-sm">
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
                        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md transition-shadow duration-200">
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
                                  <div className="flex flex-wrap gap-1.5 bg-white dark:bg-zinc-900/50 rounded-md p-3 shadow-sm">
                                    {run.output.resume_structured.skills_list.map((skill: string, i: number) => (
                                      <Badge key={i} variant="secondary" className="text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-800/30">
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
                                <ul className="space-y-2 bg-white dark:bg-zinc-900/50 rounded-md p-3 shadow-sm">
                                  {run.output?.resume_structured?.experience?.map((exp: { title: string, company: string, duration?: string }, i: number) => (
                                    <li key={i} className="text-sm">
                                      <div className="font-medium">{exp.title}</div>
                                      <div className="text-zinc-500 dark:text-zinc-400 flex items-center text-xs sm:text-sm">
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
                                  <ul className="space-y-2 bg-white dark:bg-zinc-900/50 rounded-md p-3 shadow-sm">
                                    {run.output.resume_structured.education.map((edu: { degree: string, institution: string, year?: string }, i: number) => (
                                      <li key={i} className="text-sm">
                                        <div className="font-medium text-zinc-800 dark:text-zinc-200">{edu.degree}</div>
                                        <div className="text-zinc-500 dark:text-zinc-400 flex items-center text-xs sm:text-sm">
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
                        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md transition-shadow duration-200">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Analysis</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <p className="text-sm whitespace-pre-line text-zinc-700 dark:text-zinc-300">{run.output.candidate_analysis.summary}</p>
                              
                              {run.output.candidate_analysis.strengths && (
                                <div className="mt-4">
                                  <h5 className="text-sm font-medium mb-2">Strengths</h5>
                                  <ul className="space-y-1 bg-white dark:bg-zinc-900/50 rounded-md p-3 shadow-sm">
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
                                  <ul className="space-y-1 bg-white dark:bg-zinc-900/50 rounded-md p-3 shadow-sm">
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
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">No agent runs found.</p>
              <Button variant="outline" onClick={handleRefresh} className="mt-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Data
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
