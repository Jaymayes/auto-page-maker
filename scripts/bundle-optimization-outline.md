# Bundle Optimization Branch - Implementation Guide

**Target:** Reduce main JS bundle from 90.11KB gz → 70-75KB gz (-15-20KB)

## High-Priority Optimizations

### 1. Lucide Icons Tree-Shaking (-12KB gz estimated)

**Problem:** Currently loading entire Lucide library (~40KB raw, ~12KB gz)  
**Icons Used:** 23 total (AlertCircle, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, Dot, GripVertical, MoreHorizontal, PanelLeft, Search, X, GraduationCap, MapPin, DollarSign, Clock, Star, TrendingUp, Users, Award)

**Implementation:**

```typescript
// BEFORE (client/src/pages/landing.tsx)
import { 
  Search, 
  GraduationCap, 
  MapPin, 
  DollarSign,
  Clock,
  Star,
  TrendingUp,
  Users,
  Award
} from "lucide-react";

// AFTER - Per-icon imports
import Search from "lucide-react/dist/esm/icons/search";
import GraduationCap from "lucide-react/dist/esm/icons/graduation-cap";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Clock from "lucide-react/dist/esm/icons/clock";
import Star from "lucide-react/dist/esm/icons/star";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Users from "lucide-react/dist/esm/icons/users";
import Award from "lucide-react/dist/esm/icons/award";
```

**Files to Update:**
- client/src/pages/landing.tsx (9 icons)
- client/src/components/header.tsx (4 icons: Menu, X, Search, ChevronDown)
- client/src/components/footer.tsx (check for icons)
- client/src/pages/scholarship-category.tsx (check for icons)
- client/src/components/scholarship-card.tsx (check for icons)
- All UI components in client/src/components/ui/ (various icons)

**Verification:**
```bash
# After changes, rebuild and check bundle size
npm run build
# Main JS should be ~78KB gz (down from 90KB)
```

---

### 2. Radix UI Component Pruning (-8-10KB gz estimated)

**Problem:** 27 Radix packages installed, likely only using ~10-12  
**Strategy:** Remove unused Radix primitives + lazy-load heavy components

**Audit Process:**
```bash
# Find all Radix imports
grep -rh "@radix-ui" client/src/ | sort -u
```

**Likely Unused (Remove):**
- @radix-ui/react-menubar (if not in header)
- @radix-ui/react-navigation-menu (if using simple links)
- @radix-ui/react-context-menu
- @radix-ui/react-hover-card
- @radix-ui/react-toggle
- @radix-ui/react-toggle-group
- @radix-ui/react-aspect-ratio
- @radix-ui/react-collapsible
- @radix-ui/react-progress
- @radix-ui/react-radio-group
- @radix-ui/react-slider
- @radix-ui/react-sidebar
- @radix-ui/react-tabs
- @radix-ui/react-calendar
- @radix-ui/react-carousel
- @radix-ui/react-checkbox
- @radix-ui/react-resizable

**Lazy-Load Heavy Components:**
```typescript
// Dialog and Popover are heavy - lazy load them
const Dialog = lazy(() => import("@/components/ui/dialog"));
const Popover = lazy(() => import("@/components/ui/popover"));
```

**Uninstall Script:**
```bash
npm uninstall @radix-ui/react-menubar @radix-ui/react-navigation-menu \
  @radix-ui/react-context-menu @radix-ui/react-hover-card \
  @radix-ui/react-toggle @radix-ui/react-toggle-group \
  @radix-ui/react-aspect-ratio @radix-ui/react-collapsible \
  @radix-ui/react-progress @radix-ui/react-radio-group \
  @radix-ui/react-slider @radix-ui/react-sidebar \
  @radix-ui/react-tabs @radix-ui/react-calendar \
  @radix-ui/react-carousel @radix-ui/react-checkbox \
  @radix-ui/react-resizable
```

---

### 3. Bundle Analyzer Setup

**Install:**
```bash
npm install --save-dev rollup-plugin-visualizer
```

**Vite Config (already attempted, but as reference):**
```javascript
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: './dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      open: false
    })
  ]
});
```

**Note:** vite.config.ts is locked - use npm package script instead:
```json
{
  "scripts": {
    "analyze": "vite build && rollup-plugin-visualizer"
  }
}
```

---

## Execution Timeline (If Gates Missed Wednesday AM)

**9:30am ET:** Review WebPageTest results  
**10:00am ET:** If FCP P75 > 2.4s OR LCP P75 > 2.8s → Execute bundle optimization  
**10:15am-11:45am:** Lucide tree-shaking (75 minutes)  
**11:45am-12:15pm:** Radix pruning (30 minutes)  
**12:15pm-12:45pm:** Rebuild, measure, verify gates (30 minutes)  
**12:45pm ET:** Re-deploy to staging if needed  

**Hard Cutoff:** 3pm ET Wednesday (per executive directive)

---

## Success Criteria

- **JS Bundle:** ≤75KB gz (currently 90.11KB)
- **FCP P75:** ≤2.4s on Mobile Slow 4G
- **LCP P75:** ≤2.8s on Mobile Slow 4G  
- **CLS:** ≤0.1 (already passing at 0.0008)
- **No regressions:** Error rate, conversion funnel intact

---

## Rollback Plan

If optimization causes runtime errors:
1. Revert to current commit (all changes in git)
2. Deploy previous known-good state
3. Monitor error logs for 15 minutes
4. Proceed to 25% canary with current bundle size, stricter rollback thresholds
