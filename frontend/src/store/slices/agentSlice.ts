import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface Education {
  degree: string;
  institution: string;
  start_year: number;
  end_year: number;
}

interface Experience {
  title: string;
  company: string;
  start_date: string;
  end_date: string | null;
  description: string;
}

interface Personal {
  name: string;
  email: string;
  phone: string;
  work_experience: number;
}

interface ResumeStructured {
  personal: Personal;
  education: Education[];
  experience: Experience[];
}

interface JDStructured {
  title: string;
  location: string | null;
  responsibilities: string[];
  required_qualifications: string[];
  preferred_qualifications: string[] | null;
  top_skills: string[];
}

interface AgentRunInput {
  candidate_name: string;
  resume_text: string;
  job_description: string;
}

interface AgentRunOutput {
  jd_structured: JDStructured;
  resume_structured: ResumeStructured;
  web_structured?: any;
  fit_assessment?: any;
}

interface AgentRun {
  id: any;
  timestamp: string;
  input: AgentRunInput;
  output: AgentRunOutput;
}

interface AgentState {
  runs: AgentRun[];
  loading: boolean;
  error: string | null;
  currentRun: AgentRun | null;
}

const initialState: AgentState = {
  runs: [],
  loading: false,
  error: null,
  currentRun: null,
};

export const fetchAgentRuns = createAsyncThunk(
  'agent/fetchRuns',
  async (limit: number = 5) => {
    const response = await fetch(`http://localhost:8001/runs/?limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to fetch agent runs');
    }
    return await response.json();
  }
);

export const runAgent = createAsyncThunk(
  'agent/runAgent',
  async (formData: FormData) => {
    const response = await fetch('http://localhost:8001/run-agent/', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Failed to run agent');
    }
    
    return await response.json();
  }
);

export const agentSlice = createSlice({
  name: 'agent',
  initialState,
  reducers: {
    setCurrentRun: (state, action: PayloadAction<AgentRun | null>) => {
      state.currentRun = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAgentRuns.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAgentRuns.fulfilled, (state, action) => {
        state.loading = false;
        state.runs = action.payload;
      })
      .addCase(fetchAgentRuns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch agent runs';
      })
      .addCase(runAgent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(runAgent.fulfilled, (state, action) => {
        state.loading = false;
        state.currentRun = action.payload;
        state.runs = [action.payload, ...state.runs];
      })
      .addCase(runAgent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to run agent';
      });
  },
});

export const { setCurrentRun } = agentSlice.actions;
export default agentSlice.reducer;
