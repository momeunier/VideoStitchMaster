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
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        await task();
      } catch (error) {
        console.error('Task processing error:', error);
      }
    }
    this.processing = false;
  }
}

export const processingQueue = new ProcessingQueue();
