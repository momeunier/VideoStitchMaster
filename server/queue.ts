type QueueTask = () => Promise<void>;

// Class to manage video processing queue
export class ProcessingQueue {
  private queue: QueueTask[] = [];
  private processing = false;

  async add(task: QueueTask) {
    this.queue.push(task);
    if (!this.processing) {
      this.process();
    }
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    console.log(`[Queue] Starting to process ${this.queue.length} tasks`);
    
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        console.log('[Queue] Processing next task');
        await task();
        console.log('[Queue] Task completed successfully');
        // Add a small delay between tasks to ensure proper cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('[Queue] Task processing error:', error);
        // Continue processing next task even if current one fails
      } finally {
        console.log('[Queue] Task processing complete, moving to next task');
      }
    }
    
    console.log('[Queue] All tasks completed');
    this.processing = false;
  }
}

export const processingQueue = new ProcessingQueue();
