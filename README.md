# SIEGER OHC — Dynamic Simulation & Master Mind Decision Engine

[![React 19](https://img.shields.io/badge/React-19.2-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Modbus TCP](https://img.shields.io/badge/PLC-Modbus_TCP-00599c.svg?style=flat-square)](https://modbus.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg?style=flat-square)](#license)

An industrial-grade digital twin, real-time simulation, and autonomous scheduling decision engine (**Master Mind**) for the **SIEGER Overhead Chain Conveyor (OHC)** cone-to-crate / bobbin handling system in textile manufacturing plants.

The system coordinates autoconer loader stations, dynamic conveyor basket routing, and automatic unloader / palletizer stations to maximize throughput, eliminate unloader starvation, eradicate conveyor deadlocks, and minimize lot changeover latency.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Key Capabilities & Features](#key-capabilities--features)
3. [Master Mind Decision Brain Algorithms](#master-mind-decision-brain-algorithms)
   - [Scoring & Priority Ranking](#scoring--priority-ranking)
   - [Predictive Variety Slot Draining](#predictive-variety-slot-draining)
   - [Basket-by-Basket Arrival Forecasting](#basket-by-basket-arrival-forecasting)
   - [Dynamic Lot Change Handling](#dynamic-lot-change-handling)
   - [Unloader Stacking Look-Ahead & Anti-Starvation](#unloader-stacking-look-ahead--anti-starvation)
4. [PLC Integration & Hardware Communications](#plc-integration--hardware-communications)
   - [Gateway Architecture](#gateway-architecture)
   - [Resilience & Failsafes](#resilience--failsafes)
   - [Register Map Summary](#register-map-summary)
5. [Plant Setup & Configuration](#plant-setup--configuration)
6. [Repository Structure](#repository-structure)
7. [Getting Started & Installation](#getting-started--installation)
   - [Prerequisites](#prerequisites)
   - [Running the Simulation](#running-the-simulation)
   - [Running with Hardware PLC / Modbus Simulator](#running-with-hardware-plc--modbus-simulator)
   - [Building for Production](#building-for-production)
8. [Head-to-Head Performance Benchmark](#head-to-head-performance-benchmark)

---

## System Architecture

```mermaid
flowchart TD
    subgraph UI ["Operator Interface & Visualizer (React 19 + Vite)"]
        PlantSetup["Plant Setup & Validation Config"]
        LiveConveyor["2D Dynamic Conveyor Visualizer"]
        BrainTelemetry["Master Mind Live Decision Panel"]
        PlcDiagnostics["PLC Live Registers & Health Tab"]
    end

    subgraph CoreEngine ["Simulation & Control Layer"]
        SimEngine["Dynamic Conveyor Engine (dynamicEngine.js)"]
        MasterMind["Master Mind Brain (dynamicBrain.js)"]
        Tracking["RFID & Encoder Tracker (tracking.js)"]
    end

    subgraph CommLayer ["Industrial Communication Layer"]
        UsePlc["React PLC Source Hook (usePlcSource.js)"]
        Gateway["Node.js Modbus TCP Gateway (gateway.js)"]
        SimPlc["In-Browser Virtual PLC (simulatedPlc.js)"]
        MockServer["Standalone Modbus Server (plc-simulator.js)"]
        PhysicalPlc["Physical Plant PLC (Siemens / Omron / Schneider)"]
    end

    PlantSetup --> SimEngine
    SimEngine <--> MasterMind
    SimEngine --> LiveConveyor
    Tracking --> SimEngine
    MasterMind --> BrainTelemetry

    LiveConveyor <--> UsePlc
    PlcDiagnostics <--> UsePlc

    UsePlc -.->|In-Memory| SimPlc
    UsePlc <==>|WebSocket (Port 8081)| Gateway
    Gateway <==>|Modbus TCP (Port 502)| PhysicalPlc
    Gateway -.->|Modbus TCP (Port 5020)| MockServer
```

---

## Key Capabilities & Features

- **Full Digital Twin Simulation**: Simulates pitch-accurate basket movement (e.g. 380 baskets @ 800 mm pitch on a 304 m loop), continuous loading/unloading on the fly, accumulator buffering, and palletizer dispatching.
- **Dynamic Variety Slot Allocation**: Intelligently relaxes the rigid 4-variant limit up to available pallet stations (11 stations), boosting effective plant throughput from 204 to 338 cones/hr.
- **Real-Time RFID Basket Tracking**: Calculates exact basket positions from the R0 reference reader using encoder pulses and track geometry with continuous home-check validation.
- **Bi-Directional PLC Control**: Dispatches real-time commands (`PERMIT_LOAD`, `LOAD_PACE`, `DEST_STATION`, `DRAIN_SLOT`) to physical PLC controllers via Modbus TCP.
- **Dual Operating Modes**:
  1. **Dynamic Plant (Production)**: Fully configurable plant parameters, multi-variant routing, real-time analytics, and PLC diagnostic tooling.
  2. **Classic Demo**: The original 280-basket proof-of-concept visualizer with comparative FIFO vs. Master Mind benchmarks.

---

## Master Mind Decision Brain Algorithms

The core scheduling engine (`dynamicBrain.js` & `masterMindEngine.js`) coordinates all loading and unloading events using deterministic, multi-variable heuristic scoring.

### Scoring & Priority Ranking

When a loader reaches its trigger threshold, it is evaluated across weighted metrics:

$$\text{Score} = w_{\text{active}} \cdot S_{\text{active}} + w_{\text{buffer}} \cdot S_{\text{buffer}} + w_{\text{wait}} \cdot S_{\text{wait}} + w_{\text{urgent}} \cdot S_{\text{urgent}} + w_{\text{lot}} \cdot S_{\text{lot}} + S_{\text{starve}}$$

| Factor | Description | Scoring Logic |
|---|---|---|
| **Variety on Loop** | Continuity bonus to prevent needless lot switches | $+150$ if variant already has an active loop slot |
| **Buffer Pressure** | Urgency based on loader buffer fullness | $100 \times (\text{cones} / \text{capacity})$ with quadratic ramp $>80\%$ |
| **Stop Prevention** | Extra weight if autoconer is halted or near overflow | $+300$ if buffer is full and spinning frame is stopped |
| **Wait Duration** | Prevents starvation of low-frequency varieties | $+5$ points per minute waiting in trigger state |
| **High Demand** | Manual or ERP expedite flag (★) | $+200$ fixed priority boost |
| **Lot Changeover** | Clearing trailing yarn cones before variety switch | Scaled dynamically from $0.5\times$ to $2.0\times$ based on remaining count |
| **Anti-Starvation** | Forced dispatch for long-neglected loaders | Triggers when wait exceeds threshold; capped below urgent/lot-change scores |

### Predictive Variety Slot Draining

Rather than waiting for an autoconer's buffer to overflow before freeing a variety slot:
1. Master Mind calculates the **Estimated Time to Full (ETTF)** for waiting machines.
2. It forecasts the **Drain Time** for currently active varieties (travel time to unloader + clearance of in-flight baskets).
3. If an active variety has finished its required quota or has a lower priority, Master Mind issues a `DRAIN` order ahead of time so the slot becomes free right as the waiting machine reaches capacity.
4. **Failsafe Timeout**: If a draining variety fails to clear within $3\times$ its predicted drain duration, the failsafe aborts the drain and forces slot sharing to eliminate deadlock.

### Basket-by-Basket Arrival Forecasting

Before dispatching a loading sequence, Master Mind simulates the exact arrival timestamp of every in-flight cone at downstream unloaders:
- Verifies that the destination unloader accumulator will not be full upon arrival.
- Computes unloader clearance cycles (e.g. 18 s cycle = 4 empty pitches required between unloading actions).
- Adjusts loader pacing (`LOAD_PACE = N`, meaning load 1 cone every $N$ passing baskets) so the conveyor never feeds cones faster than the assigned unloader can extract them.
- Prevents baskets from circulating unloaded ("returned after unloader").

### Dynamic Lot Change Handling

- **Old-Lot Prioritization**: When a variety undergoes a lot change, old-lot cones inside the loader's buffer are loaded ahead of new-lot cones.
- **Dedicated Unloading**: Unloaders lock their destination pallet station to old-lot baskets until the remaining count hits zero, ensuring yarn batches are never commingled on pallets.
- **Buffer Pressure Escalation**: When remaining old-lot cones occupy $>60\%$ of buffer capacity, the lot-change weight dynamically doubles ($2.0\times$), preempting standard batches.

### Unloader Stacking Look-Ahead & Anti-Starvation

- **Stacking Detection**: The engine inspects unloaders currently in the stacking state; if an unloader will finish stacking within 2 basket pitches, it is treated as available, avoiding false recirculation decisions.
- **Priority Clamping**: Non-lot-change anti-starvation bonuses are capped strictly below active lot-change scores, guaranteeing that routine starvation recovery cannot disrupt urgent lot clearances.

---

## PLC Integration & Hardware Communications

### Gateway Architecture

```
[Master Mind Web UI]  <-- WebSocket JSON (ws://localhost:8081) -->  [plc-gateway/gateway.js]
                                                                            |
                                                                   Modbus TCP (Port 502)
                                                                            |
                                                                   [Physical or Sim PLC]
```

### Resilience & Failsafes

1. **Exponential Backoff Reconnection**:
   - Connection retries and read failure retries start at 2,000 ms, doubling exponentially on successive failures up to a 30,000 ms ceiling.
   - Resets immediately to 2,000 ms upon successful handshake.
2. **Graceful Data Source Transition**:
   - Switching between Virtual Simulation and Live PLC invokes an asynchronous `stop()` promise that cleanly terminates WebSocket sockets and intervals before initializing the new data stream.
3. **32-Bit Pulse Rollover Protection**:
   - The analysis telemetry (`analyze.js`) distinguishes between legitimate 32-bit hardware pulse counter rollovers ($0 \rightarrow 4,294,967,295$) and abnormal backward jumps, eliminating false home-check alarms.
4. **SimPLC Drift Compensation**:
   - The client-side virtual PLC snaps sub-millisecond fractional time remainders to zero at pitch intervals, preventing cumulative floating-point drift over long-duration simulations.

### Register Map Summary

| Block | Address Range | Description | Direction |
|---|---|---|---|
| **System Status** | `40001 – 40010` | Heartbeat, Mode, Run/Stop, Chain Speed, Total Pulses | PLC $\rightarrow$ UI |
| **Loader Status** | `40101 – 40260` | Per-loader cone count, state, variety, current basket RFID | PLC $\rightarrow$ UI |
| **Unloader Status**| `40301 – 40380` | Per-unloader state, active pallet station, accumulator count| PLC $\rightarrow$ UI |
| **Pallet Stations**| `40401 – 40510` | Pallet completion %, lot ID, variety assigned | PLC $\rightarrow$ UI |
| **Master Mind Cmds**| `40601 – 40700`| `PERMIT_LOAD`, `LOAD_PACE`, `DEST_STATION`, `ALARM_RESET` | UI $\rightarrow$ PLC |

---

## Plant Setup & Configuration

The application implements customer configuration specifications (`Requirements.xlsx`) through the **Plant Setup** panel (`SetupPage.jsx`, `config.js`):

| Parameter | Default Value | Notes |
|---|---|---|
| **Conveyor Pitch** | `800 mm` | Center-to-center distance between carrier baskets |
| **Basket Count** | `380` | Total carriers suspended on the closed loop |
| **Chain Speed** | `10.0 m/min` | Equivalent to 4.80 s slot pass time at 800 mm pitch |
| **Loop Length** | `304.0 m` | Auto-calculated ($380 \times 0.8\text{ m}$) or custom override |
| **Loaders / Unloaders** | `16 / 4` | Configurable spacing and variety assignments |
| **Pallet Stations** | `11` | 4 or 5 cones per accumulator row; 100 cones per pallet |
| **Load / Unload Times**| `20 s / 18 s` | Rounded to discrete basket pitches (24 s load, 19.2 s unload) |
| **Variant Limit Mode** | `Automatic` | Relaxes rigid 4-variant cap to maximum pallet capacity |

---

## Repository Structure

```
sieger-production/
├── README.md                                  # Root documentation (this file)
└── sieger-production-main/                    # Main application root
    ├── MASTER_MIND.md                         # Detailed control algorithm specification
    ├── package.json                           # React 19, Vite, Lucide dependencies
    ├── vite.config.js                         # Vite build & server configuration
    │
    ├── plc-gateway/                           # Hardware Modbus Gateway
    │   ├── package.json                       # modbus-serial, ws dependencies
    │   ├── gateway.js                         # Modbus TCP to WebSocket translation bridge
    │   └── plc-simulator.js                   # Standalone Modbus TCP mock server (port 5020)
    │
    └── src/
        ├── main.jsx                           # Application entry point
        ├── App.jsx                            # Root router (Setup / Dynamic / Classic / PLC)
        ├── ClassicApp.jsx                     # 280-basket legacy demonstration visualizer
        ├── index.css                          # Global design system & theme variables
        │
        ├── dynamic/                           # Dynamic Plant Digital Twin
        │   ├── SetupPage.jsx                  # Configuration editor & calculation validator
        │   ├── DynamicSim.jsx                 # Dynamic loop visualizer & execution loop
        │   ├── DynamicPlant.jsx               # Plant floor layout & station monitoring
        │   ├── DynamicBrainPanel.jsx          # Live decision logs, scoring & slot breakdown
        │   ├── dynamicBrain.js                # Core Master Mind heuristic scoring engine
        │   ├── dynamicEngine.js               # Physics, basket propagation & accumulator engine
        │   ├── config.js                      # Parameter defaults, validation & derived calculations
        │   ├── tracking.js                    # RFID & encoder position calculations
        │   └── dynamic.css                    # Visual styling for dynamic components
        │
        ├── simulation/                        # Legacy / Classic Simulation Engine
        │   ├── masterMindBrain.js             # Classic decision brain implementation
        │   ├── masterMindEngine.js            # Classic loop propagation engine
        │   ├── simulationEngine.js            # FIFO baseline comparison engine
        │   ├── storySequence.js               # Demonstration scenario sequences
        │   └── trackGeometry.js               # SVG track calculation utilities
        │
        └── plc/                               # Industrial Telemetry & Diagnostics
            ├── registerMap.js                 # Dynamic Modbus register builder & CSV export
            ├── simulatedPlc.js                # In-browser virtual PLC state machine
            ├── usePlcSource.js                # React hook for unified data source switching
            └── analyze.js                     # Telemetry sanity checker & error detection
```

---

## Getting Started & Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- [npm](https://www.npmjs.com/) (v9.0.0 or higher)

### Running the Simulation

1. Navigate to the application root directory:
   ```bash
   cd sieger-production-main
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:5173`.
   - The **Plant Setup** page will load. Review the customer parameters or modify any values.
   - Click **Build plant & start** to launch the live simulation.

---

### Running with Hardware PLC / Modbus Simulator

To connect the application to an active PLC or the standalone test harness:

#### 1. Setup the Gateway
```bash
# In sieger-production-main/
npm run plc:install
```

#### 2. Start the Gateway Bridge
```bash
# Starts WebSocket server on port 8081 connecting to Modbus target
npm run plc:gateway
```

#### 3. (Optional) Run the Standalone Mock PLC
If testing without physical hardware, run the bundled Modbus TCP server:
```bash
npm run plc:simulator
```
*Listens on `127.0.0.1:5020` and generates realistic sensor fluctuations.*

#### 4. Connect from the Web Interface
1. In the browser application, navigate to the **PLC Data** tab.
2. Select **Actual PLC (Modbus TCP)**.
3. Enter the Host IP (`127.0.0.1` for simulator or plant PLC IP), Port (`5020` for simulator, `502` for standard PLC), and Unit ID (`1`).
4. Click **Connect**. Live telemetry will populate the registers and diagnostics views.

---

### Building for Production

Compile an optimized production bundle:

```bash
npm run build
```

Run Oxlint for code quality validation:

```bash
npm run lint
```

---

## Head-to-Head Performance Benchmark

4-hour continuous production benchmark simulating the standard customer setup (16 loaders, 4 unloaders, 11 pallet stations, 10 varieties):

| Configuration | Hourly Throughput | Autoconer Stoppage Rate | Old-Lot Clear Time |
|---|---|---|---|
| **Standard FIFO (4 Fixed Varieties)** | $204 \text{ cones/hr}$ | $22.4\%$ | $58 \text{ min}$ |
| **Master Mind (4 Fixed Varieties)** | $264 \text{ cones/hr}$ | $10.1\%$ | $34 \text{ min}$ |
| **Master Mind (Dynamic Variety Mode)** | $\mathbf{338} \text{ cones/hr}$ | $\mathbf{0.0\%}$ | $\mathbf{16 - 24} \text{ min}$ |

> **Key Takeaway**: Master Mind's dynamic variety slot allocation and predictive draining elevate conveyor utilization by **$+65.7\%$** over conventional FIFO logic while completely eliminating production halts due to full loader buffers.

---

## License

Proprietary — All rights reserved © SIEGER Spintech Equipments Pvt. Ltd.
