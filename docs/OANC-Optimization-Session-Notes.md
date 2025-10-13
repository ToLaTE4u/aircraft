# OANC Optimization - Session Notes

**Date:** 2025-10-13
**Branch:** `feature/oanc-performance-optimization-phase1`
**Status:** Phase 1 Complete - Ready for Testing

## What Was Implemented

### Step 1: Canvas Size Reduction
- Added `MAX_CANVAS_DIMENSION = 2048` constant
- Modified canvas sizing in `loadAirportMap()` to cap dimensions
- Expected: 60-70% VRAM reduction for large airports

### Step 2: Layer Consolidation
- Reduced from 8 layers to 4 layers:
  - Layer 0: Base layer (Taxiways, Aprons, Runways, Buildings)
  - Layer 1: Guidance lines (All guidance/marking lines)
  - Layer 2: Runway highlights (white fill)
  - Layer 3: Dynamic overlay (BTV content)
- Updated all layer references throughout codebase
- Expected: 50% VRAM reduction

### Step 3: Path Cache Cleanup
- Added cache clearing on airport unload
- Prevents memory leaks from unbounded cache growth

## Files Modified
- `fbw-common/src/systems/instruments/src/OANC/Oanc.tsx`
- `fbw-common/src/systems/instruments/src/OANC/style-data.ts`

## Expected Impact
- **Per display:** ~1GB → ~300-500MB
- **Dual display:** ~2GB → ~600MB-1GB
- **Total reduction:** 50-70%

## Important Clarifications

### Q: Are Captain and FO displays still independent?
**A: YES** - Both displays remain completely independent:
- Can view different airports
- Can use different zoom levels
- Can pan independently
- Separate BTV selections and markers

### Q: Does aircraft icon remain centered?
**A: YES** - Aircraft position is viewport-fixed (384, 384) and independent of canvas size

## Next Steps (To Do)

### Phase 1 Testing
1. **Build the project:**
   ```bash
   npm install
   npm run build-a380x:instruments
   ```

2. **Test at various airports:**
   - Small: LSZS (Samedan)
   - Medium: EGLL (London Heathrow)
   - Large: KLAX (Los Angeles)
   - Complex: EDDF (Frankfurt)

3. **Verify functionality:**
   - All zoom levels work correctly
   - Layer visibility is correct
   - BTV (Brake to Vacate) functionality works
   - Labels display properly
   - Aircraft remains centered
   - No visual regressions

4. **Monitor VRAM usage** with GPU monitoring tools

### Phase 2 (Future)
- Dual display data sharing (shared cache singleton)
- Resolution scaling options (SimVar-based)
- LOD (Level of Detail) system

### Phase 3 (Future)
- Label virtualization
- Rendering refinements
- EFB integration prep

## Git Information
- **Fork:** https://github.com/ToLaTE4u/aircraft.git
- **Branch:** `feature/oanc-performance-optimization-phase1`
- **Commit:** `feat(a380x): optimize OANC performance - Phase 1 optimizations`

## To Continue on Another PC
1. Clone your fork
2. Checkout the feature branch
3. Review this file and the PRD
4. Continue from Phase 1 Testing or Phase 2 implementation

## Notes
- Canvas size limited to 2048px protects against extreme memory usage
- Layer consolidation maintains all visual features
- Both optimizations are backwards compatible
- No breaking changes to external APIs
