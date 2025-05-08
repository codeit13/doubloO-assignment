import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

// API URL configuration based on environment
const API_BASE_URL = import.meta.env.VITE_NODE_ENV === 'production' 
  ? 'https://recruiter-backend.sleebit.com' 
  : 'http://localhost:8005';

// Alternative approach using direct environment variable
// const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

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

interface TaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  result?: any;
  error?: string;
  agent_run_id?: string;
}

interface AgentState {
  runs: AgentRun[];
  loading: boolean;
  error: string | null;
  currentRun: AgentRun | null;
  currentTask: TaskStatus | null;
  pollingActive: boolean;
}

const initialState: AgentState = {
  runs: [],
  loading: false,
  error: null,
  currentRun: null,
  currentTask: null,
  pollingActive: false,
};

export const fetchAgentRuns = createAsyncThunk(
  'agent/fetchRuns',
  async (limit: number = 5) => {
    const response = await fetch(`${API_BASE_URL}/runs/?limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to fetch agent runs');
    }
    return await response.json();
  }
);

export const runAgent = createAsyncThunk(
  'agent/runAgent',
  async (formData: FormData, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/run-agent/`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        // Try to get detailed error message from the response
        const errorData = await response.json();
        return rejectWithValue(errorData.detail || 'Failed to run agent');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error in runAgent:', error);
      return rejectWithValue('Failed to run agent. Network error or server unavailable.');
    }
  }
);

export const pollTaskStatus = createAsyncThunk<any, { taskId: string, attempt?: number }, { state: RootState }>(
  'agent/pollTaskStatus',
  async ({ taskId, attempt = 1 }, { dispatch, rejectWithValue, getState }) => {
    try {
      // Calculate delay based on attempt number (exponential backoff)
      // Start with 2 seconds, then 4, 8, 16, etc. but cap at 30 seconds
      const delay = Math.min(Math.pow(2, attempt) * 1000, 30000);
      
      // Get current polling state
      const { pollingActive } = getState().agent;
      
      // If polling is no longer active, don't make the request
      if (!pollingActive) {
        return null;
      }
      
      const response = await fetch(`${API_BASE_URL}/task/${taskId}`);
      
      if (!response.ok) {
        // Try to get detailed error message from the response
        const errorData = await response.json();
        return rejectWithValue(errorData.detail || 'Failed to poll task status');
      }
      
      const taskStatus = await response.json();
      dispatch(setCurrentTask(taskStatus));
      
      // If the task is completed or failed, stop polling
      if (taskStatus.status === 'completed' || taskStatus.status === 'failed') {
        dispatch(setPollingActive(false));
        
        // If completed and has result, fetch the latest runs to update the UI
        if (taskStatus.status === 'completed' && taskStatus.result) {
          dispatch(fetchAgentRuns(10));
        }
        return taskStatus;
      }
      
      // Adjust polling frequency based on task status
      // If task is running, poll more frequently than if it's still pending
      const nextDelay = taskStatus.status === 'running' ? delay / 2 : delay;
      
      // Schedule the next poll with increasing delay if task is still pending/running
      setTimeout(() => {
        if (getState().agent.pollingActive) {
          dispatch(pollTaskStatus({ 
            taskId, 
            // Increment attempt counter more slowly for running tasks
            attempt: taskStatus.status === 'running' ? attempt + 0.5 : attempt + 1 
          }));
        }
      }, nextDelay);
      
      return taskStatus;
    } catch (error) {
      console.error('Error polling task status:', error);
      // Don't stop polling on network errors, just retry with backoff
      if (getState().agent.pollingActive) {
        setTimeout(() => {
          dispatch(pollTaskStatus({ taskId, attempt: attempt + 1 }));
        }, Math.min(Math.pow(2, attempt) * 1000, 30000));
      }
      return rejectWithValue('Failed to poll task status');
    }
  }
);

export const agentSlice = createSlice({
  name: 'agent',
  initialState,
  reducers: {
    setCurrentRun: (state, action: PayloadAction<AgentRun | null>) => {
      state.currentRun = action.payload;
    },
    setCurrentTask: (state, action: PayloadAction<TaskStatus | null>) => {
      state.currentTask = action.payload;
    },
    setPollingActive: (state, action: PayloadAction<boolean>) => {
      state.pollingActive = action.payload;
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
        state.loading = true; // Keep loading true until task completes
        state.currentTask = action.payload;
        state.pollingActive = true;
      })
      .addCase(pollTaskStatus.pending, () => {
        // Don't change loading state during polling
      })
      .addCase(pollTaskStatus.fulfilled, (state, action) => {
        state.currentTask = action.payload;
        
        // If task is completed or failed, update loading state
        if (action.payload.status === 'completed' || action.payload.status === 'failed') {
          state.loading = false;
        }
      })
      .addCase(pollTaskStatus.rejected, (state, action) => {
        state.loading = false;        
        state.error = action.error.message || 'Failed to poll task status';
        state.pollingActive = false;
      })
      .addCase(runAgent.rejected, (state, action) => {
        state.loading = false;        
        state.error = action.error.message || 'Failed to run agent';
      });
  },
});

export const { setCurrentRun, setCurrentTask, setPollingActive } = agentSlice.actions;
export default agentSlice.reducer;
