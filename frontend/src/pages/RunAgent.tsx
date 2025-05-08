import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { Loader2, Upload, FileText, File as FileIcon, X, Cpu, Brain, Bot, Sparkles, ArrowRight } from "lucide-react";
import { runAgent } from "../store/slices/agentSlice";
import type { AppDispatch, RootState, AgentState } from "../store";
import { cn } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";


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
  const { loading } = useSelector((state: RootState) => state.agent as AgentState);
  
  const [candidateName, setCandidateName] = useState("");
  const [resume, setResume] = useState<FileItem>({ file: null, name: "", type: "" });
  const [jobDescription, setJobDescription] = useState<FileItem>({ file: null, name: "", type: "" });
  const [resumeInputMethod, setResumeInputMethod] = useState<"file" | "text">("file");
  const [jobDescriptionInputMethod, setJobDescriptionInputMethod] = useState<"file" | "text">("file");
  const [resumeText, setResumeText] = useState("");
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  
  // Simulated AI thinking effect
  useEffect(() => {
    if (loading) {
      setAiThinking(true);
    } else {
      setAiThinking(false);
    }
  }, [loading]);

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
    
    // Handle resume submission - use the same parameter name for both file and text
    if (resumeInputMethod === "file" && resume.file) {
      // Send the file directly
      formData.append("resume", resume.file);
    } else if (resumeInputMethod === "text") {
      // Send the text directly
      formData.append("resume", resumeText);
    }
    
    // Handle job description submission - use the same parameter name for both file and text
    if (jobDescriptionInputMethod === "file" && jobDescription.file) {
      // Send the file directly
      formData.append("job_description", jobDescription.file);
    } else if (jobDescriptionInputMethod === "text") {
      // Send the text directly
      formData.append("job_description", jobDescriptionText);
    }
    
    try {
      await dispatch(runAgent(formData)).unwrap();
      toast.success("Agent run started successfully");
      navigate("/history");
    } catch (error) {
      toast.error("Failed to run agent. Please try again.");
    }
  };

  // Helper function to get icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileIcon className="h-8 w-8 text-red-500" />;
    if (fileType.includes('doc')) return <FileIcon className="h-8 w-8 text-blue-500" />;
    if (fileType.includes('txt')) return <FileText className="h-8 w-8 text-gray-500" />;
    return <FileIcon className="h-8 w-8 text-primary" />;
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between bg-gradient-to-b from-teal-900/20 to-teal-800/40 p-6 rounded-xl mb-8 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.8))] opacity-20"></div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="bg-teal-700 p-3 rounded-full animate-pulse">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">AI Recruiter Agent</h1>
            <div className="hidden md:flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="outline" className="bg-teal-700/20 text-teal-100 border-teal-600">
                <Cpu className="h-3 w-3 mr-1" /> Intelligent Analysis
              </Badge>
              <Badge variant="outline" className="bg-teal-700/20 text-teal-100 border-teal-600">
                <Bot className="h-3 w-3 mr-1" /> Resume Parsing
              </Badge>
              <Badge variant="outline" className="bg-teal-700/20 text-teal-100 border-teal-600">
                <Sparkles className="h-3 w-3 mr-1" /> Candidate Matching
              </Badge>
            </div>
          </div>
        </div>
        <div className="relative z-10 hidden md:block">
          <div className="w-24 h-24 rounded-full bg-teal-600/30 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-teal-500/40 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-teal-400/50 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-teal-300/60 animate-ping"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>

          {/* Candidate Name Card */}
           <div className="space-y-2 mt-10">
                <Label htmlFor="candidate_name" className="text-teal-200">
                  Candidate Name
                </Label>
                <Input
                  id="candidate_name"
                  placeholder="Enter candidate name"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="bg-teal-900/20 border-teal-700/50 focus:border-teal-500 focus:ring-teal-500/20 placeholder:text-teal-400/70"
                />
              </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Resume Card */}
          <Card className="overflow-hidden border border-teal-700 bg-gradient-to-b from-teal-900/10 to-transparent backdrop-blur-sm hover:shadow-[0_0_15px_rgba(0,173,173,0.3)] transition-all duration-300">
            <CardHeader className="border-b border-teal-700/30">
              <CardTitle className="flex items-center gap-2 text-teal-100">
                <div className="bg-teal-700/30 p-1.5 rounded-md">
                  <FileIcon className="h-4 w-4 text-teal-300" />
                </div>
                Resume
              </CardTitle>
              <CardDescription className="text-teal-300/70">
                Upload or enter candidate's resume
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="resume-switch" className="text-teal-200 flex items-center gap-2">
                    <span>Upload File</span>
                    <Badge variant="outline" className="bg-teal-800/30 text-teal-300 border-teal-700/30 capitalize tracking-wider">
                      {resumeInputMethod}
                    </Badge>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-teal-400">Text</span>
                    <Switch 
                      id="resume-switch" 
                      checked={resumeInputMethod === "file"}
                      onCheckedChange={(checked) => setResumeInputMethod(checked ? "file" : "text")}
                      className="data-[state=checked]:bg-teal-500"
                    />
                    <span className="text-xs text-teal-400">File</span>
                  </div>
                </div>
                
                {resumeInputMethod === "file" ? (
                  !resume.file ? (
                    <div
                      className="border-2 border-dashed border-teal-700/30 rounded-lg p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-teal-900/10 transition-all"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, "resume")}
                      onClick={() => document.getElementById("resume-upload")?.click()}
                    >
                      <Upload className="h-10 w-10 text-teal-500/50" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-teal-300">Drag & drop resume file or click to browse</p>
                        <p className="text-xs text-teal-400/70 mt-1">Supports PDF, DOCX, TXT files</p>
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
                    <div className="bg-teal-800/10 rounded-lg p-4 relative border border-teal-700/20">
                      <button
                        type="button"
                        onClick={() => removeFile("resume")}
                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-teal-900/80 flex items-center justify-center hover:bg-teal-700 hover:text-white transition-all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="bg-teal-700/20 p-2 rounded">
                          {getFileIcon(resume.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-teal-200">{resume.name}</p>
                          <p className="text-xs text-teal-400/70">{formatFileSize(resume.size)}</p>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <Textarea
                    placeholder="Paste or type resume text here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    className="min-h-[150px] max-h-[150px] resize-none bg-teal-900/20 border-teal-700/30 focus:border-teal-500 focus:ring-teal-500/20 placeholder:text-teal-400/70"
                  />
                )}
              </div>
            </CardContent>
          </Card>
         
          {/* Job Description Card - Spans full width */}
          <Card className="overflow-hidden bg-gradient-to-b from-teal-900/10 to-transparent backdrop-blur-sm hover:shadow-[0_0_15px_rgba(0,173,173,0.3)] transition-all duration-300">
            <CardHeader className="border-b border-teal-700/30">
              <CardTitle className="flex items-center gap-2 text-teal-100">
                <div className="bg-teal-700/30 p-1.5 rounded-md">
                  <FileText className="h-4 w-4 text-teal-300" />
                </div>
                Job Description
              </CardTitle>
              <CardDescription className="text-teal-300/70">
                Provide the job description as a file or text
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="job-description-switch" className="text-teal-200 flex items-center gap-2">
                    <span>Upload File</span>
                    <Badge variant="outline" className="bg-teal-800/30 text-teal-300 border-teal-700/30 capitalize tracking-wider">
                      {jobDescriptionInputMethod}
                    </Badge>
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-teal-400">Text</span>
                    <Switch 
                      id="job-description-switch" 
                      checked={jobDescriptionInputMethod === "file"}
                      onCheckedChange={(checked) => setJobDescriptionInputMethod(checked ? "file" : "text")}
                      className="data-[state=checked]:bg-teal-600"
                    />
                    <span className="text-xs text-teal-400">File</span>
                  </div>
                </div>
                
                {jobDescriptionInputMethod === "file" ? (
                  !jobDescription.file ? (
                    <div
                      className="border-2 border-dashed border-teal-700/30 rounded-lg p-6 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-teal-900/10 transition-all"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, "jobDescription")}
                      onClick={() => document.getElementById("job-description-upload")?.click()}
                    >
                      <Upload className="h-10 w-10 text-teal-500/50" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-teal-300">Drag & drop job description file or click to browse</p>
                        <p className="text-xs text-teal-400/70 mt-1">Supports PDF, DOCX, TXT files</p>
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
                    <div className="bg-teal-800/10 rounded-lg p-4 relative border border-teal-700/20">
                      <button
                        type="button"
                        onClick={() => removeFile("jobDescription")}
                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-teal-900/80 flex items-center justify-center hover:bg-teal-700 hover:text-white transition-all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="bg-teal-700/20 p-2 rounded">
                          {getFileIcon(jobDescription.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-teal-200">{jobDescription.name}</p>
                          <p className="text-xs text-teal-400/70">{formatFileSize(jobDescription.size)}</p>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <Textarea
                    placeholder="Paste or type job description here..."
                    value={jobDescriptionText}
                    onChange={(e) => setJobDescriptionText(e.target.value)}
                    className="min-h-[150px] max-h-[150px] resize-none bg-teal-900/20 border-teal-700/30 focus:border-teal-500 focus:ring-teal-500/20 placeholder:text-teal-400/70"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Button Card */}
        <Card className="mt-6 overflow-hidden border border-teal-700 bg-gradient-to-r from-teal-900 to-teal-800 shadow-lg transition-all duration-300 relative">
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.8))] opacity-20"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
              <div className="space-y-3">
                <h3 className="text-xl font-medium text-white flex items-center gap-2">
                  <Brain className="h-5 w-5 text-teal-300" />
                  AI Analysis Ready
                </h3>
                <p className="text-sm text-teal-100">
                  Our AI agent will analyze the resume against the job description to evaluate candidate fit.
                </p>
                <div className="flex items-center gap-4 text-xs text-teal-300">
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
              
              <div className="relative">
                {aiThinking && (
                  <div className="absolute -top-3 -left-3 right-0 bottom-0 bg-teal-500/20 rounded-full blur-xl animate-pulse"></div>
                )}
                <Button 
                  type="submit" 
                  className={cn(
                    `w-full md:w-auto transition-all bg-gradient-to-r from-teal-500 to-teal-600 border border-teal-400/30 text-white hover:shadow-[0_0_15px_rgba(0,173,173,0.5)]`,
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
                      <Cpu className="h-5 w-5 text-teal-200" />
                      <span>Run AI Analysis</span>
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
