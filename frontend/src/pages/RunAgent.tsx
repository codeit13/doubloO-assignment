import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { 
  Loader2, CheckCircle2, XCircle, Clock, User, GraduationCap, Briefcase, Award,
  Upload, FileText, File as FileIcon, X, Cpu, Brain, Bot, Sparkles, ArrowRight 
} from "lucide-react";
import { runAgent, pollTaskStatus, setPollingActive } from "../store/slices/agentSlice";
import type { AppDispatch, RootState, AgentState } from "../store";
// Import TaskStatus type to ensure proper type checking
import type { TaskStatus } from "../store/slices/agentSlice";
import { cn } from "../lib/utils";

// Helper function to get the color class based on score percentage
const getScoreColorClass = (score: number): string => {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
};

// Random Progress Bar Component
interface RandomProgressBarProps {
  status: string;
}

const RandomProgressBar = ({ status }: RandomProgressBarProps) => {
  const [progress, setProgress] = useState(10);
  
  useEffect(() => {
    // Start with a low value for pending, higher for running
    const initialValue = status === 'running' ? 30 : 10;
    setProgress(initialValue);
    
    // Random progress animation
    const interval = setInterval(() => {
      setProgress(current => {
        // Calculate the max progress based on status
        const maxProgress = status === 'running' ? 85 : 60;
        
        // If we're close to the max, slow down the progress
        if (current > maxProgress - 10) {
          // Small random increment (0-1%)
          return Math.min(current + Math.random(), maxProgress);
        }
        
        // Random increment (0-5%)
        const increment = Math.random() * (status === 'running' ? 5 : 3);
        return Math.min(current + increment, maxProgress);
      });
    }, 800); // Update every 800ms
    
    return () => clearInterval(interval);
  }, [status]);
  
  // Get color based on status
  const getColorClass = () => {
    if (status === 'running') return 'bg-teal-500';
    return 'bg-amber-500';
  };
  
  return (
    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div 
        className={`h-full ${getColorClass()} transition-all duration-500 ease-out`}
        style={{ width: `${progress}%` }}
      >
        {/* Animated gradient overlay */}
        <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
      </div>
    </div>
  );
};

interface FileItem {
  file: File | null;
  name: string;
  type: string;
  size?: number;
  preview?: string;
}

// Using Tailwind CSS teal color classes instead of custom variables

export default function RunAgent() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, currentTask, pollingActive } = useSelector((state: RootState) => state.agent as AgentState);
  
  const [candidateName, setCandidateName] = useState("");
  const [resume, setResume] = useState<FileItem>({ file: null, name: "", type: "" });
  const [jobDescription, setJobDescription] = useState<FileItem>({ file: null, name: "", type: "" });
  const [resumeInputMethod, setResumeInputMethod] = useState<"file" | "text">("file");
  const [jobDescriptionInputMethod, setJobDescriptionInputMethod] = useState<"file" | "text">("file");
  const [resumeText, setResumeText] = useState("");
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const pollingIntervalRef = useRef<number | null>(null);
  
  // Simulated AI thinking effect
  useEffect(() => {
    if (loading) {
      setAiThinking(true);
    } else {
      setAiThinking(false);
    }
  }, [loading]);
  
  // Get a user-friendly status message
  const getStatusMessage = () => {
    if (!currentTask) return "";
    
    // Use type assertion to handle the 'retrying' status
    const status = currentTask.status as string;
    
    switch (status) {
      case "pending":
        return "Preparing to analyze resume and job description...";
      case "running":
        return "AI is analyzing the resume and job description...";
      case "completed":
        return "Analysis completed! Redirecting to results...";
      case "failed":
        return `Error: ${currentTask.error || "Unknown error occurred"}`;  
      case "retrying":
        // Use optional chaining and nullish coalescing for safe access
        return `Connection issue detected. Retrying... (Attempt ${(currentTask as any).attempt || 1})`;  
      default:
        return "Processing...";
    }
  };
  
  // Get color class based on task status
  const getStatusColorClass = () => {
    if (!currentTask) return "";
    
    // Use type assertion to handle the 'retrying' status
    const status = currentTask.status as string;
    
    switch (status) {
      case "completed":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      case "retrying":
        return "text-amber-500";
      default:
        return "text-primary";
    }
  };
  
  // Set up polling for task status
  useEffect(() => {
    // Clear any existing interval when component unmounts or when polling state changes
    return () => {
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);
  
  // Start polling when a task is created with exponential backoff
  useEffect(() => {
    if (pollingActive && currentTask?.task_id) {
      // Start the polling process with the first request
      dispatch(pollTaskStatus({ taskId: currentTask.task_id, attempt: 1 }));
    }
    
    // Clean up interval when component unmounts
    return () => {
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [pollingActive, currentTask?.task_id, dispatch]);
  
  // No longer navigating to history page when task is completed
  // Instead, we'll show the results directly in this component

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "resume" | "jobDescription") => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (type === "resume") {
        setResume({
          file,
          name: file.name,
          type: file.type,
          size: file.size
        });
      } else {
        setJobDescription({
          file,
          name: file.name,
          type: file.type,
          size: file.size
        });
      }
    }
  };

  const removeFile = (type: "resume" | "jobDescription") => {
    if (type === "resume") {
      setResume({ file: null, name: "", type: "" });
    } else {
      setJobDescription({ file: null, name: "", type: "" });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: "resume" | "jobDescription") => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (type === "resume") {
        setResume({
          file,
          name: file.name,
          type: file.type,
          size: file.size
        });
      } else {
        setJobDescription({
          file,
          name: file.name,
          type: file.type,
          size: file.size
        });
      }
    }
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!candidateName) {
      toast.error("Please enter candidate name");
      return;
    }
    
    // Validate resume input
    if (resumeInputMethod === "file" && !resume.file) {
      toast.error("Please upload a resume file");
      return;
    }
    
    if (resumeInputMethod === "text" && !resumeText) {
      toast.error("Please enter resume text");
      return;
    }
    
    // Validate job description input
    if (jobDescriptionInputMethod === "file" && !jobDescription.file) {
      toast.error("Please upload a job description file");
      return;
    }
    
    if (jobDescriptionInputMethod === "text" && !jobDescriptionText) {
      toast.error("Please enter job description text");
      return;
    }
    
    const formData = new FormData();
    formData.append("candidate_name", candidateName);
    
    // Handle resume submission with separate parameters for file and text
    if (resumeInputMethod === "file" && resume.file) {
      // Check if file has content before sending
      if (resume.file.size > 0) {
        formData.append("resume", resume.file);
      } else {
        toast.error("Resume file is empty. Please upload a valid file.");
        return;
      }
    } else if (resumeInputMethod === "text") {
      // Send the text with the new parameter name
      formData.append("resume_text", resumeText);
    } else {
      toast.error("Resume is required");
      return;
    }
    
    // Handle job description submission with separate parameters for file and text
    if (jobDescriptionInputMethod === "file" && jobDescription.file) {
      // Check if file has content before sending
      if (jobDescription.file.size > 0) {
        formData.append("job_description", jobDescription.file);
      } else {
        toast.error("Job description file is empty. Please upload a valid file.");
        return;
      }
    } else if (jobDescriptionInputMethod === "text") {
      // Send the text with the new parameter name
      formData.append("job_description_text", jobDescriptionText);
    } else {
      toast.error("Job description is required");
      return;
    }
    
    try {
      const result = await dispatch(runAgent(formData)).unwrap();
      toast.success("Agent run started successfully");
      
      // Show a toast with the task ID
      toast.info(`Task ID: ${result.task_id}`);
      
      // Start polling for task status
      dispatch(setPollingActive(true));
      
      // Don't navigate away immediately, let the polling handle the navigation
      // when the task is completed
      if (result.status === 'completed') {
        navigate("/history");
      }
    } catch (error: any) {
      console.error("Error submitting form:", error);
      
      // Display the detailed error message from the API if available
      if (typeof error === 'string') {
        toast.error(error);
      } else if (error && error.message) {
        toast.error(error.message);
      } else {
        toast.error("Failed to run agent. Please try again.");
      }
    }
  };

  // Helper function to get icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileIcon className="h-8 w-8 text-red-500" />;
    if (fileType.includes('doc')) return <FileIcon className="h-8 w-8 text-blue-500" />;
    if (fileType.includes('txt')) return <FileText className="h-8 w-8 text-gray-500" />;
    return <FileIcon className="h-8 w-8 text-teal-500" />;
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between bg-gradient-to-b from-teal-900/20 to-teal-600/0 dark:from-teal-900/40 dark:to-teal-600/0 p-6 rounded-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.8))] opacity-20"></div>
        <div className="relative z-10 flex items-center gap-4">
        <div className="relative z-10">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-teal-600/30 flex items-center justify-center">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-teal-500/40 flex items-center justify-center">
              <div className="w-6 h-6 md:w-10 md:h-10 rounded-full bg-teal-400/50 flex items-center justify-center">
                {/* <div className="w-6 h-6 rounded-full bg-teal-300/60 animate-ping"></div> */}
                <div className="bg-teal-600 p-3 rounded-full bg-teal-300/60 animate-ping">
                  <Brain className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              AI Recruiter Agent
            </h1>
            <div className="hidden md:flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="outline" className="bg-teal-900 text-teal-300 border-teal-900/30">
                <Cpu className="h-3 w-3 mr-1" /> Intelligent Analysis
              </Badge>
              <Badge variant="outline" className="bg-teal-900 text-teal-300 border-teal-900/30">
                <Bot className="h-3 w-3 mr-1" /> Resume Parsing
              </Badge>
              <Badge variant="outline" className="bg-teal-900 text-teal-300 border-teal-900/30">
                <Sparkles className="h-3 w-3 mr-1" /> Candidate Matching
              </Badge>
            </div>
          </div>
        </div>
       
      </div>
      
      <form onSubmit={handleSubmit}>

          {/* Candidate Name Card */}
           <div className="space-y-2 mt-10">
                <Label htmlFor="candidate_name" className="text-slate-700 dark:text-slate-200">
                  Candidate Name
                </Label>
                <Input
                  id="candidate_name"
                  placeholder="Enter candidate name"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="bg-zinc-100 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-700 focus:border-teal-500 focus:ring-teal-500/20 placeholder:text-zinc-400"
                />
              </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Resume Card */}
          <Card className="overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-teal-50 to-white dark:from-teal-900/10 dark:to-zinc-900/30 backdrop-blur-sm hover:shadow-md dark:hover:shadow-teal-600/20 transition-all duration-300 gap-4 pb-2 h-fit">
            <CardHeader className="border-b border-primary/30">
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <div className="bg-teal-500/20 p-1.5 rounded-md">
                  <FileIcon className="h-4 w-4 text-teal-500" />
                </div>
                Resume
              </CardTitle>
              <CardDescription className="text-primary/70">
                Upload or enter candidate's resume
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="resume-switch" className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span>Upload File</span>
                    <Badge variant="outline" className="bg-teal-500/10 text-teal-500 border-teal-500/30 capitalize tracking-wider">
                      {resumeInputMethod}
                    </Badge>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Text</span>
                    <Switch 
                      id="resume-switch" 
                      checked={resumeInputMethod === "file"}
                      onCheckedChange={(checked) => setResumeInputMethod(checked ? "file" : "text")}
                      className="data-[state=checked]:bg-teal-500"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">File</span>
                  </div>
                </div>
                
                {resumeInputMethod === "file" ? (
                  !resume.file ? (
                    <div
                      className="border-2 border-dashed border-primary/30 rounded-lg p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-primary/10 transition-all"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, "resume")}
                      onClick={() => document.getElementById("resume-upload")?.click()}
                    >
                      <Upload className="h-10 w-10 text-primary/50" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Drag & drop resume file or click to browse</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Supports PDF, DOCX, TXT files</p>
                      </div>
                      <input
                        id="resume-upload"
                        type="file"
                        accept=".pdf,.docx,.doc,.txt"
                        onChange={(e) => handleFileChange(e, "resume")}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 relative border border-primary/20">
                      <button
                        type="button"
                        onClick={() => removeFile("resume")}
                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary/10 dark:bg-primary/10 flex items-center justify-center hover:bg-primary hover:text-white transition-all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/20 p-2 rounded">
                          {getFileIcon(resume.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-slate-700 dark:text-slate-200">{resume.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(resume.size)}</p>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <Textarea
                    placeholder="Paste or type resume text here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    className="min-h-[150px] max-h-[150px] resize-none bg-primary/20 border-primary/30 focus:border-primary focus:ring-primary/20 placeholder:text-primary/70"
                  />
                )}
              </div>
            </CardContent>
          </Card>
         
          {/* Job Description Card - Spans full width */}
          <Card className="overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-teal-50 to-white dark:from-teal-900/10 dark:to-zinc-900/30 backdrop-blur-sm hover:shadow-md dark:hover:shadow-teal-600/20 transition-all duration-300 gap-4 pb-2 h-fit">
            <CardHeader className="border-b border-primary/30">
              <CardTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                <div className="bg-teal-500/20 p-1.5 rounded-md">
                  <FileText className="h-4 w-4 text-teal-500" />
                </div>
                Job Description
              </CardTitle>
              <CardDescription className="text-primary/70">
                Provide the job description as a file or text
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="job-description-switch" className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span>Upload File</span>
                    <Badge variant="outline" className="bg-teal-500/10 text-teal-500 border-teal-500/30 capitalize tracking-wider">
                      {jobDescriptionInputMethod}
                    </Badge>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Text</span>
                    <Switch 
                      id="job-description-switch" 
                      checked={jobDescriptionInputMethod === "file"}
                      onCheckedChange={(checked) => setJobDescriptionInputMethod(checked ? "file" : "text")}
                      className="data-[state=checked]:bg-teal-500"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">File</span>
                  </div>
                </div>
                
                {jobDescriptionInputMethod === "file" ? (
                  !jobDescription.file ? (
                    <div
                      className="border-2 border-dashed border-primary/30 rounded-lg p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-primary/10 transition-all"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, "jobDescription")}
                      onClick={() => document.getElementById("job-description-upload")?.click()}
                    >
                      <Upload className="h-10 w-10 text-primary/50" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Drag & drop job description file or click to browse</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Supports PDF, DOCX, TXT files</p>
                      </div>
                      <input
                        id="job-description-upload"
                        type="file"
                        accept=".pdf,.docx,.doc,.txt"
                        onChange={(e) => handleFileChange(e, "jobDescription")}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 relative border border-primary/20">
                      <button
                        type="button"
                        onClick={() => removeFile("jobDescription")}
                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary/10 dark:bg-primary/10 flex items-center justify-center hover:bg-primary hover:text-white transition-all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/20 p-2 rounded">
                          {getFileIcon(jobDescription.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-slate-700 dark:text-slate-200">{jobDescription.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(jobDescription.size)}</p>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <Textarea
                    placeholder="Paste or type job description here..."
                    value={jobDescriptionText}
                    onChange={(e) => setJobDescriptionText(e.target.value)}
                    className="min-h-[150px] max-h-[150px] resize-none bg-primary/20 border-primary/30 focus:border-primary focus:ring-primary/20 placeholder:text-primary/70"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Button Card */}
        <Card className="mt-6 overflow-hidden border-0 bg-gradient-to-t from-teal-900/20 to-teal-600/0 dark:from-teal-900/30 dark:to-teal-600/0 shadow-lg transition-all duration-300 relative">
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.8))] opacity-20"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
              <div className="space-y-3">
                <h3 className="text-xl font-medium text-slate-900 dark:text-white flex items-center gap-2">
                  <Brain className="h-5 w-5 text-teal-500" />
                  Candidate AI Analysis
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  Our AI agent will analyze the resume against the job description to evaluate candidate fit.
                </p>
                <div className="hidden md:flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-teal-400 animate-pulse"></div>
                    <span>Intelligent matching</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-teal-300 animate-pulse"></div>
                    <span>Detailed analysis</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-teal-200 animate-pulse"></div>
                    <span>Skill assessment</span>
                  </div>
                </div>
              </div>
              
              <div className="relative w-full md:w-fit">
                {aiThinking && (
                  <div className="absolute -top-3 -left-3 right-0 bottom-0 bg-teal-500/20 rounded-full blur-xl animate-pulse"></div>
                )}
                <Button 
                  type="submit" 
                  className={cn(
                    `w-full md:w-auto transition-all bg-gradient-to-r from-teal-500 to-teal-600 border border-teal-400/30 text-white hover:shadow-[0_0_15px_rgba(0,173,173,0.5)] cursor-pointer`,
                    loading ? "opacity-90" : "hover:scale-105"
                  )} 
                  disabled={loading}
                  size="lg"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Loader2 className="h-5 w-5 animate-spin text-teal-200" />
                        <div className="absolute inset-0 h-5 w-5 rounded-full border-2 border-teal-300/30 animate-ping"></div>
                      </div>
                      <span>AI Processing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-teal-100" />
                      <span>Run Agent</span>
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </div>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Task Status Display */}
            {currentTask && (
              <div className="mt-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center">
                  {/* Use type assertion to handle the 'retrying' status */}
                  {(currentTask.status as string) === 'completed' ? (
                    <CheckCircle2 className="mr-2 h-5 w-5 text-green-500" />
                  ) : (currentTask.status as string) === 'failed' ? (
                    <XCircle className="mr-2 h-5 w-5 text-red-500" />
                  ) : (currentTask.status as string) === 'retrying' ? (
                    <Loader2 className={`mr-2 h-5 w-5 ${getStatusColorClass()} animate-spin`} />
                  ) : (
                    <Loader2 className="mr-2 h-5 w-5 text-teal-500 animate-spin" />
                  )}
                  <div className={`font-medium text-slate-800 dark:text-slate-200 ${getStatusColorClass()}`}>
                    Task Status: {(currentTask.status as string).charAt(0).toUpperCase() + (currentTask.status as string).slice(1)}
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{getStatusMessage()}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Task ID: {currentTask.task_id}</p>
                
                {/* Show additional info for retrying state */}
                {(currentTask.status as string) === 'retrying' && (
                  <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                    <p>Network issue detected. Automatically retrying connection to the server...</p>
                  </div>
                )}
                
                {/* Animated Random Progress Bar */}
                {((currentTask.status as string) === 'pending' || (currentTask.status as string) === 'running' || (currentTask.status as string) === 'retrying') && (
                  <div className="mt-2">
                    <RandomProgressBar status={(currentTask.status as string) === 'retrying' ? 'pending' : currentTask.status} />
                  </div>
                )}
                
                {/* Static Progress Bar for completed tasks */}
                {(currentTask.status === 'completed') && (
                  <Progress 
                    className="mt-2 h-1" 
                    value={100} 
                  />
                )}
                
                {/* Show results when task is completed */}
                {currentTask.status === 'completed' && currentTask.result && (
                  <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h3 className="text-lg font-medium text-teal-800 dark:text-teal-200 mb-3">Results</h3>

                    {/* Fit Assessment - Highlighted */}
                    {currentTask.result.fit_assessment && (
                      <div className="mb-4 border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 rounded-lg shadow-md overflow-hidden">
                        <div className="bg-slate-100 dark:bg-slate-800/30 px-4 py-3">
                          <h4 className="text-md font-medium text-slate-800 dark:text-slate-200 flex items-center">
                            <Award className="h-5 w-5 mr-2 text-teal-600 dark:text-teal-400" /> 
                            Candidate Fit Assessment
                          </h4>
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            {currentTask.result.fit_assessment.fit_score || 
                              (currentTask.result.fit_assessment.score_details?.skill_match_percentage >= 80 ? "Strong Fit" : 
                               currentTask.result.fit_assessment.score_details?.skill_match_percentage >= 60 ? "Moderate Fit" : "Low Fit")}
                          </p>
                        </div>
                        
                        <div className="p-4">
                          {/* Overall Score */}
                          {currentTask.result.fit_assessment.score_details && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">Overall Match</p>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  {currentTask.result.fit_assessment.score_details.skill_match_percentage}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5">
                                <div 
                                  className={`h-2.5 rounded-full ${getScoreColorClass(currentTask.result.fit_assessment.score_details.skill_match_percentage)}`} 
                                  style={{ width: `${currentTask.result.fit_assessment.score_details.skill_match_percentage}%` }}
                                ></div>
                              </div>
                              
                              {/* Score Details */}
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                                {currentTask.result.fit_assessment.score_details.experience_years && (
                                  <div className="bg-white dark:bg-teal-900/40 rounded-md p-2 text-center">
                                    <div className="text-xs text-slate-600 dark:text-slate-400">Experience</div>
                                    <div className="font-medium text-slate-800 dark:text-slate-200">
                                      {currentTask.result.fit_assessment.score_details.experience_years} years
                                    </div>
                                  </div>
                                )}
                                {currentTask.result.fit_assessment.score_details.domain_signal && (
                                  <div className="bg-white dark:bg-teal-900/40 rounded-md p-2 text-center">
                                    <div className="text-xs text-slate-600 dark:text-slate-400">Domain Signal</div>
                                    <div className="font-medium text-slate-800 dark:text-slate-200">
                                      {currentTask.result.fit_assessment.score_details.domain_signal}
                                    </div>
                                  </div>
                                )}
                                <div className="bg-white dark:bg-teal-900/40 rounded-md p-2 text-center">
                                  <div className="text-xs text-slate-600 dark:text-slate-400">Skill Match</div>
                                  <div className="font-medium text-teal-800 dark:text-teal-200">
                                    {currentTask.result.fit_assessment.score_details.skill_match_percentage}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Comparison Matrix */}
                          {currentTask.result.fit_assessment.comparison_matrix && (
                            <div className="mb-4">
                              <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Skills Assessment</h5>
                              <div className="bg-white dark:bg-slate-900/40 rounded-md p-3 overflow-auto max-h-64">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-teal-100 dark:border-teal-800/30">
                                      <th className="text-left pb-2 font-medium text-slate-700 dark:text-slate-300">Required Skill</th>
                                      <th className="text-center pb-2 font-medium text-slate-700 dark:text-slate-300 w-24">Match</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {currentTask.result.fit_assessment.comparison_matrix.map((item: any, i: number) => (
                                      <tr className="border-b border-slate-200 dark:border-slate-700/30 last:border-0">
                                        <td className="py-2 text-slate-600 dark:text-slate-400">{item.skill}</td>
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
                          
                          {/* Strengths & Gaps in 2 columns */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {/* Strengths */}
                            {currentTask.result.fit_assessment.strengths && (
                              <div>
                                <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Strengths</h5>
                                <ul className="space-y-1 bg-white dark:bg-slate-900/40 rounded-md p-3">
                                  {currentTask.result.fit_assessment.strengths.map((strength: string, index: number) => (
                                    <li key={index} className="text-xs flex items-start">
                                      <div className="mr-2 mt-0.5 text-green-500 flex-shrink-0">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                      </div>
                                      <span className="text-slate-600 dark:text-slate-400">{strength}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Gaps */}
                            {currentTask.result.fit_assessment.gaps && (
                              <div>
                                <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Improvement Areas</h5>
                                <ul className="space-y-1 bg-white dark:bg-slate-900/40 rounded-md p-3">
                                  {currentTask.result.fit_assessment.gaps.map((gap: string, index: number) => (
                                    <li key={index} className="text-xs flex items-start">
                                      <div className="mr-2 mt-0.5 text-red-500 flex-shrink-0">
                                        <XCircle className="h-3.5 w-3.5" />
                                      </div>
                                      <span className="text-slate-600 dark:text-slate-400">{gap}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          
                          {/* Reasoning */}
                          {currentTask.result.fit_assessment.reasoning && (
                            <div className="mb-4">
                              <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Assessment Reasoning</h5>
                              <div className="bg-white dark:bg-teal-900/40 rounded-md p-3 text-sm">
                                <p className="text-slate-600 dark:text-slate-400 text-xs">{currentTask.result.fit_assessment.reasoning}</p>
                              </div>
                            </div>
                          )}
                          
                          {/* Recommendation */}
                          {currentTask.result.fit_assessment.recommendation && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/30">
                              <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center">
                                <Award className="h-4 w-4 mr-2" />
                                Recommendation
                              </h5>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                {currentTask.result.fit_assessment.recommendation}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Resume Analysis */}
                    {currentTask.result.resume_structured && (
                      <div className="mb-4">
                        <h4 className="text-md font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center">
                          <User className="h-4 w-4 mr-2" /> Resume Analysis
                        </h4>
                        <div className="bg-white dark:bg-slate-900/30 rounded-md p-3 text-sm">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Personal Info */}
                            {currentTask.result.resume_structured.personal && (
                              <div>
                                <p className="font-medium text-slate-700 dark:text-slate-300">
                                  {currentTask.result.resume_structured.personal.name}
                                </p>
                                <p className="text-slate-600 dark:text-slate-400 text-xs">
                                  {currentTask.result.resume_structured.personal.email}
                                </p>
                                <p className="text-slate-600 dark:text-slate-400 text-xs">
                                  {currentTask.result.resume_structured.personal.phone}
                                </p>
                                <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
                                  Work Experience: {currentTask.result.resume_structured.personal.work_experience} years
                                </p>
                              </div>
                            )}
                            
                            {/* Education */}
                            {currentTask.result.resume_structured.education && (
                              <div>
                                <p className="font-medium text-slate-700 dark:text-slate-300 flex items-center">
                                  <GraduationCap className="h-4 w-4 mr-1" /> Education
                                </p>
                                {currentTask.result.resume_structured.education.map((edu: any, index: number) => (
                                  <div key={index} className="text-xs mt-1">
                                    <p className="text-slate-600 dark:text-slate-400">{edu.degree}</p>
                                    <p className="text-slate-700 dark:text-slate-300">{edu.institution}</p>
                                    <p className="text-teal-500/70 dark:text-teal-500/70">{edu.start_year} - {edu.end_year}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Experience */}
                          {currentTask.result.resume_structured.experience && (
                            <div className="mt-3">
                              <p className="font-medium text-teal-700 dark:text-teal-300 flex items-center">
                                <Briefcase className="h-4 w-4 mr-1" /> Experience
                              </p>
                              {currentTask.result.resume_structured.experience.map((exp: any, index: number) => (
                                <div key={index} className="text-xs mt-2 pb-2 border-b border-slate-200 dark:border-slate-700/30 last:border-0">
                                  <p className="text-slate-600 dark:text-slate-400 font-medium">{exp.title}</p>
                                  <p className="text-slate-700 dark:text-slate-300">{exp.company}</p>
                                  <p className="text-teal-500/70 dark:text-teal-500/70">
                                    {exp.start_date} - {exp.end_date || 'Present'}
                                  </p>
                                  <p className="text-slate-600 dark:text-slate-400 mt-1">{exp.description}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Job Description Analysis */}
                    {currentTask.result.jd_structured && (
                      <div className="mb-4">
                        <h4 className="text-md font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center">
                          <Briefcase className="h-4 w-4 mr-2" /> Job Description Analysis
                        </h4>
                        <div className="bg-white dark:bg-slate-900/30 rounded-md p-3 text-sm">
                          <p className="font-medium text-teal-700 dark:text-teal-300">
                            {currentTask.result.jd_structured.title}
                          </p>
                          {currentTask.result.jd_structured.location && (
                            <p className="text-teal-600 dark:text-teal-400 text-xs">
                              Location: {currentTask.result.jd_structured.location}
                            </p>
                          )}
                          
                          {/* Top Skills */}
                          {currentTask.result.jd_structured.top_skills && (
                            <div className="mt-3">
                              <p className="text-slate-700 dark:text-slate-300 text-xs font-medium">Top Skills:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {currentTask.result.jd_structured.top_skills.map((skill: string, index: number) => (
                                  <Badge key={index} variant="outline" className="bg-slate-50 text-teal-700 border-slate-200 dark:bg-slate-900/30 dark:text-teal-300 dark:border-slate-700/50">
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Responsibilities */}
                          {currentTask.result.jd_structured.responsibilities && (
                            <div className="mt-3">
                              <p className="text-slate-700 dark:text-slate-300 text-xs font-medium">Responsibilities:</p>
                              <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 mt-1 pl-2">
                                {currentTask.result.jd_structured.responsibilities.map((resp: string, index: number) => (
                                  <li key={index} className="mt-1">{resp}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Required Qualifications */}
                          {currentTask.result.jd_structured.required_qualifications && (
                            <div className="mt-3">
                              <p className="text-slate-700 dark:text-slate-300 text-xs font-medium">Required Qualifications:</p>
                              <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 mt-1 pl-2">
                                {currentTask.result.jd_structured.required_qualifications.map((qual: string, index: number) => (
                                  <li key={index} className="mt-1">{qual}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    </div>
                    
                    
                    
                  </div>
                )}
                
                {/* Show error when task fails */}
                {currentTask.status === 'failed' && currentTask.error && (
                  <div className="mt-4 border-t border-red-200 dark:border-red-800/50 pt-4">
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-3 rounded-md text-sm">
                      <h3 className="font-medium">Error</h3>
                      <p className="mt-1">{currentTask.error}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
