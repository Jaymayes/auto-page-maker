import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { existsSync } from 'fs';

export type PromptMode = 'separate' | 'universal';

export interface SystemPrompt {
  prompt: string;
  hash: string;
  version: string;
  app: string;
  loadedAt: Date;
  mode: PromptMode;
}

/**
 * Extract shared sections and app overlay from universal.prompt
 * Supports multiple formats:
 * - Legacy: [SHARED] and [APP: {appKey}]
 * - v1.1 Section format: Sections A-E (shared) + Overlay: {appKey}
 * - v1.1 Compact format: Sections A-E (shared) + numbered overlays "1. {appKey}"
 */
function extractOverlay(universalContent: string, appKey: string): string {
  const lines = universalContent.split('\n');
  const shared: string[] = [];
  const appOverlay: string[] = [];
  
  let currentSection: 'none' | 'shared' | 'target_app' | 'other_app' = 'none';
  
  // Support all formats
  const targetAppHeaderOld = `[APP: ${appKey}]`;
  const targetAppHeaderSection = `Overlay: ${appKey}`;
  // Numbered format: "1. executive_command_center" or "3. student_pilot (B2C revenue)"
  // Captures app name even with optional text after it
  const numberedPattern = /^\d+\.\s+(\w+)(?:\s|$)/;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect shared sections (all formats)
    if (trimmed === '[SHARED]' || trimmed.match(/^[A-E]\)/)) {
      // In v1.1, sections A-E are shared, F contains overlays
      if (trimmed.match(/^F\)/)) {
        currentSection = 'none'; // Stop collecting shared
        shared.push(line); // Include the "F) App Overlays" header
        continue;
      }
      if (currentSection === 'none' || currentSection === 'shared') {
        currentSection = 'shared';
        shared.push(line);
        continue;
      }
    }
    
    // Detect target app overlay (numbered format: "1. executive_command_center")
    const numberedMatch = trimmed.match(numberedPattern);
    if (numberedMatch && numberedMatch[1] === appKey) {
      currentSection = 'target_app';
      appOverlay.push(line);
      continue;
    }
    
    // Detect target app overlay (other formats)
    if (trimmed === targetAppHeaderOld || trimmed === targetAppHeaderSection) {
      currentSection = 'target_app';
      appOverlay.push(line);
      continue;
    }
    
    // Detect other app overlays - stop collecting this overlay
    if (numberedMatch && numberedMatch[1] !== appKey) {
      // Hit another numbered overlay
      if (currentSection === 'target_app') {
        // We were in target app, now we're done
        break;
      }
      currentSection = 'other_app';
      continue;
    }
    
    // Detect other app overlays (old formats)
    if ((trimmed.startsWith('[APP:') && trimmed !== targetAppHeaderOld) ||
        (trimmed.startsWith('Overlay:') && trimmed !== targetAppHeaderSection)) {
      if (currentSection === 'target_app') {
        break;
      }
      currentSection = 'other_app';
      continue;
    }
    
    // Section boundaries (G, H, etc.) - include in shared for all apps
    if (trimmed.match(/^[G-H]\)/)) {
      if (currentSection === 'target_app') {
        // We were in an app overlay, now we're at G/H which applies to all
        // Include G and H in the target app
        appOverlay.push(line);
        continue;
      }
      currentSection = 'shared';
      shared.push(line);
      continue;
    }
    
    // Add content to appropriate section
    if (currentSection === 'shared') {
      shared.push(line);
    } else if (currentSection === 'target_app') {
      appOverlay.push(line);
    }
  }
  
  if (appOverlay.length === 0) {
    throw new Error(`Overlay not found for app: ${appKey} in universal.prompt`);
  }
  
  return `${shared.join('\n')}\n\n---\n\n${appOverlay.join('\n')}`;
}

/**
 * Load prompt using universal.prompt with runtime overlay selection
 */
async function loadUniversalPrompt(appName: string): Promise<SystemPrompt> {
  const universalPath = process.env.UNIVERSAL_PROMPT_PATH || 'docs/system-prompts/universal.prompt';
  
  if (!existsSync(universalPath)) {
    throw new Error(`Universal prompt not found: ${universalPath}`);
  }
  
  const universalContent = await readFile(universalPath, 'utf-8');
  const combinedPrompt = extractOverlay(universalContent, appName);
  
  const hash = createHash('sha256')
    .update(combinedPrompt)
    .digest('hex')
    .substring(0, 16);
  
  const version = process.env.BUILD_VERSION || process.env.REPL_SLUG || 'workspace';
  
  console.log(`[System Prompt] Loaded universal - App: ${appName}, Hash: ${hash}, Mode: universal`);
  
  return {
    prompt: combinedPrompt,
    hash,
    version,
    app: appName,
    loadedAt: new Date(),
    mode: 'universal',
  };
}

/**
 * Load prompt using separate files (shared + app-specific)
 */
async function loadSeparatePrompt(appName: string): Promise<SystemPrompt> {
  const sharedPath = process.env.SHARED_PROMPT_PATH || 'docs/system-prompts/shared_directives.prompt';
  const appPath = process.env.SYSTEM_PROMPT_PATH || `docs/system-prompts/${appName}.prompt`;

  // Check files exist
  if (!existsSync(sharedPath)) {
    throw new Error(`Shared prompt not found: ${sharedPath}`);
  }
  if (!existsSync(appPath)) {
    throw new Error(`App prompt not found: ${appPath}`);
  }

  const [sharedContent, appContent] = await Promise.all([
    readFile(sharedPath, 'utf-8'),
    readFile(appPath, 'utf-8'),
  ]);

  // Combine: shared first, then app-specific overlay
  const combinedPrompt = `${sharedContent}\n\n---\n\n${appContent}`;
  
  // Generate hash for verification
  const hash = createHash('sha256')
    .update(combinedPrompt)
    .digest('hex')
    .substring(0, 16);
  
  // Version from environment or build
  const version = process.env.BUILD_VERSION || process.env.REPL_SLUG || 'workspace';

  console.log(`[System Prompt] Loaded separate - App: ${appName}, Hash: ${hash}, Mode: separate`);
  
  return {
    prompt: combinedPrompt,
    hash,
    version,
    app: appName,
    loadedAt: new Date(),
    mode: 'separate',
  };
}

/**
 * Main loader - checks PROMPT_MODE feature flag and routes to appropriate loader
 */
export async function loadSystemPrompt(appName?: string): Promise<SystemPrompt> {
  const app = appName || process.env.APP_NAME || 'executive_command_center';
  const mode = (process.env.PROMPT_MODE || 'separate') as PromptMode;

  try {
    if (mode === 'universal') {
      return await loadUniversalPrompt(app);
    } else {
      return await loadSeparatePrompt(app);
    }
  } catch (error) {
    console.error('[System Prompt] Failed to load:', error);
    throw new Error(`System prompt initialization failed for ${app}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function getPromptMetadata(prompt: SystemPrompt) {
  return {
    app: prompt.app,
    promptHash: prompt.hash,
    activeVersion: prompt.version,
    loadedAt: prompt.loadedAt.toISOString(),
    mode: prompt.mode,
  };
}

/**
 * Get raw overlay content from universal.prompt for debugging
 */
export async function getOverlayContent(appKey: string): Promise<string> {
  const universalPath = process.env.UNIVERSAL_PROMPT_PATH || 'docs/system-prompts/universal.prompt';
  
  if (!existsSync(universalPath)) {
    throw new Error(`Universal prompt not found: ${universalPath}`);
  }
  
  const universalContent = await readFile(universalPath, 'utf-8');
  return extractOverlay(universalContent, appKey);
}

export async function verifyAllPrompts(): Promise<{
  success: boolean;
  prompts: Array<{ app: string; hash: string; exists: boolean; error?: string }>;
}> {
  const apps = [
    'executive_command_center',
    'auto_page_maker',
    'provider_register',
    'scholarship_api',
    'scholarship_agent',
    'student_pilot',
    'scholar_auth',
    'scholarship_sage',
  ];

  const results = await Promise.allSettled(
    apps.map(async (app) => {
      const prompt = await loadSystemPrompt(app);
      return { app, hash: prompt.hash, exists: true };
    })
  );

  const prompts = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        app: apps[index],
        hash: '',
        exists: false,
        error: result.reason.message,
      };
    }
  });

  const allExist = prompts.every((p) => p.exists);
  const hashesUnique = new Set(prompts.map((p) => p.hash)).size === prompts.length;

  return {
    success: allExist && hashesUnique,
    prompts,
  };
}
