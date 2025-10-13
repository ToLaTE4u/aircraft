# Project Knowledge Base

*This document captures key information about the repository structure, architecture, and development workflow.*

---

## Project Overview

### What is This?
**FlyByWire Simulations Aircraft** - A community-driven open source project creating high-fidelity Airbus aircraft for Microsoft Flight Simulator 2020.

### Aircraft Included
1. **A32NX** - Airbus A320-251N with CFM LEAP engines
2. **A380X** - Airbus A380-842 with Rolls-Royce Trent 972B-84 engines
3. **In-Game Panels Checklist Fix** - Utility addon

### License
- Source code: GNU GPLv3
- 3D assets: CC BY-NC 4.0
- Completely free and open source

### Links
- Website: https://flybywiresim.com
- Documentation: https://docs.flybywiresim.com
- Discord: https://discord.gg/flybywire
- Issue Tracker: https://github.com/flybywiresim/aircraft/issues/

---

## Project Structure

### Repository Type
**Monorepo** containing multiple aircraft projects with shared libraries

### Main Directories

#### Aircraft Projects
- **fbw-a32nx/** - A320neo implementation
  - `src/base/` - MSFS package base files
  - `src/systems/` - JavaScript/TypeScript systems (ATSU, FMGC, instruments, etc.)
  - `src/wasm/` - C++ and Rust WASM modules (FADEC, FBW, systems)
  - `out/` - Build output directory
  - `bundles/` - Instrument bundles (PFD, ND, EWD, MCDU, etc.)

- **fbw-a380x/** - A380 implementation
  - Similar structure to A32NX
  - `src/systems/instruments/` - Cockpit displays (PFD, ND, MFD, EWD, SD, OIT, etc.)
  - `src/wasm/` - WASM systems specific to A380

- **fbw-common/** - Shared code across all aircraft
  - `src/systems/` - Common systems implementations
  - `src/wasm/` - Common WASM modules (terronnd, cpp-msfs-framework, fadec_common, fbw_common)
  - `src/systems/instruments/src/EFB/` - Shared Electronic Flight Bag

#### Supporting Directories
- **large-files/** - Large assets (models, textures) managed separately
- **scripts/** - Build and processing scripts
- **tools/** - Development utilities
  - `fdr2csv/` - Flight data recorder converter
  - `heapdump/` - Memory analysis tool
- **docs/** - Repository documentation
- **.github/** - CI/CD workflows, issue templates, changelog

### Technology Stack

#### Languages
- **TypeScript/JavaScript** - Instruments, avionics displays, systems logic
- **Rust** - Aircraft systems simulation (workspace in Cargo.toml)
- **C++** - WASM modules for FBW, FADEC, terrain radar

#### Build Tools
- **npm/pnpm** - Package management
- **Rollup** - JavaScript bundling
- **esbuild** - Fast JavaScript bundling
- **Mach** - Custom build tool (@synaptic-simulations/mach)
- **Cargo** - Rust build system
- **CMake** - C++ build system
- **wasm-opt** - WASM optimization

#### Frameworks & Libraries
- **React 17** - UI components (EFB, instruments)
- **@microsoft/msfs-sdk** - MSFS integration
- **Redux** - State management
- **Vite** - Development server
- **Vitest** - Testing framework
- **ESLint/Prettier** - Code quality

---

## Architecture

### Multi-Language Architecture
The project uses a hybrid architecture combining:
1. **JavaScript/TypeScript** - High-level logic, UI, cockpit instruments
2. **Rust** - Performance-critical systems simulation (hydraulics, electrical, pneumatics)
3. **C++** - Low-level MSFS integration via WASM

### Instrument Systems
Each aircraft has multiple cockpit instruments built as separate bundles:
- **PFD** - Primary Flight Display
- **ND** - Navigation Display
- **EWD** - Engine Warning Display
- **SD** - System Display
- **MCDU** (A32NX) / **MFD** (A380X) - Multi-function displays
- **EFB** - Electronic Flight Bag
- **FCU** - Flight Control Unit
- **RMP** - Radio Management Panel

### WASM Modules
Performance-critical systems run as WASM modules:
- `systems.wasm` - Aircraft systems (Rust)
- `fbw.wasm` - Fly-by-wire system (C++)
- `fadec.wasm` - Engine control (C++)
- `terronnd.wasm` - Terrain radar (C++)

---

## Key Components

### A32NX Specific
- **FMGC** - Flight Management and Guidance Computer
- **ATSU** - Air Traffic Services Unit with datalink
- **TCAS** - Traffic Collision Avoidance System
- **DCDU** - Datalink Control Display Unit
- **ISIS** - Integrated Standby Instrument System

### A380X Specific
- **OIT** - Onboard Information Terminal
- **MFD** - Multi-Function Display
- More complex systems architecture (4 engines vs 2)

### Shared Components (fbw-common)
- **EFB** - Electronic Flight Bag (tablet interface)
- **Datalink** - Communication systems
- **Navigation data** - MSFS Navdata client
- **Terrain radar** - Ground proximity system
- **Common instruments** - Clock, BAT

### External Integration
- **SimBridge** - External communication bridge
- **Sentry** - Error monitoring and reporting
- **Navigraph** - Navigation data provider
- **Localazy** - Localization/translation service

---

## Build System & Development

### Package.json Scripts
The project uses descriptive npm script names organized by aircraft:

#### A32NX Build Commands
- `build-a32nx:instruments` - Build cockpit instruments
- `build-a32nx:systems` - Compile Rust systems to WASM
- `build-a32nx:fbw` - Compile fly-by-wire C++ module
- `build-a32nx:fadec` - Compile engine control module
- `build-a32nx:fmgc` - Build flight management computer
- `build-a32nx:copy-base-files` - Copy base package files
- `build-a32nx:manifest` - Generate package manifest

#### A380X Build Commands
- `build-a380x:instruments` - Build cockpit instruments
- `build-a380x:systems` - Compile Rust systems
- `build-a380x:fbw` - Compile fly-by-wire module
- `build-a380x:fadec` - Compile engine control
- `build-a380x:copy-base-files` - Copy base package files
- `build-a380x:copy-large-files` - Handle large assets (textures)
- `build-a380x:manifest` - Generate package manifest

#### Generic Commands
- `build:cpp-wasm-cmake` - Build C++ WASM modules with CMake
- `lint` / `lint-fix` - ESLint checks
- `test` - Run Vitest tests
- `prettier` - Format JSON/YAML/CSS files

### Build Output
- Built packages go to `fbw-a32nx/out/` or `fbw-a380x/out/`
- WASM files are optimized with `wasm-opt`
- Final packages are MSFS-compatible aircraft addons

### Development Environment
- Uses **pnpm** for package management (pnpm-lock.yaml present)
- Rust toolchain defined in `rust-toolchain.toml`
- CMake for C++ compilation
- Docker support for consistent builds (scripts reference `/external/`)

---

## Important Patterns & Conventions

### TypeScript Strict Mode
- Project is transitioning TO strict mode
- Files not yet compliant have `// @ts-strict-ignore` at top
- **New code MUST be strict mode compliant** (no ts-strict-ignore)
- Uses `typescript-strict-plugin` during transition
- CI checks strict mode compliance

### Branching Strategy
- `master` - Main development branch (source of truth)
- Release branches (e.g., `v0.12`)
- Feature branches on developer forks (not main repo)
- GitHub allows maintainer push to PR branches in forks

### Code Quality
- ESLint with TypeScript support
- Prettier for formatting
- Pre-commit hooks via lint-staged
- Vitest for unit testing

### Versioning
Two version tracks:
- **Stable** - Tested snapshot releases
- **Development** - Daily updates (may have minor issues)

---

## Notes & Tips

### Large Files Management
- Large assets stored in separate `large-files/` directory
- Chunking/unchunking scripts available: `npm run chunkLargeFiles` / `unchunkLargeFiles`
- A380X has 4K and 8K texture variants

### MSFS Integration
- Aircraft packages follow MSFS structure: `SimObjects/AirPlanes/`
- Panel instruments in `panel/` subdirectory
- Configuration via manifest.json files

### External Documentation
- Full user docs at https://docs.flybywiresim.com
- Known issues tracked in docs and GitHub issues
- Changelog at `.github/CHANGELOG.md`

### Recent Work (Git Status)
- `.gitmodules` modified
- `aircraft-large-files` added (submodule?)
- `fbw-common/src/systems/instruments/src/OANC/Oanc.tsx` modified
- Recent commits focus on FADEC, PFD, and FDR tools

### Instruments Framework
- Uses custom "Mach" build system (`@synaptic-simulations/mach`)
- Configuration in `mach.config.js` files
- MSFS SDK integration via `@microsoft/msfs-sdk`

### Community
- Very active Discord community
- Open contribution model (see Contributing.md)
- Free and open source - no payware

---

## OANC/OANS Performance Analysis

**Date Analyzed:** 2025-10-13

### What is OANC?
**OANC (Onboard Airport Navigation Chart)** - A moving map display showing airport layouts for ground navigation during taxi operations. Used on the A380X Navigation Displays.

### Current Performance Issues
- **VRAM Usage:** ~1GB per ND display (~2GB when both Captain + FO displays active)
- **Performance Impact:** Noticeable FPS drops during loading and continuous display
- **Scope:** Affects both small and large airports (worse on large/complex airports)

### Technical Root Causes
1. **Oversized Canvases:** 8 separate canvas layers sized to entire airport geometry (can be 5000×5000+ pixels)
2. **No Data Sharing:** Each ND display loads identical data independently
3. **Inefficient Rendering:** All features drawn regardless of visibility, continuous transforms
4. **Label Overhead:** All labels rendered as DOM elements, even off-screen

### Key Files
- Main implementation: `fbw-common/src/systems/instruments/src/OANC/Oanc.tsx`
- A380X integration: `fbw-a380x/src/systems/instruments/src/ND/instrument.tsx`
- Style data: `fbw-common/src/systems/instruments/src/OANC/style-data.ts`

### Optimization Strategy (see PRD)
**Location:** [docs/PRD-OANC-Performance-Optimization.md](docs/PRD-OANC-Performance-Optimization.md)

**Priority 1 Optimizations:**
1. Canvas size reduction (viewport-based instead of airport-based)
2. Layer consolidation (8 layers → 4 layers)
3. Dual display data sharing (shared cache singleton)

**Expected Impact:**
- Target: 50-70% VRAM reduction
- Dual display: ~2GB → ~1GB total
- Maintain visual quality and all features

**Implementation Phases:**
- Phase 1: Critical optimizations (canvas/layers) - 2-3 weeks
- Phase 2: Data sharing + resolution control - 2 weeks
- Phase 3: Advanced optimizations + EFB prep - 3-4 weeks
