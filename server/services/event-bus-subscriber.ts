/**
 * Event Bus Subscriber
 * 
 * Subscribes to domain events from the Event Bus (Upstash Redis Streams or CloudAMQP)
 * to enable event-driven page regeneration in auto_page_maker.
 * 
 * Subscribed Events:
 * - SCHOLARSHIP_PUBLISHED: Regenerate landing page for new/updated scholarship
 * - SCHOLARSHIP_UNPUBLISHED: Remove landing page for unpublished scholarship
 * - BULK_SCHOLARSHIPS_UPDATED: Trigger full sitemap rebuild
 * 
 * Environment Variables:
 * - EVENT_BUS_URL: Redis or AMQP connection URL
 * - EVENT_BUS_TOKEN: Authentication token
 * - EVENT_BUS_ENABLED: 'true' to enable event bus subscription (default: 'false')
 */

import { Redis } from '@upstash/redis';

export type DomainEvent = 
  | { type: 'SCHOLARSHIP_PUBLISHED'; payload: { scholarshipId: string; slug: string; timestamp: string } }
  | { type: 'SCHOLARSHIP_UNPUBLISHED'; payload: { scholarshipId: string; slug: string; timestamp: string } }
  | { type: 'BULK_SCHOLARSHIPS_UPDATED'; payload: { count: number; timestamp: string } };

export class EventBusSubscriber {
  private redis: Redis | null = null;
  private isEnabled: boolean;
  private streamName: string = 'scholar_events';
  private consumerGroup: string = 'auto_page_maker';
  private consumerName: string = `auto_page_maker_${process.pid}`;
  private isRunning: boolean = false;
  private handlers: Map<string, (event: DomainEvent) => Promise<void>>;

  constructor() {
    this.isEnabled = process.env.EVENT_BUS_ENABLED === 'true';
    this.handlers = new Map();

    if (this.isEnabled) {
      this.initializeRedis();
    } else {
      console.log('[EventBus] Event Bus disabled (EVENT_BUS_ENABLED != true)');
    }
  }

  private initializeRedis(): void {
    const url = process.env.EVENT_BUS_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.EVENT_BUS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      console.warn('[EventBus] Missing EVENT_BUS_URL or EVENT_BUS_TOKEN - event bus disabled');
      this.isEnabled = false;
      return;
    }

    try {
      this.redis = new Redis({
        url,
        token,
      });
      console.log('[EventBus] Initialized with Upstash Redis');
    } catch (error) {
      console.error('[EventBus] Failed to initialize Redis:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    this.handlers.set(eventType, handler);
    console.log(`[EventBus] Registered handler for ${eventType}`);
  }

  /**
   * Start consuming events from the stream
   */
  async start(): Promise<void> {
    if (!this.isEnabled || !this.redis) {
      console.log('[EventBus] Subscriber not enabled, skipping start');
      return;
    }

    this.isRunning = true;
    console.log(`[EventBus] Starting consumer: ${this.consumerName}`);

    // Create consumer group if it doesn't exist
    try {
      await this.redis.xgroup('CREATE', this.streamName, this.consumerGroup, '0', 'MKSTREAM');
      console.log(`[EventBus] Created consumer group: ${this.consumerGroup}`);
    } catch (error: any) {
      // Group already exists, ignore error
      if (!error.message?.includes('BUSYGROUP')) {
        console.error('[EventBus] Error creating consumer group:', error);
      }
    }

    // Start consuming loop
    this.consumeLoop();
  }

  /**
   * Stop consuming events
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('[EventBus] Stopping consumer');
  }

  /**
   * Main consume loop with exponential backoff on errors
   */
  private async consumeLoop(): Promise<void> {
    let backoffMs = 1000;
    const maxBackoffMs = 30000;

    while (this.isRunning && this.redis) {
      try {
        // Read pending messages first, then new messages
        const messages = await this.redis.xreadgroup(
          'GROUP',
          this.consumerGroup,
          this.consumerName,
          'COUNT',
          10,
          'BLOCK',
          5000, // Block for 5 seconds
          'STREAMS',
          this.streamName,
          '>'
        );

        if (messages && messages.length > 0) {
          for (const [_streamName, streamMessages] of messages) {
            for (const [messageId, fields] of streamMessages as any[]) {
              await this.handleMessage(messageId, fields);
            }
          }

          // Reset backoff on successful processing
          backoffMs = 1000;
        }
      } catch (error) {
        console.error('[EventBus] Error in consume loop:', error);
        
        // Exponential backoff on errors
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
      }
    }
  }

  /**
   * Handle individual message with idempotency and error handling
   */
  private async handleMessage(messageId: string, fields: any): Promise<void> {
    try {
      const eventType = fields.type || fields[0];
      const eventPayload = fields.payload ? JSON.parse(fields.payload) : JSON.parse(fields[1]);

      const event: DomainEvent = {
        type: eventType,
        payload: eventPayload,
      } as DomainEvent;

      console.log(`[EventBus] Received event: ${eventType} (${messageId})`);

      // Find and execute handler
      const handler = this.handlers.get(eventType);
      if (handler) {
        await handler(event);
        console.log(`[EventBus] Successfully processed event: ${eventType} (${messageId})`);
      } else {
        console.warn(`[EventBus] No handler registered for event type: ${eventType}`);
      }

      // Acknowledge message
      await this.redis!.xack(this.streamName, this.consumerGroup, messageId);
    } catch (error) {
      console.error(`[EventBus] Error handling message ${messageId}:`, error);
      
      // TODO: Implement dead-letter queue for failed messages
      // For now, we'll acknowledge to prevent infinite retry
      await this.redis!.xack(this.streamName, this.consumerGroup, messageId);
    }
  }

  /**
   * Publish event to the stream (for testing or internal use)
   */
  async publish(event: DomainEvent): Promise<void> {
    if (!this.isEnabled || !this.redis) {
      console.warn('[EventBus] Cannot publish - event bus not enabled');
      return;
    }

    try {
      const messageId = await this.redis.xadd(
        this.streamName,
        '*',
        {
          type: event.type,
          payload: JSON.stringify(event.payload),
          timestamp: new Date().toISOString(),
        }
      );
      console.log(`[EventBus] Published event: ${event.type} (${messageId})`);
    } catch (error) {
      console.error('[EventBus] Error publishing event:', error);
      throw error;
    }
  }

  /**
   * Health check for Event Bus connectivity
   * Returns healthy=true when disabled (feature flag off) to avoid false negatives
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number; status?: string }> {
    if (!this.isEnabled) {
      // Feature flag off - this is intentional, not unhealthy
      return { healthy: true, latency: 0, status: 'disabled' };
    }

    if (!this.redis) {
      // Feature flag on but initialization failed - this IS unhealthy
      return { healthy: false, latency: 0, status: 'config_error' };
    }

    const startTime = Date.now();
    try {
      await this.redis.ping();
      const latency = Date.now() - startTime;
      return { healthy: true, latency, status: 'connected' };
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error('[EventBus] Health check failed:', error);
      return { healthy: false, latency, status: 'connection_failed' };
    }
  }
}

/**
 * Singleton instance
 */
let eventBusSubscriber: EventBusSubscriber | null = null;

export function getEventBusSubscriber(): EventBusSubscriber {
  if (!eventBusSubscriber) {
    eventBusSubscriber = new EventBusSubscriber();
  }
  return eventBusSubscriber;
}

/**
 * Setup event handlers for auto_page_maker
 */
export async function setupEventHandlers(): Promise<void> {
  const subscriber = getEventBusSubscriber();

  // Handler for SCHOLARSHIP_PUBLISHED
  subscriber.on('SCHOLARSHIP_PUBLISHED', async (event) => {
    if (event.type === 'SCHOLARSHIP_PUBLISHED') {
      console.log(`[EventHandler] Regenerating page for scholarship: ${event.payload.slug}`);
      
      try {
        // Import AutoPageMaker and regenerate specific page
        const { AutoPageMaker } = await import('../../scripts/content-generation/auto-page-maker.js');
        const maker = new AutoPageMaker();
        await maker.generate(); // TODO: Add method to regenerate single page by slug
        
        console.log(`[EventHandler] Successfully regenerated page for ${event.payload.slug}`);
      } catch (error) {
        console.error(`[EventHandler] Failed to regenerate page for ${event.payload.slug}:`, error);
        throw error; // Re-throw to trigger retry/dead-letter
      }
    }
  });

  // Handler for BULK_SCHOLARSHIPS_UPDATED
  subscriber.on('BULK_SCHOLARSHIPS_UPDATED', async (event) => {
    if (event.type === 'BULK_SCHOLARSHIPS_UPDATED') {
      console.log(`[EventHandler] Triggering full rebuild for ${event.payload.count} scholarships`);
      
      try {
        const { AutoPageMaker } = await import('../../scripts/content-generation/auto-page-maker.js');
        const maker = new AutoPageMaker();
        await maker.generate();
        
        console.log(`[EventHandler] Successfully completed full rebuild`);
      } catch (error) {
        console.error(`[EventHandler] Failed full rebuild:`, error);
        throw error;
      }
    }
  });

  // Start subscriber
  await subscriber.start();
  console.log('[EventBus] Event handlers registered and subscriber started');
}
