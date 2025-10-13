# Product Requirements Document: OANC/OANS Performance Optimization

**Version:** 1.0
**Date:** 2025-10-13
**Status:** Draft
**Author:** FlyByWire Development Team
**Target Aircraft:** A380X

---

## Executive Summary

The **OANC (Onboard Airport Navigation Chart)** system provides moving map displays of airport layouts for improved ground navigation during taxi operations. While functionally complete, the current implementation exhibits significant VRAM usage (~1GB per ND display) and performance degradation during both initial airport loading and continuous display.

This PRD outlines optimization strategies to reduce VRAM footprint, improve rendering performance, and maintain visual quality across all operational modes (PLAN, ARC, ROSE NAV) without compromising the user experience.

---

## 1. Problem Statement

### 1.1 Current Issues

**Performance Impact:**
- Noticeable FPS drops during airport map loading
- Continuous performance degradation while OANS is displayed
- Impact observable even at smaller airports, worse at large/complex airports

**VRAM Usage:**
- ~1GB VRAM per ND display (Captain + FO = ~2GB total when both active)
- No data sharing between dual displays
- Memory footprint scales with airport complexity

**Target Hardware:**
- Primary target: NVIDIA RTX 4070 Ti (12GB VRAM)
- Must remain functional on mid-range systems (8GB+ VRAM)

### 1.2 Use Cases

**Primary:** Ground taxi operations (aircraft on ground)
**Secondary:** Approach/departure planning (in-flight ARC/ROSE NAV modes)

---

## 2. Technical Architecture Analysis

### 2.1 Current Implementation

**Location:** `fbw-common/src/systems/instruments/src/OANC/Oanc.tsx`

**Canvas Architecture:**
```
Each OANC instance creates:
- 8 separate canvas layers per display
- Canvas dimensions = airport bounding box size (dynamic)
- Base resolution: 768x768 (display viewport)
- Actual canvas size: Variable based on airport geometry
- Current resolution scale: 0.75 (75% of full resolution)
```

**Rendering Pipeline:**
```
1. Data Load: Fetch airport data from Navigraph AMDB API
2. Data Sort: Split features into 8 rendering layers
3. Label Generation: Create DOM elements for all labels upfront
4. Incremental Draw: Render 50 features per frame (37.5 at 75% scale)
5. Continuous Transform: Apply zoom/pan/rotation transforms per frame
```

**Memory Breakdown (per display):**
```
8 canvases × (airport_width × airport_height × 4 bytes/pixel)

Example for large airport (estimated 5000×5000 area):
8 × (5000 × 5000 × 4) = ~800 MB

With 75% resolution scale:
8 × (3750 × 3750 × 4) = ~450 MB

Additional overhead:
- Path cache (Map<string, Path2D[]>)
- Label DOM elements
- Feature data in memory
- Transform calculations
≈ 500-600 MB additional
Total: ~1 GB per display
```

**Key Bottlenecks Identified:**

1. **Oversized Canvases**
   - Canvases sized to entire airport geometry (lines 754-761)
   - Large airports create canvases 5000×5000+ pixels
   - 8 layers multiply memory cost

2. **No Instance Sharing**
   - Captain and FO NDs each instantiate separate `Oanc` components
   - Complete data duplication (lines 238-246 in ND instrument.tsx)
   - No shared cache or resource pooling

3. **Continuous GPU Processing**
   - Transform calculations every frame (lines 1214-1235)
   - 8 separate CSS transforms per frame per display
   - No culling of off-screen content

4. **Label DOM Overhead**
   - Labels rendered as HTML divs (lines 794-827)
   - Continuous reflow calculations (line 1262)
   - No virtualization for off-screen labels

5. **Feature Drawing Strategy**
   - Incremental drawing (50 features/frame) prevents immediate display
   - Path cache grows unbounded (lines 1784-1785)
   - No cleanup on airport unload

---

## 3. Optimization Goals

### 3.1 Performance Targets

| Metric | Current | Target | Stretch Goal |
|--------|---------|--------|--------------|
| VRAM per display | ~1 GB | ≤500 MB | ≤300 MB |
| Initial load time | Variable | <2 seconds | <1 second |
| FPS impact | Notable drop | <10% drop | <5% drop |
| Dual display VRAM | ~2 GB | ≤1 GB | ≤600 MB |

### 3.2 Quality Requirements

- **Visual Fidelity:** Maintain current rendering quality at primary zoom levels
- **Feature Completeness:** All current features must remain functional
- **Compatibility:** Must work across ARC, ROSE NAV, and PLAN modes
- **Scalability:** Performance should scale gracefully from small to large airports

---

## 4. Proposed Optimization Strategies

### 4.1 Priority 1: Canvas Size Reduction (High Impact)

**Problem:** Canvases sized to entire airport geometry create massive memory footprint

**Solution: Viewport-Based Canvas Sizing**

```typescript
// Instead of:
canvas.width = airportBoundingBox.width;  // Could be 5000+px
canvas.height = airportBoundingBox.height;

// Use:
const MAX_CANVAS_SIZE = 2048; // Or 1024 for aggressive optimization
canvas.width = Math.min(MAX_CANVAS_SIZE, airportBoundingBox.width);
canvas.height = Math.min(MAX_CANVAS_SIZE, airportBoundingBox.height);
```

**Implementation Details:**
- Render only visible viewport + buffer zone
- Implement canvas repositioning on pan (redraw when needed)
- Trade-off: Some redraw on pan vs. massive memory savings

**Expected Impact:**
- VRAM reduction: 60-70% for large airports
- Minimal visual quality impact (content is scaled to 768px viewport anyway)

**Risks:**
- Need to handle pan events with redraw logic
- Potential flicker during rapid panning (mitigable with double buffering)

---

### 4.2 Priority 1: Layer Consolidation (High Impact)

**Problem:** 8 separate canvas layers multiply memory cost

**Solution: Reduce to 3-4 Essential Layers**

Current layer structure (lines 222-231):
```
0: Taxiway BG + Taxiway Shoulder
1: Apron + Stand BG + Buildings
2: Runway (with markings)
3: Runway (without markings)
4: Taxiway guidance lines (scaled width)
5: Taxiway guidance lines (unscaled width)
6: Stand guidance lines
7: Dynamic BTV content
```

**Proposed consolidation:**
```
0: Base layer (Taxiways, Aprons, Runways, Buildings)
1: Guidance lines (All guidance/marking lines)
2: Dynamic overlay (BTV paths, user markers)
3: [Optional] High-detail layer (only at close zoom)
```

**Implementation:**
- Merge layers 0, 1, 2, 3 → Single base layer
- Merge layers 4, 5, 6 → Single guidance layer
- Keep layer 7 for dynamic content
- Visibility rules (lines 102-108) become zoom-based feature filtering

**Expected Impact:**
- VRAM reduction: 50% (8 canvases → 4 canvases)
- Rendering complexity reduction

**Risks:**
- Need to adjust rendering order within consolidated layers
- May require style rule refactoring

---

### 4.3 Priority 1: Dual Display Data Sharing (High Impact)

**Problem:** Captain and FO NDs load identical airport data independently

**Solution: Shared Airport Data Cache**

**Architecture:**
```typescript
// New singleton service
class OancDataCache {
  private static instance: OancDataCache;
  private airportCache = new Map<string, {
    data: AmdbFeatureCollection,
    arpCoordinates: Coordinates,
    sortedLayers: FeatureCollection[],
    labels: Label[],
    timestamp: number
  }>();

  async getAirportData(icao: string): Promise<CachedAirportData> {
    // Check cache first, fetch if not present
    // Share between both displays
  }
}
```

**Implementation:**
- Singleton cache shared across L/R displays
- Each display still renders independently but uses shared source data
- Cache with TTL (e.g., 10 minutes) to handle memory over long sessions

**Expected Impact:**
- VRAM reduction: 30-40% when both displays active
- Faster load time for second display

**Risks:**
- Need to handle cache invalidation carefully
- Thread safety considerations (MSFS runs instruments on same thread)

---

### 4.4 Priority 2: Resolution Scaling Options (Medium Impact)

**Problem:** Current 75% resolution is fixed, no user control

**Solution: Dynamic Resolution Scaling**

**Current:**
```typescript
export const OANC_RESOLUTION_SCALE = 0.75; // Fixed
```

**Proposed:**
```typescript
// Runtime configurable
enum OancResolutionPreset {
  High = 1.0,      // Full resolution
  Medium = 0.75,   // Current default
  Low = 0.5,       // Performance mode
  Potato = 0.35    // Ultra-low for weak systems
}
```

**Implementation:**
- Add SimVar for resolution setting (future EFB integration)
- Scale both canvas size AND feature drawing density
- Adjust `FEATURE_DRAW_PER_FRAME` proportionally

**Expected Impact:**
- Low preset (0.5): Additional 50% VRAM savings
- Potato preset (0.35): Additional 75% VRAM savings
- User control for performance vs. quality trade-off

**Future Scope:**
- Phase 2: EFB settings page (not in initial scope)
- Phase 1: SimVar-based control for testing

---

### 4.5 Priority 2: Selective Feature Loading (Medium Impact)

**Problem:** All airport features loaded regardless of visibility

**Solution: LOD (Level of Detail) System**

**Zoom-Based Feature Filtering:**
```typescript
const FEATURE_LOD_RULES = {
  zoom_0_2nm: [
    FeatureType.RunwayElement,
    FeatureType.TaxiwayElement,
    FeatureType.TaxiwayGuidanceLine,
    // High detail - all features
  ],
  zoom_5nm: [
    FeatureType.RunwayElement,
    FeatureType.TaxiwayElement,
    // Medium detail - no small markings
  ],
  zoom_10nm: [
    FeatureType.RunwayElement,
    // Low detail - runways only
  ]
};
```

**Implementation:**
- Filter features during data load based on current zoom level
- Request less data from Navigraph AMDB at high zoom levels
- Reload with higher detail on zoom in (with loading indicator)

**Expected Impact:**
- VRAM reduction: 20-40% at high zoom levels
- Faster initial load
- Better performance in ARC mode (typically zoomed out)

**Risks:**
- Need careful UX for dynamic reloading
- May feel "janky" if not handled smoothly

---

### 4.6 Priority 2: Label Virtualization (Medium Impact)

**Problem:** All labels rendered as DOM elements, even off-screen

**Solution: Canvas-Based Label Rendering**

**Current:** Labels are HTML `<div>` elements (lines 794-827)
**Proposed:** Render labels directly on canvas

**Alternative (if DOM is required):** Virtual scrolling for labels
- Only create DOM elements for visible labels
- Reuse DOM elements as viewport changes
- Similar to React virtual list techniques

**Implementation:**
```typescript
// Canvas text rendering
ctx.font = '14px Arial';
ctx.fillStyle = '#ffff00';
ctx.fillText(label.text, labelX, labelY);

// With rotation support
ctx.save();
ctx.translate(labelX, labelY);
ctx.rotate(rotation * Math.PI / 180);
ctx.fillText(label.text, 0, 0);
ctx.restore();
```

**Expected Impact:**
- Reduced DOM node count (currently 100s of divs)
- Better rendering performance
- Reduced memory overhead

**Risks:**
- Loss of CSS styling flexibility
- Need to handle click events differently (hit testing)
- Text rendering quality may differ slightly

---

### 4.7 Priority 3: Rendering Optimizations (Low-Medium Impact)

**A. Off-Screen Culling**
- Don't render features outside visible viewport
- Implement bounding box checks before drawing

**B. Path2D Cache Management**
- Clear path cache on airport unload (currently unbounded)
- Implement cache size limit (e.g., 1000 paths max)

**C. Reduce Transform Operations**
- Consolidate multiple transform calculations
- Use hardware-accelerated CSS transforms where possible
- Consider OffscreenCanvas for background rendering

**D. Incremental Loading UX**
- Show low-res preview immediately
- Load high-res incrementally with progress indicator
- Prioritize visible viewport features

---

## 5. Implementation Roadmap

### Phase 1: Critical Optimizations (2-3 weeks)

**Goals:** Achieve 50% VRAM reduction, improve load times

**Tasks:**
1. **Canvas Size Reduction**
   - Implement viewport-based canvas sizing
   - Add pan-triggered redraw logic
   - Test across all airports (small, medium, large)

2. **Layer Consolidation**
   - Reduce from 8 to 4 canvas layers
   - Refactor style data and rendering logic
   - Update visibility rules

3. **Path Cache Cleanup**
   - Add cache clearing on airport unload
   - Implement max cache size limit

**Deliverables:**
- Updated `Oanc.tsx` with optimizations
- Performance test results (VRAM usage, FPS impact)
- Documentation of changes

**Success Metrics:**
- VRAM per display: <600 MB (from ~1GB)
- No visual regression in key scenarios

---

### Phase 2: Data Sharing & Resolution Control (2 weeks)

**Goals:** Optimize dual-display usage, add resolution options

**Tasks:**
1. **Shared Data Cache**
   - Implement `OancDataCache` singleton
   - Refactor data loading in both NDs
   - Add cache invalidation logic

2. **Resolution Scaling**
   - Add SimVar for resolution preset
   - Implement dynamic scaling
   - Test across all presets

3. **Feature LOD System**
   - Implement zoom-based feature filtering
   - Optimize Navigraph AMDB requests
   - Add smooth transitions

**Deliverables:**
- Shared cache service
- Resolution preset system
- LOD implementation

**Success Metrics:**
- Dual display VRAM: <1 GB total (from ~2GB)
- Configurable quality/performance trade-off

---

### Phase 3: Advanced Optimizations (3-4 weeks)

**Goals:** Polish, label optimization, future-proofing

**Tasks:**
1. **Label Virtualization**
   - Evaluate canvas vs. virtual DOM approach
   - Implement chosen solution
   - Maintain click interaction functionality

2. **Rendering Refinements**
   - Off-screen culling
   - Transform consolidation
   - OffscreenCanvas experimentation

3. **EFB Integration Prep**
   - Define EFB settings interface
   - Document SimVar contracts
   - Prepare for user-facing controls

**Deliverables:**
- Optimized label system
- Advanced rendering optimizations
- EFB integration specification

**Success Metrics:**
- VRAM per display: <400 MB (stretch goal)
- <5% FPS impact (stretch goal)
- Ready for EFB UI integration

---

## 6. Testing Strategy

### 6.1 Performance Benchmarks

**Test Airports:**
- **Small:** LSZS (Samedan) - ~10 taxiways, 1 runway
- **Medium:** EGLL (London Heathrow) - Complex taxiway network
- **Large:** KLAX (Los Angeles) - Massive footprint, 4 runways
- **Complex:** EDDF (Frankfurt) - Dense features, multiple terminals

**Metrics to Capture:**
- VRAM usage (via GPU monitoring tools)
- Initial load time
- FPS during:
  - Static display
  - Panning
  - Zooming
  - Mode switches (PLAN ↔ ARC ↔ ROSE NAV)

### 6.2 Visual Regression Testing

**Test Scenarios:**
1. All zoom levels (0.2nm, 0.5nm, 1nm, 2nm, 5nm)
2. All ND modes (PLAN, ARC, ROSE NAV)
3. Runway/taxiway labels visibility
4. BTV (Brake to Vacate) functionality
5. User markers (crosses, flags)
6. Dual display synchronization

**Acceptance Criteria:**
- No missing features
- No rendering artifacts
- Consistent label positioning
- Smooth zoom/pan transitions

### 6.3 Hardware Validation

**Test Systems:**
- **High-end:** RTX 4070 Ti+ (primary target)
- **Mid-range:** RTX 3060, RX 6700 XT
- **Low-end:** GTX 1660 Ti, 8GB VRAM systems

---

## 7. Risk Assessment

### 7.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Canvas resize causes visible artifacts | Medium | High | Double buffering, smooth transitions |
| Shared cache introduces race conditions | Low | High | Careful synchronization, thorough testing |
| Canvas-based labels look worse | Medium | Medium | Fall back to DOM if quality degrades |
| Performance gains don't materialize | Low | High | Benchmark early, iterate |
| Breaking changes to BTV functionality | Medium | High | Extensive BTV testing in Phase 1 |

### 7.2 User Experience Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Panning feels laggy due to redraw | Medium | Medium | Optimize redraw speed, consider double buffer |
| LOD transitions are jarring | Medium | Low | Smooth fade-in, clear loading indicators |
| Users prefer current quality | Low | Medium | Make resolution configurable |
| Existing users report regressions | Medium | High | Phased rollout, beta testing channel |

---

## 8. Success Criteria

### 8.1 Must-Have (P1)

- ✅ VRAM usage reduced by ≥50% per display
- ✅ No visual regressions in core functionality
- ✅ All existing features remain functional
- ✅ Performance improvement measurable on RTX 4070 Ti

### 8.2 Should-Have (P2)

- ✅ Dual display VRAM usage <1 GB total
- ✅ Resolution scaling options available
- ✅ Load time <2 seconds for large airports
- ✅ FPS impact <10%

### 8.3 Nice-to-Have (P3)

- ⭐ VRAM per display <400 MB (stretch goal)
- ⭐ FPS impact <5% (stretch goal)
- ⭐ EFB integration ready
- ⭐ Automatic quality adjustment based on GPU

---

## 9. Non-Goals (Out of Scope)

The following are explicitly **not** part of this optimization effort:

❌ Complete OANC feature redesign (keep existing functionality)
❌ Adding new OANC features (terrain, weather overlay, etc.)
❌ EFB UI implementation (Phase 3 prep only)
❌ Changing fundamental OANC architecture (stay with canvas-based rendering)
❌ Supporting OANC on A32NX (A380X only)
❌ Mobile/tablet OANC support

---

## 10. Dependencies

### 10.1 External Dependencies

- **Navigraph AMDB API:** Must remain available and performant
- **MSFS SDK:** Canvas rendering APIs, SimVar system
- **fbw-sdk:** Map projection utilities, ARINC types

### 10.2 Internal Dependencies

- **ND instrument:** Integration point (instrument.tsx)
- **fbw-common:** Shared component (Oanc.tsx lives here)
- **Build system:** Mach, Rollup, TypeScript toolchain

### 10.3 Coordination Requirements

- **Testing team:** Performance validation, visual regression checks
- **User community:** Beta testing, feedback on quality/performance trade-offs
- **A380X feature teams:** BTV, FMS integration (ensure no breakage)

---

## 11. Open Questions

### 11.1 Technical Decisions Needed

1. **Canvas sizing strategy:**
   - Fixed 2048×2048 max? Or dynamic based on zoom level?
   - Redraw on every pan, or only after pan stops?

2. **Layer consolidation approach:**
   - 4 layers or 3? (Does high-detail layer justify memory cost?)
   - Render order within consolidated layers?

3. **Label rendering method:**
   - Canvas-based or virtualized DOM?
   - How to handle click events if canvas-based?

4. **Cache TTL:**
   - How long to keep airport data cached?
   - LRU eviction or time-based?

### 11.2 Product Decisions Needed

1. **Default resolution preset:**
   - Stay at 0.75 (Medium) or move to 0.5 (Low)?
   - How aggressive to be with default optimization?

2. **Feature LOD thresholds:**
   - At what zoom level to simplify features?
   - User preference or automatic?

3. **Performance vs. quality trade-off:**
   - Where to draw the line if optimizations impact quality?
   - User choice or opinionated defaults?

### 11.3 Testing & Validation

1. **Beta testing plan:**
   - Open beta or closed group?
   - Which airports to focus testing on?

2. **Performance metrics:**
   - What constitutes "acceptable" FPS impact?
   - Baseline measurements on reference hardware?

---

## 12. Appendix: Technical Details

### 12.1 Current Canvas Memory Calculation

```
Per Display:
8 layers × (canvas_width × canvas_height × 4 bytes/pixel)

Example: KLAX (large airport, ~5000×5000 area)
Full resolution (1.0 scale):
  8 × (5000 × 5000 × 4) = 800,000,000 bytes = ~800 MB

Current (0.75 scale):
  8 × (3750 × 3750 × 4) = 450,000,000 bytes = ~450 MB

Proposed (4 layers, 2048 max, 0.75 scale):
  4 × (1536 × 1536 × 4) = 37,748,736 bytes = ~38 MB

Additional overhead (path cache, labels, data): ~100-200 MB
Total proposed: ~150-250 MB (83% reduction)
```

### 12.2 Rendering Pipeline Pseudocode

**Current:**
```typescript
onLoad(airport) {
  data = fetchFromNavigraph(airport, ALL_FEATURES);
  sortDataIntoLayers(data); // 8 layers
  generateAllLabels(data);  // All labels upfront

  // Incremental draw
  while (not done) {
    drawFeatures(nextBatch); // 50 features/frame
    await nextFrame();
  }
}

onUpdate() {
  transformAllLayers();     // Every frame
  updateAllLabels();        // Every frame
}
```

**Proposed:**
```typescript
onLoad(airport, zoomLevel) {
  // Check cache first
  if (cache.has(airport)) {
    data = cache.get(airport);
  } else {
    // LOD-aware loading
    features = getRequiredFeatures(zoomLevel);
    data = fetchFromNavigraph(airport, features);
    cache.set(airport, data);
  }

  sortDataIntoLayers(data); // 4 layers
  generateVisibleLabels(viewport); // Only visible

  // Progressive rendering
  renderCriticalFeatures(); // Runways, taxiways first
  requestIdleCallback(() => {
    renderDetailFeatures();
  });
}

onUpdate() {
  // Only transform if changed
  if (viewportChanged) {
    transformVisibleLayers();
    updateVisibleLabels(viewport);
  }
}

onPan(offset) {
  // Only redraw if panned beyond threshold
  if (Math.abs(offset) > REDRAW_THRESHOLD) {
    queueRedraw();
  }
}
```

### 12.3 Navigraph AMDB Request Optimization

**Current request:**
```typescript
const includeLayers = [
  FeatureTypeString.RunwayElement,
  FeatureTypeString.TaxiwayElement,
  FeatureTypeString.TaxiwayGuidanceLine,
  FeatureTypeString.ApronElement,
  FeatureTypeString.ParkingStandArea,
  FeatureTypeString.ParkingStandLocation,
  FeatureTypeString.VerticalPolygonalStructure,
  FeatureTypeString.RunwayMarking,
  FeatureTypeString.TaxiwayHoldingPosition,
  FeatureTypeString.StandGuidanceLine,
  FeatureTypeString.RunwayExitLine,
  // ... many more
];
amdbClient.getAirportData(icao, includeLayers);
```

**Proposed (zoom-aware):**
```typescript
function getRequiredFeatures(zoomLevel: number): FeatureTypeString[] {
  if (zoomLevel <= 1.0) {
    // Close zoom: all features
    return ALL_FEATURE_TYPES;
  } else if (zoomLevel <= 2.5) {
    // Medium zoom: no small markings
    return [
      FeatureTypeString.RunwayElement,
      FeatureTypeString.TaxiwayElement,
      FeatureTypeString.TaxiwayGuidanceLine,
      FeatureTypeString.ApronElement,
      FeatureTypeString.VerticalPolygonalStructure,
    ];
  } else {
    // Far zoom: major features only
    return [
      FeatureTypeString.RunwayElement,
      FeatureTypeString.TaxiwayElement,
      FeatureTypeString.VerticalPolygonalStructure,
    ];
  }
}
```

---

## 13. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-13 | FBW Dev Team | Initial draft |

---

## 14. Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Tech Lead | TBD | | |
| Product Owner | TBD | | |
| A380X Maintainer | TBD | | |

---

**End of Document**
