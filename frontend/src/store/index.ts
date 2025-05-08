import { configureStore } from '@reduxjs/toolkit';
// Import reducers directly
import agentSlice from './slices/agentSlice';
import themeSlice from './slices/themeSlice';

export const store = configureStore({
  reducer: {
    agent: agentSlice,
    theme: themeSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Define explicit types for the state
export interface Education {
  degree: string;
  institution: string;
  start_year: number;
  end_year: number;
}

export interface Experience {
  title: string;
  company: string;
  start_date: string;
  end_date: string | null;
  description: string;
}

export interface Personal {
  name: string;
  email: string;
  phone: string;
  work_experience: number;
}

export interface ResumeStructured {
  personal: Personal;
  education: Education[];
  experience: Experience[];
}

export interface JDStructured {
  title: string;
  location: string | null;
  responsibilities: string[];
  required_qualifications: string[];
  preferred_qualifications: string[] | null;
  top_skills: string[];
}

export interface AgentRunInput {
  candidate_name: string;
  resume_text: string;
  job_description: string;
}

export interface AgentRunOutput {
  jd_structured: JDStructured;
  resume_structured: ResumeStructured;
  web_structured?: any;
  fit_assessment?: any;
}

export interface AgentRun {
  id: any;
  timestamp: string;
  input: AgentRunInput;
  output: AgentRunOutput;
}

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  result?: any;
  error?: string;
  agent_run_id?: string;
}

export interface AgentState {
  runs: AgentRun[];
  loading: boolean;
  error: string | null;
  currentRun: AgentRun | null;
  currentTask: TaskStatus | null;
  pollingActive: boolean;
}

export interface ThemeState {
  mode: 'light' | 'dark' | 'system';
}
