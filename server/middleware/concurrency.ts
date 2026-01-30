// Simple in-process mutex implementation for race condition protection
class Mutex {
  private locked = false;
  private waiting: Array<() => void> = [];

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve(() => this.release());
      } else {
        this.waiting.push(() => {
          this.locked = true;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}

// Global mutex registry for resource-based locking
const mutexRegistry = new Map<string, Mutex>();

// Get or create mutex for a resource
export function getResourceMutex(resourceId: string): Mutex {
  let mutex = mutexRegistry.get(resourceId);
  if (!mutex) {
    mutex = new Mutex();
    mutexRegistry.set(resourceId, mutex);
  }
  return mutex;
}

// Helper for protecting async operations
export async function withMutex<T>(
  resourceId: string, 
  operation: () => Promise<T>
): Promise<T> {
  const mutex = getResourceMutex(resourceId);
  const release = await mutex.acquire();
  
  try {
    return await operation();
  } finally {
    release();
  }
}

// User operation protection
export async function withUserLock<T>(
  userId: string, 
  operation: () => Promise<T>
): Promise<T> {
  return withMutex(`user:${userId}`, operation);
}

// Landing page operation protection  
export async function withLandingPageLock<T>(
  slug: string, 
  operation: () => Promise<T>
): Promise<T> {
  return withMutex(`landing_page:${slug}`, operation);
}

// Generic entity operation protection
export async function withEntityLock<T>(
  entityType: string,
  entityId: string, 
  operation: () => Promise<T>
): Promise<T> {
  return withMutex(`${entityType}:${entityId}`, operation);
}

// Cleanup old mutexes to prevent memory leaks
setInterval(() => {
  // Remove unused mutexes (simple heuristic: if not locked and no waiters)
  for (const [key, mutex] of Array.from(mutexRegistry.entries())) {
    if (!(mutex as any).locked && (mutex as any).waiting.length === 0) {
      mutexRegistry.delete(key);
    }
  }
}, 60000); // Clean every minute