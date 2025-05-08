import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

// API URL configuration based on environment
console.log(import.meta.env.VITE_NODE_ENV);

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

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  created_at: string;
  updated_at: string;
  result?: any;
  error?: string;
  agent_run_id?: string;
  attempt?: number; // Added for retry tracking
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
      
      // Add a timeout to the fetch request to avoid hanging indefinitely
      const controller = new AbortController();
      // Increase timeout to 30 seconds to avoid premature aborts
      const timeoutId = setTimeout(() => {
        console.log(`Request timeout reached after 30 seconds, aborting request for task ${taskId}`);
        controller.abort();
      }, 30000); // 30 second timeout
      
      try {
        const response = await fetch(`${API_BASE_URL}/task/${taskId}`, {
          signal: controller.signal
        });
        
        // Clear the timeout since the request completed
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Handle specific HTTP error codes
          if (response.status === 504) {
            console.warn(`Gateway timeout (504) encountered on attempt ${attempt}, retrying...`);
            // Don't try to parse JSON for 504 errors, just retry
            throw new Error('Gateway timeout');
          }
          
          // For other errors, try to get detailed error message from the response
          try {
            const errorData = await response.json();
            // Instead of rejecting, throw an error to trigger retry
            throw new Error(errorData.detail || `Failed to poll task status: ${response.status}`);
          } catch (jsonError) {
            // If we can't parse JSON, just throw the original error
            throw new Error(`HTTP error ${response.status} while polling task status`);
          }
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
      } catch (fetchError) {
        // Clear the timeout to prevent memory leaks
        clearTimeout(timeoutId);
        throw fetchError; // Re-throw to be caught by the outer catch block
      }
    } catch (error: unknown) {
      console.error('Error polling task status:', error);
      
      // Log specific error types for debugging purposes
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('abort')) {
          console.log(`Request for task ${taskId} was aborted due to timeout. Will retry.`);
        } else if (error instanceof TypeError) {
          console.log(`Network error for task ${taskId}: ${error.message}. Will retry.`);
        } else if (error.message.includes('Gateway timeout')) {
          console.log(`Gateway timeout for task ${taskId}: ${error.message}. Will retry.`);
        } else {
          console.log(`Error for task ${taskId}: ${error.message}. Will retry.`);
        }
      } else {
        console.log(`Unexpected non-Error object for task ${taskId}. Will retry.`);
      }
      
      // ALWAYS retry as long as polling is active, regardless of error type
      if (getState().agent.pollingActive) {
        // Log retry attempt with proper error message handling
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`Retrying poll attempt ${attempt} after error: ${errorMessage}`);
        
        // Calculate backoff delay with jitter to prevent thundering herd
        const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
        // Cap the max delay at 30 seconds to prevent extremely long waits
        const retryDelay = Math.min(Math.pow(2, attempt) * 1000, 30000) + jitter;
        
        setTimeout(() => {
          dispatch(pollTaskStatus({ taskId, attempt: attempt + 1 }));
        }, retryDelay);
        
        // Return a special value to indicate we're retrying
        return { status: 'retrying', task_id: taskId, attempt };
      }
      
      // For other errors or if polling is inactive, reject with error message
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to poll task status');
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
