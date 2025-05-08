from typing import Dict, Any, Optional, Callable, Awaitable
from models.task import Task, TaskStatus
import asyncio
import traceback
import logging

logger = logging.getLogger(__name__)

class TaskManager:
    @staticmethod
    async def create_task() -> Task:
        """Create a new task and save it to the database"""
        task = Task()
        await task.insert()
        return task
    
    @staticmethod
    async def get_task(task_id: str) -> Optional[Task]:
        """Get a task by its ID"""
        return await Task.find_one({"task_id": task_id})
    
    @staticmethod
    async def update_task_status(task_id: str, status: TaskStatus) -> Optional[Task]:
        """Update the status of a task"""
        task = await TaskManager.get_task(task_id)
        if task:
            task.status = status
            await task.save()
        return task
    
    @staticmethod
    async def update_task_result(task_id: str, result: Dict[str, Any], agent_run_id: Optional[str] = None) -> Optional[Task]:
        """Update the result of a task"""
        task = await TaskManager.get_task(task_id)
        if task:
            task.status = TaskStatus.COMPLETED
            task.result = result
            if agent_run_id:
                task.agent_run_id = agent_run_id
            await task.save()
        return task
    
    @staticmethod
    async def update_task_error(task_id: str, error: str) -> Optional[Task]:
        """Update the error of a task"""
        task = await TaskManager.get_task(task_id)
        if task:
            task.status = TaskStatus.FAILED
            task.error = error
            await task.save()
        return task
    
    @staticmethod
    async def run_background_task(
        task_id: str,
        func: Callable[..., Awaitable[Dict[str, Any]]],
        *args,
        **kwargs
    ):
        """Run a function in the background and update the task status"""
        try:
            # Update task status to running
            await TaskManager.update_task_status(task_id, TaskStatus.RUNNING)
            
            # Run the function
            result = await func(*args, **kwargs)
            
            # Update task result
            if isinstance(result, dict) and "agent_run_id" in result:
                await TaskManager.update_task_result(task_id, result, result.get("agent_run_id"))
            else:
                await TaskManager.update_task_result(task_id, result)
                
            return result
        except Exception as e:
            # Log the error
            error_msg = f"Error in background task: {str(e)}\n{traceback.format_exc()}"
            logger.error(error_msg)
            
            # Update task error
            await TaskManager.update_task_error(task_id, str(e))
            
            # Re-raise the exception
            raise e
