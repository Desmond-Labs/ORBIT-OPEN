/**
 * TodoWrite Manager Module
 * 
 * Provides centralized todo list management for the Claude Code orchestrator.
 * Handles task creation, status updates, progress tracking, and performance metrics.
 * 
 * This module enables the orchestrator to manage complex workflows with
 * clear visibility into progress and task completion status.
 */

import { OrbitTodo } from '../types/orbit-types.ts';

export interface TodoManagerOptions {
  enableMetrics?: boolean;
  enableLogging?: boolean;
  autoGenerateIds?: boolean;
}

export interface TodoMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  completionRate: number;
  averageTaskDuration: number;
  totalDuration: number;
}

export class TodoManager {
  private todos: OrbitTodo[] = [];
  private options: TodoManagerOptions;
  private startTime: number;
  
  constructor(options: TodoManagerOptions = {}) {
    this.options = {
      enableMetrics: true,
      enableLogging: true,
      autoGenerateIds: true,
      ...options
    };
    this.startTime = Date.now();
    
    if (this.options.enableLogging) {
      console.log('📋 TodoWrite Manager initialized');
    }
  }

  /**
   * Initialize todo list with ORBIT workflow tasks
   */
  initializeOrbitWorkflow(orderId: string): OrbitTodo[] {
    const workflowTasks: OrbitTodo[] = [
      {
        content: `Initialize Claude Code orchestration for order ${orderId}`,
        status: 'pending',
        id: 'init-1'
      },
      {
        content: 'Discover and validate order images from database',
        status: 'pending',
        id: 'discovery-1'
      },
      {
        content: 'Process AI analysis for each image using direct Gemini tool',
        status: 'pending',
        id: 'analysis-1'
      },
      {
        content: 'Generate metadata and XMP embedding using direct tools',
        status: 'pending',
        id: 'metadata-1'
      },
      {
        content: 'Create comprehensive reports for analysis results',
        status: 'pending',
        id: 'reports-1'
      },
      {
        content: 'Upload processed files to storage using direct tools',
        status: 'pending',
        id: 'storage-1'
      },
      {
        content: 'Update database with processing results and file paths',
        status: 'pending',
        id: 'database-1'
      },
      {
        content: 'Validate workflow completion and generate summary',
        status: 'pending',
        id: 'validation-1'
      }
    ];

    this.todos = workflowTasks;
    
    if (this.options.enableLogging) {
      console.log(`📋 Initialized ORBIT workflow with ${workflowTasks.length} tasks`);
    }
    
    return this.todos;
  }

  /**
   * Add a new todo task
   */
  addTodo(content: string, id?: string): OrbitTodo {
    const todo: OrbitTodo = {
      content,
      status: 'pending',
      id: id || (this.options.autoGenerateIds ? this.generateId() : crypto.randomUUID())
    };
    
    this.todos.push(todo);
    
    if (this.options.enableLogging) {
      console.log(`➕ Added todo: ${content}`);
    }
    
    return todo;
  }

  /**
   * Start working on a task (mark as in_progress)
   */
  startTask(id: string): boolean {
    const todo = this.findTodoById(id);
    if (!todo) {
      if (this.options.enableLogging) {
        console.warn(`⚠️ Task not found: ${id}`);
      }
      return false;
    }
    
    if (todo.status !== 'pending') {
      if (this.options.enableLogging) {
        console.warn(`⚠️ Task ${id} is not in pending status (current: ${todo.status})`);
      }
      return false;
    }
    
    // End any other in-progress tasks (only one at a time)
    this.todos.forEach(t => {
      if (t.status === 'in_progress') {
        console.warn(`⚠️ Force completing previous in-progress task: ${t.id}`);
        this.completeTask(t.id);
      }
    });
    
    todo.status = 'in_progress';
    todo.startTime = Date.now();
    
    if (this.options.enableLogging) {
      console.log(`▶️ Started task: ${todo.content}`);
    }
    
    return true;
  }

  /**
   * Complete a task (mark as completed)
   */
  completeTask(id: string): boolean {
    const todo = this.findTodoById(id);
    if (!todo) {
      if (this.options.enableLogging) {
        console.warn(`⚠️ Task not found: ${id}`);
      }
      return false;
    }
    
    const previousStatus = todo.status;
    todo.status = 'completed';
    todo.completionTime = Date.now();
    
    if (todo.startTime) {
      todo.duration = todo.completionTime - todo.startTime;
    }
    
    if (this.options.enableLogging) {
      const duration = todo.duration ? ` (${todo.duration}ms)` : '';
      console.log(`✅ Completed task: ${todo.content}${duration}`);
    }
    
    return true;
  }

  /**
   * Fail a task (mark as failed)
   */
  failTask(id: string, error?: string): boolean {
    const todo = this.findTodoById(id);
    if (!todo) {
      if (this.options.enableLogging) {
        console.warn(`⚠️ Task not found: ${id}`);
      }
      return false;
    }
    
    todo.status = 'failed';
    todo.completionTime = Date.now();
    
    if (todo.startTime) {
      todo.duration = todo.completionTime - todo.startTime;
    }
    
    if (this.options.enableLogging) {
      const errorMsg = error ? ` - ${error}` : '';
      console.log(`❌ Failed task: ${todo.content}${errorMsg}`);
    }
    
    return true;
  }

  /**
   * Update task content
   */
  updateTaskContent(id: string, content: string): boolean {
    const todo = this.findTodoById(id);
    if (!todo) {
      return false;
    }
    
    const oldContent = todo.content;
    todo.content = content;
    
    if (this.options.enableLogging) {
      console.log(`📝 Updated task ${id}: "${oldContent}" → "${content}"`);
    }
    
    return true;
  }

  /**
   * Get current todo list
   */
  getTodos(): OrbitTodo[] {
    return [...this.todos]; // Return copy to prevent external mutations
  }

  /**
   * Get current task metrics
   */
  getMetrics(): TodoMetrics {
    const totalTasks = this.todos.length;
    const completedTasks = this.todos.filter(t => t.status === 'completed').length;
    const failedTasks = this.todos.filter(t => t.status === 'failed').length;
    const inProgressTasks = this.todos.filter(t => t.status === 'in_progress').length;
    const pendingTasks = this.todos.filter(t => t.status === 'pending').length;
    
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    const completedWithDuration = this.todos.filter(t => t.status === 'completed' && t.duration);
    const averageTaskDuration = completedWithDuration.length > 0 
      ? completedWithDuration.reduce((sum, t) => sum + (t.duration || 0), 0) / completedWithDuration.length
      : 0;
    
    const totalDuration = Date.now() - this.startTime;
    
    return {
      totalTasks,
      completedTasks,
      failedTasks,
      inProgressTasks,
      pendingTasks,
      completionRate,
      averageTaskDuration,
      totalDuration
    };
  }

  /**
   * Get current status summary as string
   */
  getStatusSummary(): string {
    const metrics = this.getMetrics();
    
    return `📊 Todo Status: ${metrics.completedTasks}/${metrics.totalTasks} completed (${metrics.completionRate.toFixed(1)}%)
⏱️ Average task time: ${metrics.averageTaskDuration.toFixed(0)}ms
🕐 Total duration: ${(metrics.totalDuration / 1000).toFixed(1)}s
📋 Remaining: ${metrics.pendingTasks} pending, ${metrics.inProgressTasks} in progress`;
  }

  /**
   * Find next pending task
   */
  getNextPendingTask(): OrbitTodo | null {
    return this.todos.find(t => t.status === 'pending') || null;
  }

  /**
   * Get current in-progress task
   */
  getCurrentTask(): OrbitTodo | null {
    return this.todos.find(t => t.status === 'in_progress') || null;
  }

  /**
   * Check if workflow is complete
   */
  isComplete(): boolean {
    return this.todos.length > 0 && this.todos.every(t => t.status === 'completed' || t.status === 'failed');
  }

  /**
   * Check if workflow has any failures
   */
  hasFailures(): boolean {
    return this.todos.some(t => t.status === 'failed');
  }

  /**
   * Get workflow completion percentage
   */
  getCompletionPercentage(): number {
    if (this.todos.length === 0) return 0;
    const completed = this.todos.filter(t => t.status === 'completed').length;
    return (completed / this.todos.length) * 100;
  }

  /**
   * Export todo list in TodoWrite format
   */
  exportForTodoWrite(): Array<{content: string; status: string; id: string}> {
    return this.todos.map(todo => ({
      content: todo.content,
      status: todo.status,
      id: todo.id
    }));
  }

  /**
   * Reset all todos to pending status
   */
  reset(): void {
    this.todos.forEach(todo => {
      todo.status = 'pending';
      delete todo.startTime;
      delete todo.completionTime;
      delete todo.duration;
    });
    
    this.startTime = Date.now();
    
    if (this.options.enableLogging) {
      console.log('🔄 Reset all todos to pending status');
    }
  }

  /**
   * Clear all todos
   */
  clear(): void {
    this.todos = [];
    this.startTime = Date.now();
    
    if (this.options.enableLogging) {
      console.log('🗑️ Cleared all todos');
    }
  }

  // Private helper methods
  private findTodoById(id: string): OrbitTodo | undefined {
    return this.todos.find(t => t.id === id);
  }

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `task-${timestamp}-${random}`;
  }

  /**
   * Create a TodoWrite-compatible task update for external consumption
   */
  createTodoWriteUpdate(): Array<{content: string; status: string; id: string}> {
    return this.exportForTodoWrite();
  }

  /**
   * Log current progress in a formatted way
   */
  logProgress(): void {
    if (!this.options.enableLogging) return;
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 ORBIT Workflow Progress Update');
    console.log('='.repeat(50));
    console.log(this.getStatusSummary());
    console.log('\n📝 Task Details:');
    
    this.todos.forEach((todo, index) => {
      const statusIcon = this.getStatusIcon(todo.status);
      const duration = todo.duration ? ` (${todo.duration}ms)` : '';
      console.log(`  ${index + 1}. ${statusIcon} ${todo.content}${duration}`);
    });
    
    console.log('='.repeat(50) + '\n');
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '⏳';
      case 'failed': return '❌';
      case 'pending': default: return '⏸️';
    }
  }
}