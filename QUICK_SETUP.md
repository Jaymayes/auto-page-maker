# Quick Integration Setup Guide

## Step 1: Add Secrets to Replit

Go to Secrets tab (lock icon) and add these **exact** environment variables:

```
SHARED_SECRET = <your-command-center-shared-secret>
COMMAND_CENTER_URL = https://auto-com-center-jamarrlmayes.replit.app
AGENT_NAME = scholarmatch
AGENT_ID = scholarmatch-monolith
AGENT_BASE_URL = https://auto-page-maker-jamarrlmayes.replit.app
```

**Important**: Replace `AGENT_BASE_URL` with your actual Replit app URL if different.

## Step 2: Restart Application

After adding secrets, restart your Replit app. You should see:
```
[agent-bridge] Registering with Command Center...
[agent-bridge] Registration successful
[agent-bridge] Heartbeat started
```

## Step 3: Verify Integration

Run the integration test:
```bash
./test-command-center.sh
```

Expected results:
- ✅ Agent registered and online
- ✅ All 6 capabilities available
- ✅ Tasks dispatch and complete successfully
- ✅ Events logged with trace correlation

## Ready to Test!
The Agent Bridge is fully implemented and ready for Command Center integration.