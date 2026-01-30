interface BackoffOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

const DEFAULT_BACKOFF: BackoffOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 4000,
  jitter: true
};

const DEFAULT_CIRCUIT: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 30000,
  halfOpenRequests: 1
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateDelay(attempt: number, options: BackoffOptions): number {
  let delay = options.baseDelay * Math.pow(2, attempt);
  delay = Math.min(delay, options.maxDelay);
  
  if (options.jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }
  
  return Math.floor(delay);
}

export async function withBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<BackoffOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_BACKOFF, ...options };
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < opts.maxRetries) {
        const delay = calculateDelay(attempt, opts);
        console.log(`[backoff] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailure: number = 0;
  private halfOpenSuccesses = 0;
  private options: CircuitBreakerOptions;
  private name: string;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = { ...DEFAULT_CIRCUIT, ...options };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure >= this.options.resetTimeout) {
        this.state = 'half-open';
        this.halfOpenSuccesses = 0;
        console.log(`[circuit:${this.name}] Transitioning to half-open`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is open`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.options.halfOpenRequests) {
        this.state = 'closed';
        this.failures = 0;
        console.log(`[circuit:${this.name}] Circuit closed after successful half-open`);
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.state === 'half-open' || this.failures >= this.options.failureThreshold) {
      this.state = 'open';
      console.log(`[circuit:${this.name}] Circuit opened after ${this.failures} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.halfOpenSuccesses = 0;
  }
}

export async function resilientFetch(
  url: string,
  options: RequestInit = {},
  circuitBreaker?: CircuitBreaker,
  backoffOptions?: Partial<BackoffOptions>
): Promise<Response> {
  const fetchFn = async () => {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok && response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    return response;
  };

  const withRetry = () => withBackoff(fetchFn, backoffOptions);

  if (circuitBreaker) {
    return circuitBreaker.execute(withRetry);
  }

  return withRetry();
}

export const openaiCircuit = new CircuitBreaker('openai', {
  failureThreshold: 3,
  resetTimeout: 60000
});

export const stripeCircuit = new CircuitBreaker('stripe', {
  failureThreshold: 3,
  resetTimeout: 30000
});

export const dataServiceCircuit = new CircuitBreaker('data-service', {
  failureThreshold: 5,
  resetTimeout: 15000
});

export default {
  withBackoff,
  CircuitBreaker,
  resilientFetch,
  openaiCircuit,
  stripeCircuit,
  dataServiceCircuit
};
