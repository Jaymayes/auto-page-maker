# Port Bindings Report

**Audit Date:** 2026-01-05T19:56 UTC

---

## A7 (auto_page_maker) Port Configuration

### Configured Bindings
| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Express + Vite | 5000 | HTTP | Frontend + Backend (single port) |

### Active Listeners
```
Process: node tsx server/index.ts
Binding: 0.0.0.0:5000
Status: RUNNING
PID: 205
```

### Workflow Status
- **Workflow**: "Start application" (`npm run dev`)
- **Status**: RUNNING
- **Boot time**: 2026-01-05T19:05
- **Heartbeats**: Accepted (200 from Command Center)

---

## Port Conflict Analysis

### Prior Issue
A workflow failed due to a port conflict (port already in use).

### Root Causes Investigated

| Hypothesis | Evidence | Conclusion |
|------------|----------|------------|
| Duplicate workflow instances | Single npm/tsx process tree | Not found |
| Orphan process holding port | No orphan listeners | Not found |
| Replit hot-reload collision | Vite handles gracefully | Not applicable |
| User manually started second server | No evidence in logs | Not found |

### Current State: NO CONFLICTS

```
Active processes:
runner 176 npm run dev
runner 194 node tsx server/index.ts
runner 205 node server/index.ts (main server)
runner 217 esbuild (TSX compiler)
runner 267 esbuild (Vite bundler)
```

---

## Replit Deployment Constraints

| Constraint | Status | Notes |
|------------|--------|-------|
| Single exposed port | Compliant | Port 5000 only |
| Frontend on 5000 | Compliant | Vite proxied through Express |
| No port < 1024 | Compliant | Using 5000 |
| Ephemeral ports | Managed | Node handles internally |

---

## Fleet Port Inventory

| App | Label | Expected Port | Actual | Status |
|-----|-------|---------------|--------|--------|
| scholar-auth | A1 | 5000 | Unknown (remote) | Responding |
| scholarship-api | A2 | 5000 | Unknown (remote) | Responding |
| scholarship-agent | A3 | 5000 | Unknown (remote) | Responding |
| scholarship-sage | A4 | 5000 | Unknown (remote) | Responding |
| student-pilot | A5 | 5000 | Unknown (remote) | Responding |
| provider-register | A6 | 5000 | Unknown (remote) | Responding |
| auto-page-maker | A7 | 5000 | 5000 | Active |
| auto-com-center | A8 | 5000 | Unknown (remote) | Responding |

---

## Remediation Plan

### If Port Conflict Recurs

1. **Immediate**: Restart workflow via Replit UI or agent tools

2. **Preventive**: Add port-check to startup
   ```typescript
   // Optional enhancement for server/index.ts
   import { createServer } from 'net';
   
   async function checkPort(port: number): Promise<boolean> {
     return new Promise(resolve => {
       const server = createServer();
       server.once('error', () => resolve(false));
       server.once('listening', () => { server.close(); resolve(true); });
       server.listen(port);
     });
   }
   ```

3. **Best Practice**: Always use workflow restart tools, not manual npm commands

---

## Verdict

| Check | Status |
|-------|--------|
| Current port conflicts | NONE |
| Prior conflict | Likely transient (workflow restart resolved) |
| Remediation needed | Optional port-check enhancement |
