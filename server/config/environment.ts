import { z } from 'zod';

// Environment configuration schema with strict validation
const ConfigSchema = z.object({
  // Required in production
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  
  // Agent Bridge - required for integration (support both secret names)
  AGENT_BRIDGE_SHARED_SECRET: z.string().min(32, 'AGENT_BRIDGE_SHARED_SECRET must be at least 32 characters').optional(),
  SHARED_SECRET: z.string().min(32, 'SHARED_SECRET must be at least 32 characters').optional(),
  COMMAND_CENTER_URL: z.string().url('COMMAND_CENTER_URL must be a valid URL').optional(),
  AGENT_BASE_URL: z.string().url('AGENT_BASE_URL must be a valid URL').optional(),
  AGENT_NAME: z.string().min(1).optional(),
  AGENT_ID: z.string().min(1).optional(),
  
  // Optional services
  OPENAI_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  DATABASE_URL: z.string().optional(),
  USE_SAMPLE_DATA: z.string().optional(),
  
  // Replit environment variables
  REPL_SLUG: z.string().optional(),
  REPL_OWNER: z.string().optional(),
  REPL_ID: z.string().optional(),
});

// Parse and validate environment
const parseEnvironment = () => {
  const rawEnv = ConfigSchema.parse(process.env);
  
  // Support both AGENT_BRIDGE_SHARED_SECRET and SHARED_SECRET with fallback
  const sharedSecret = rawEnv.AGENT_BRIDGE_SHARED_SECRET || rawEnv.SHARED_SECRET;
  
  const env = {
    ...rawEnv,
    SHARED_SECRET: sharedSecret
  };
  
  // Production requirements - JWT_SECRET is mandatory
  if (env.NODE_ENV === 'production') {
    if (!env.JWT_SECRET) {
      console.error('[CONFIG] FATAL: JWT_SECRET is required in production');
      process.exit(1);
    }
    
    // Database requirements - can be bypassed with USE_SAMPLE_DATA
    const useSampleData = env.USE_SAMPLE_DATA === 'true';
    if (!env.DATABASE_URL && !useSampleData) {
      console.error('[CONFIG] FATAL: DATABASE_URL is required in production (or set USE_SAMPLE_DATA=true for temporary deployment)');
      process.exit(1);
    }
    
    if (useSampleData) {
      console.warn('[CONFIG] Production deployment using sample data - replace with real database before launch');
    }
    
    // Agent Bridge is optional - warn if missing but don't exit
    const agentFields = ['SHARED_SECRET', 'COMMAND_CENTER_URL', 'AGENT_BASE_URL', 'AGENT_NAME', 'AGENT_ID'];
    const missingAgentFields = agentFields.filter(field => !env[field as keyof typeof env]);
    
    if (missingAgentFields.length > 0) {
      console.warn(`[CONFIG] Agent Bridge disabled in production: missing ${missingAgentFields.join(', ')}`);
    }
  }
  
  // Development warnings
  if (env.NODE_ENV === 'development') {
    const warnings: string[] = [];
    
    if (!env.SHARED_SECRET) warnings.push('SHARED_SECRET - Agent Bridge disabled');
    if (!env.OPENAI_API_KEY) warnings.push('OPENAI_API_KEY - Content generation disabled');
    if (!env.JWT_SECRET) warnings.push('JWT_SECRET - Authentication disabled');
    
    if (warnings.length > 0) {
      console.warn('\n🔧 [CONFIG] Development mode - Some features disabled:');
      warnings.forEach(warning => console.warn(`   ❌ ${warning}`));
      console.warn('   Add missing secrets to enable full functionality\n');
    }
  }
  
  return env;
};

// Safe URL construction helper
export const buildAgentUrl = (path: string): string => {
  const baseUrl = config.AGENT_BASE_URL || 
    (config.REPL_SLUG && config.REPL_OWNER 
      ? `https://${config.REPL_SLUG}-${config.REPL_OWNER}.replit.app`
      : 'http://localhost:5000');
  
  try {
    return new URL(path, baseUrl).href;
  } catch (error) {
    console.error(`[CONFIG] Invalid URL construction: base=${baseUrl}, path=${path}`);
    throw new Error('Invalid agent URL configuration');
  }
};

// Export validated configuration
export const config = parseEnvironment();

// Feature flags based on configuration
export const features = {
  agentBridge: !!config.SHARED_SECRET && !!config.COMMAND_CENTER_URL,
  contentGeneration: !!config.OPENAI_API_KEY,
  authentication: !!config.JWT_SECRET,
  database: !!config.DATABASE_URL,
} as const;

// Security configuration status
export const getSecurityStatus = () => ({
  agentBridge: features.agentBridge ? 'enabled' : 'disabled',
  contentGeneration: features.contentGeneration ? 'enabled' : 'disabled', 
  authentication: features.authentication ? 'enabled' : 'disabled',
  environment: config.NODE_ENV,
  warnings: config.NODE_ENV === 'production' ? [] : [
    ...(!config.SHARED_SECRET ? ['Agent Bridge disabled - add SHARED_SECRET'] : []),
    ...(!config.OPENAI_API_KEY ? ['Content generation disabled - add OPENAI_API_KEY'] : []),
    ...(!config.JWT_SECRET ? ['Authentication disabled - add JWT_SECRET'] : []),
  ]
});

export type Config = typeof config;
export type Features = typeof features;