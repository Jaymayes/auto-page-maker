# Thursday Optimization Sprint - Detailed Scope & Implementation Plan
**Trigger:** Wednesday gates fail (FCP P75 >2.4s OR LCP P75 >2.8s)  
**Authority:** Pre-approved by CTO/VP Engineering  
**Timeline:** 1 day (Thursday) → Ship Friday if gates pass

---

## Objective

**Bundle Reduction:** -23-33 KB gz (from 87.98 KB → ≤75 KB target)  
**LCP Recovery:** -150-300ms improvement  
**Constraints:** Code-only strategies, NO vite.config.ts modifications (FORBIDDEN_CHANGES)

---

## Strategy 1: Route & Component-Level Lazy-Loading

### Target: -10-15 KB gz | -100-150ms LCP

### Files to Modify

**1. client/src/App.tsx** - Lazy-load heavy routes
```typescript
// BEFORE
import ScholarshipCategory from "@/pages/scholarship-category";

// AFTER
const ScholarshipCategory = lazy(() => import("@/pages/scholarship-category"));
```

**Impact:** scholarship-category.tsx is 27.51 KB gz chunk → defer until navigation

**2. client/src/pages/landing.tsx** - Lazy-load below-the-fold components
```typescript
// Defer heavy sections until user scrolls
const FeaturedScholarships = lazy(() => import("@/components/featured-scholarships"));
const HowItWorks = lazy(() => import("@/components/how-it-works"));
```

**Impact:** Reduce initial bundle, load below-fold content on demand

**3. client/src/components/filters-sidebar.tsx** - Defer filter UI
```typescript
// Filters only needed when user clicks "Filter" button
const FiltersSidebar = lazy(() => import("@/components/filters-sidebar"));
```

**Impact:** Heavy Radix components (Select, Slider, RadioGroup) not loaded until interaction

### Implementation Steps

1. **Add React.lazy wrapper** to route-level components:
   - scholarship-category.tsx (priority 1)
   - seo-landing.tsx (priority 2)
   - not-found.tsx (low priority)

2. **Wrap with Suspense** boundaries:
```typescript
<Suspense fallback={<Skeleton className="h-screen" />}>
  <ScholarshipCategory />
</Suspense>
```

3. **Test loading states:**
   - Verify skeletons appear during chunk loading
   - Test slow 3G to ensure fallback works
   - Check no layout shift during load

### Estimated Savings: 10-15 KB gz

---

## Strategy 2: Radix UI Footprint Reduction

### Target: -8-10 KB gz | -50-80ms LCP

### Audit: Installed vs. Used Packages

**INSTALLED (29 packages):**
- @radix-ui/react-accordion
- @radix-ui/react-alert-dialog ❌ UNUSED
- @radix-ui/react-aspect-ratio ❌ UNUSED
- @radix-ui/react-avatar
- @radix-ui/react-checkbox
- @radix-ui/react-collapsible ❌ UNUSED
- @radix-ui/react-context-menu ❌ UNUSED
- @radix-ui/react-dialog ✅ USED (Header mobile menu)
- @radix-ui/react-dropdown-menu
- @radix-ui/react-hover-card ❌ UNUSED
- @radix-ui/react-label ✅ USED (Forms)
- @radix-ui/react-menubar ❌ UNUSED
- @radix-ui/react-navigation-menu ❌ UNUSED
- @radix-ui/react-popover
- @radix-ui/react-progress ❌ UNUSED
- @radix-ui/react-radio-group ❌ UNUSED
- @radix-ui/react-scroll-area ❌ UNUSED
- @radix-ui/react-select ✅ USED (Filters)
- @radix-ui/react-separator
- @radix-ui/react-slider ❌ UNUSED
- @radix-ui/react-slot ✅ USED (Button)
- @radix-ui/react-switch ❌ UNUSED
- @radix-ui/react-tabs ✅ USED (scholarship-category)
- @radix-ui/react-toast ✅ USED (Notifications)
- @radix-ui/react-toggle ✅ USED (Filter buttons)
- @radix-ui/react-toggle-group ❌ UNUSED
- @radix-ui/react-tooltip ✅ USED (Info icons)

**REMOVE (15 unused packages):**
```bash
npm uninstall @radix-ui/react-alert-dialog \
  @radix-ui/react-aspect-ratio \
  @radix-ui/react-collapsible \
  @radix-ui/react-context-menu \
  @radix-ui/react-hover-card \
  @radix-ui/react-menubar \
  @radix-ui/react-navigation-menu \
  @radix-ui/react-progress \
  @radix-ui/react-radio-group \
  @radix-ui/react-scroll-area \
  @radix-ui/react-slider \
  @radix-ui/react-switch \
  @radix-ui/react-toggle-group
```

### Per-Component Import Optimization

**BEFORE (barrel imports):**
```typescript
import { Button } from "@/components/ui/button";
```

**AFTER (stays same - already optimized):**
```typescript
// shadcn/ui components already use per-file imports
// No change needed here
```

### Remove Unused UI Component Files

**Audit client/src/components/ui/ directory:**
- Delete files for removed Radix packages
- Keep only: button, card, skeleton, badge, tabs, toast, tooltip, toggle, label, select

**Command:**
```bash
cd client/src/components/ui
# Remove unused component files after package removal
```

### Estimated Savings: 8-10 KB gz

---

## Strategy 3: Icon Optimization - Local Proxy Pattern

### Target: -5-8 KB gz | -30-50ms LCP

### Current State (Post-Tuesday)
- 6 main files converted to per-icon imports ✓
- TypeScript declarations created ✓
- **Problem:** Tree-shaking not working without vite.config.ts alias

### Solution: Local Icon Proxy (Code-Only)

**Create client/src/icons/index.ts:**
```typescript
// Re-export ONLY used icons from full paths
// This ensures bundler sees explicit dependencies

// Landing page icons (9)
export { default as Search } from "lucide-react/dist/esm/icons/search";
export { default as GraduationCap } from "lucide-react/dist/esm/icons/graduation-cap";
export { default as MapPin } from "lucide-react/dist/esm/icons/map-pin";
export { default as DollarSign } from "lucide-react/dist/esm/icons/dollar-sign";
export { default as Clock } from "lucide-react/dist/esm/icons/clock";
export { default as Star } from "lucide-react/dist/esm/icons/star";
export { default as TrendingUp } from "lucide-react/dist/esm/icons/trending-up";
export { default as Users } from "lucide-react/dist/esm/icons/users";
export { default as Award } from "lucide-react/dist/esm/icons/award";

// Header icons (4)
export { default as Menu } from "lucide-react/dist/esm/icons/menu";
export { default as X } from "lucide-react/dist/esm/icons/x";
export { default as ChevronDown } from "lucide-react/dist/esm/icons/chevron-down";

// Scholarship card icons (9)
export { default as ExternalLink } from "lucide-react/dist/esm/icons/external-link";
export { default as Bookmark } from "lucide-react/dist/esm/icons/bookmark";
export { default as Send } from "lucide-react/dist/esm/icons/send";
export { default as AlertTriangle } from "lucide-react/dist/esm/icons/alert-triangle";

// Category page icons (4)
export { default as ChevronRight } from "lucide-react/dist/esm/icons/chevron-right";
export { default as Filter } from "lucide-react/dist/esm/icons/filter";

// SEO landing icons (3 additional)
export { default as Target } from "lucide-react/dist/esm/icons/target";
export { default as BookOpen } from "lucide-react/dist/esm/icons/book-open";
export { default as Globe } from "lucide-react/dist/esm/icons/globe";

// Not found icon (1)
export { default as AlertCircle } from "lucide-react/dist/esm/icons/alert-circle";
```

**Update all component imports:**
```typescript
// BEFORE
import Search from "lucide-react/dist/esm/icons/search";

// AFTER
import { Search } from "@/icons";
```

**Why this works:**
- Single entry point for all icons
- Explicit ESM imports with full paths
- No reliance on vite.config.ts alias
- Bundler can tree-shake unused icon files
- Type-safe with TypeScript

### Implementation Steps

1. **Create icon proxy:** `client/src/icons/index.ts` with all 23 icons
2. **Update imports** in 6 component files:
   - landing.tsx
   - header.tsx
   - scholarship-card.tsx
   - scholarship-category.tsx
   - seo-landing.tsx
   - not-found.tsx
3. **Delete old declaration:** Remove `client/src/lucide.d.ts` (no longer needed)
4. **Build test:** Verify bundle size reduction

### Estimated Savings: 5-8 KB gz

---

## Strategy 4: Defer Non-Essential Scripts

### Target: -0-2 KB gz | -20-40ms LCP (mostly timing improvement)

### Audit Current Script Loading

**client/index.html:**
```html
<!-- GA4 already deferred ✓ -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
```

### Additional Optimizations

**1. Move analytics initialization to idle:**
```typescript
// client/src/lib/analytics.ts
// Defer gtag initialization until requestIdleCallback
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => initializeAnalytics());
} else {
  setTimeout(() => initializeAnalytics(), 1000);
}
```

**2. Lazy-load performance metrics:**
```typescript
// Only initialize Web Vitals tracking after LCP
onLCP(() => {
  import('@/lib/performance-metrics').then(({ initializeWebVitals }) => {
    initializeWebVitals();
  });
});
```

### Estimated Savings: 0-2 KB gz (mostly LCP timing improvement)

---

## Combined Implementation Plan

### Phase 1: Morning (9am-12pm) - Core Optimizations

**Task 1: Lazy-Loading (2 hours)**
- [ ] Add React.lazy to scholarship-category route
- [ ] Add Suspense boundaries with skeleton fallbacks
- [ ] Test loading states on slow 3G
- [ ] Verify no layout shift

**Task 2: Radix Pruning (1 hour)**
- [ ] Uninstall 15 unused Radix packages
- [ ] Remove corresponding UI component files
- [ ] Run npm run build to verify no import errors
- [ ] Test all pages for UI regressions

**Checkpoint at 12:00pm:**
```bash
npm run build
ls -lh dist/public/assets/*.js | grep -v map
# Target: ≤80 KB gz (halfway to goal)
```

### Phase 2: Afternoon (12pm-2pm) - Icon Proxy + Scripts

**Task 3: Icon Proxy (1.5 hours)**
- [ ] Create client/src/icons/index.ts with 23 icon re-exports
- [ ] Update imports in 6 component files
- [ ] Delete client/src/lucide.d.ts
- [ ] Build test: verify tree-shaking works

**Task 4: Script Deferral (0.5 hours)**
- [ ] Move analytics init to requestIdleCallback
- [ ] Lazy-load Web Vitals after LCP
- [ ] Test analytics still fires correctly

**Checkpoint at 2:00pm:**
```bash
npm run build
# Target: ≤75 KB gz (goal achieved)
```

### Phase 3: QA & Testing (2pm-3pm)

**Functional Testing:**
- [ ] Homepage loads correctly
- [ ] Scholarship search works
- [ ] Category pages render
- [ ] Mobile menu functions
- [ ] Analytics fires

**Visual Regression:**
- [ ] Desktop layout intact
- [ ] Mobile layout intact
- [ ] Skeletons appear during lazy-load
- [ ] Icons render correctly
- [ ] No console errors

**Performance Verification:**
- [ ] npm run build → check bundle sizes
- [ ] Verify main bundle ≤75 KB gz
- [ ] Test lazy-loaded chunks load on demand

### Phase 4: WebPageTest (3pm-4pm)

**Execute Measurement:**
- [ ] Same config as Wednesday (Moto G4, Slow 4G, 10 runs)
- [ ] Wait for completion (~20 minutes)
- [ ] Extract P75 FCP, P75 LCP
- [ ] Compare against gates

### Phase 5: Results Analysis (4pm-5pm)

**Decision Logic:**
```
IF FCP_P75 ≤ 2400ms AND LCP_P75 ≤ 2800ms:
  ✅ SUCCESS - Ship Friday 10am
  
IF FCP_P75 > 2400ms OR LCP_P75 > 2800ms:
  ⚠️ PARTIAL SUCCESS - Escalate to exec for decision
  Options:
  1. Additional optimization Friday (lazy-load more routes)
  2. Accept current state (document trade-offs)
  3. Defer to next sprint (engineering debt)
```

---

## Success Criteria

**Hard Requirements:**
- ✅ Main bundle ≤75 KB gz
- ✅ FCP P75 ≤2.4s on WebPageTest
- ✅ LCP P75 ≤2.8s on WebPageTest
- ✅ No functional regressions
- ✅ No visual regressions

**Soft Requirements:**
- CLS P75 ≤0.1 (informational)
- TTFB unchanged or improved
- Error rate stable
- User-facing performance "feels" faster

---

## Rollback Plan

**If optimization breaks functionality:**
1. Revert feature branch immediately
2. Deploy previous main branch
3. Investigate issues offline
4. Re-attempt Friday with fixes

**Git Strategy:**
- Branch: `feat/phase3-bundle-optimization`
- Squash commits before merge
- Tag deploy: `v1.0-phase3-optimized`
- Easy rollback: `git revert [tag]`

---

## Estimated Savings Summary

| Strategy | Bundle Reduction | LCP Improvement |
|----------|------------------|-----------------|
| Lazy-Loading | -10-15 KB gz | -100-150ms |
| Radix Pruning | -8-10 KB gz | -50-80ms |
| Icon Proxy | -5-8 KB gz | -30-50ms |
| Defer Scripts | -0-2 KB gz | -20-40ms |
| **TOTAL** | **-23-35 KB gz** | **-200-320ms** |

**Confidence Level:** HIGH (all proven techniques, minimal risk)

---

## Communication Checkpoints

**11:00am Thursday:** Post sprint scope in #release-channel (this document)  
**12:00pm Thursday:** Midpoint progress update (bundle size checkpoint)  
**3:00pm Thursday:** WebPageTest initiated (share link)  
**5:00pm Thursday:** Results posted with Friday deploy decision

---

**Status:** ✅ READY TO EXECUTE (if Wednesday gates fail)  
**Owner:** Performance Engineering Team  
**Authority:** Pre-approved by CTO/VP Engineering
