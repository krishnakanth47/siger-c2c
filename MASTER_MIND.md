# SIEGER Master Mind — dynamic loading simulation

## NEW: configurable dynamic simulation (opens first)

`npm run dev` now opens a **plant setup page**. Every value from `Requirements.xlsx` is an input, with the customer figures as defaults. Press **Build plant & start** and the plant, the conveyor and the Master Mind are built from those values. The last setup is remembered in the browser. **Edit setup** goes back; **Classic demo** opens the earlier fixed 280-basket demo.

| Input | Default (Requirements.xlsx) |
|---|---|
| Package / hour (design) | 380 |
| Varieties | 10 |
| Cones per hour per variety | 35 |
| Loading / unloading time per package | 20 s / 18 s |
| Baskets / pitch / speed | 380 / 800 mm / 10 m/min |
| Loop length | 0 = automatic: pitch × baskets = 304 m |
| Distance to unloader | 0 = automatic: centre of the ring = 152 m |
| Loaders / unloaders / pallet stations | 16 / 4 / 11 |
| Cones per accumulator | 4 or 5 (matrix) |
| Loading count | Automatic (the software decides the trigger) or Manual |
| Loader → variety | entry for every loader |
| Max loaders loading at once (4Q) / max varieties on loop | 4 / 4 (both editable) |
| Loading / unloading mode | On the move (default) or chain stops |
| **Assumed, not in the sheet** | loader buffer 20 cones, loader spacing 6.4 m, unloader spacing 8 m, 100 cones per pallet |

**What the setup page calculates:** loop length, the time between baskets passing a station (4.8 s), one full loop (30 min 24 s), travel time to the unloaders, loader and unloader capacity, and the number of variety slots needed. It flags warnings and errors before you start.

**How the plant works:**
- The OHC chain is full: one basket per pitch, all moving together in sequence.
- In the default "on the move" mode, a loader drops a cone into a passing empty basket and needs 20 s before its next cone. An unloader takes a cone from a passing loaded basket and needs 18 s before its next one.
- Loaded baskets that pass every unloader without being unloaded go round again. These are shown as "returned after unloader".
- An unloader puts cones into a pallet station's accumulator. Each full accumulator row (4 or 5 cones) is placed on the pallet, and the pallet is dispatched at the cones-per-pallet value.
- **Lot change** (↻ button per variety) starts a new lot number. The old lot's remaining cones are shown live, get high priority, and keep their own pallet until they are cleared.
- **High demand** (★ button per variety) gives that variety priority.

**What the brain decides (`src/dynamic/dynamicBrain.js`):**
1. **Triggering count (automatic mode).**
   - For a new variety while slots are scarce: 50% of the buffer.
   - Otherwise: one pallet row.
   - For a variety already on the loop: one row. If other varieties are waiting for a slot, it only rejoins when nearly full, so the slot can rotate.
2. **Which loader starts.** A scoring breakdown ranks every loader that is ready: variety on the loop, buffer risk, stopped, wait, high demand, old lot, pallet waiting, and anti-starvation.
3. **Variety slots.**
   - A variety slot can be drained **predictively**: it starts early enough that a waiting loader gets a slot before its buffer fills.
   - The freed slot is then reserved for that loader.
4. **Pallet station per lot, dynamically.**
   - Each loading stream is routed to a station on an unloader that has no other stream, so baskets are not passed unloaded.
   - Held pallets are changed over only when needed.
5. **Command.** The brain writes a permit and a routing command to the PLC, with a plain-language reason in the panel and the event log.

**PLC data source (setup tab 2):**
- **Actual PLC data:** Modbus TCP through `plc-gateway/gateway.js`, which runs on the Master Mind PC.
  - Run `npm run plc:install` once, then `npm run plc:gateway`.
  - Enter the PLC IP, port, unit ID and poll time, then press Connect.
- **Simulation:** a simulated PLC in the page gives random but consistent values from the plant setup, in the same registers.
- **Live tables** for loaders, unloaders, pallet stations and baskets (with position from R0), plus raw registers.
- **Checks against the setup:** loader variety, buffer, speed, basket IDs, heartbeat, home check and faults.
- **Information outputs** from the PLC data: packages in OHC by category, returned packages, lot change remaining.
- **Register map** is built from the setup, with editable block addresses and a CSV for the PLC programmer.
- **Test the real Modbus path without a PLC:** `npm run plc:simulator` starts a Modbus TCP server on port 5020. See `plc-gateway/README.md`.

**Varieties on the loop: automatic (default) or fixed:**
- The customer spec says "4 variants at a time". Nothing physical requires 4.
- What really limits varieties is that **each variety/lot needs its own pallet station** (11), and **its cones must be unloadable in time**.
- In **Automatic** mode the brain allows as many varieties as there are pallet stations free for them. The unloader arrival forecast decides whether a new stream can be unloaded without returns.
- **FIFO keeps the spec limit** ("Fixed variant limit"), so the head-to-head still compares with the customer's rule.
- **Results (customer setup, 4 simulated hours):**

  | | Cones/h | Stop time |
  |---|---|---|
  | FIFO, 4 fixed | 204 | 22% |
  | Brain, 4 fixed | 264 | 10% |
  | **Brain, automatic** | **338** | **0%** |

  In automatic mode the brain keeps 9–10 varieties on the loop on average. Old lots clear in 16–42 min.

**Origin and basket positions (RFID):**
- **R0** is an RFID reader at a fixed point: the origin (0 m) and also the loop end (304 m). The default is 0.8 m before L01, set under "Origin R0 → L01".
- **Basket IDs** follow the order R0 reads the tags (B001, B002 …). This is the order list recorded on one loop at commissioning.
- **Position of a basket** = (places ahead of the basket last read at R0 + pitch pulses since + encoder fraction) × pitch.
- **Distance to a station** = (station position − basket position) mod loop length. Time = distance ÷ speed.
- **Home check:** B001 must return to R0 after exactly one loop of pulses. If not, a pulse was missed and the log shows an error.
- **Readers** at every loader and unloader record the basket in front of them.
- **Station positions:** "Station positions = From the layout" lets you type each loader and unloader position in metres from R0. The setup page lists every position from R0.
- **In the simulation**, click any basket to see its position from R0, zone, next station, and distance and time to its unloader, to every unloader and to R0. It also shows the calculation, checked against the real chain position.

**Timing-based decisions (calculated from the setup data):**

| Figure | Formula | Customer values |
|---|---|---|
| Loop length | baskets × pitch | 380 × 0.8 = 304 m |
| Basket passes a station every | pitch ÷ speed | 0.8 m ÷ 0.167 m/s = 4.8 s |
| Loader cycle on the moving chain | loading time rounded **up** to whole baskets | 20 s → every 5th basket = 24 s (150/h) |
| Unloader cycle | unloading time rounded up to whole baskets | 18 s → every 4th basket = 19.2 s (187/h) |
| Streams one unloader can take | loader cycle ÷ unloader cycle | 24 ÷ 19.2 = 1.25 |
| Loader → unloader travel | distance along the chain ÷ speed | 5 min 36 s (L16→U01) to 17 min 36 s (L01→U04) |

- **Arrival forecast.** Before permitting a loader, the brain forecasts basket by basket when each cone already on the loop, and each cone still to be loaded, reaches each unloader. It also forecasts whether that unloader will be free, because it needs 4 pitches between cones.
- **Unloader choice.** Each pallet-station option is tried. The brain picks the one where the batch is cleared soonest. Each cone forecast to pass unloaded counts as one extra loop (30 min 24 s).
- **Loading pace.** A loader is never sent cones faster than one unloader can take them. If unloading is slower than loading, for example 30 s, the brain commands `LOAD_PACE` = every Nth basket. Extra slowing beyond that is a setting ("Extra loader slowing"), off by default, because tests showed it holds variety slots too long.
- **Trigger count.** When variety slots are full, the brain estimates when the next one frees up. It then asks for loading early enough that cones arriving during that wait still fit in the buffer.
- **Drain.** The time for a variety to clear the loop uses the real loader cycle (24 s) plus the travel to the last unloader.
- **PLC commands per permit:** `PERMIT_LOAD[Lxx]`, `LOAD_PACE[Lxx]`, `STATION[Lxx]`.
- **Results (4 simulated hours, customer setup):** FIFO 204 cones/h (22% stop); previous brain 224/h (21%); timing brain 261/h (13%). With 30 s unloading: FIFO 78/h, previous brain 116/h, timing brain 190/h.

**New files:** `src/dynamic/` (`config.js`, `dynamicEngine.js`, `dynamicBrain.js`, `SetupPage.jsx`, `DynamicSim.jsx`, `DynamicPlant.jsx`, `DynamicBrainPanel.jsx`, `dynamic.css`), and `src/ClassicApp.jsx`, which holds the earlier demo. `src/App.jsx` now switches between the setup page, the simulation and the classic demo.

---

# Classic demo (fixed 280-basket plant)

This adds a central decision engine, the **Master Mind**, to the SIEGER OHC digital twin. It runs next to the customer's FIFO specification, so the two strategies can be compared on the same plant.

## Run it

```
npm install      (only the first time)
npm run dev
```

Open the address Vite prints, press **START**, and use **4x** speed.

- The **brain** sits in the middle of the OHC loop. Click it to open the decision panel.
- The switch above the brain toggles between **FIFO (SPEC)** and **MASTER MIND**.

## Plant (customer numbers)

| Item | Qty |
|---|---|
| Autoconers and loaders | 16 and 16 (one loader per machine) |
| Dynamic unloaders | 4 |
| Pallet stations | 8 (2 under each unloader) |
| Variants (materials) | 8 (2 autoconers per material) |
| Cone baskets on the OHC conveyor | 280 |
| Max loads in progress (4Q) | 4 |
| Max variants in the system | 4 |

## Conveyor model: one chain, always in sequence

- **The loop.** All **280 baskets** hang on one closed OHC loop, spaced evenly, and move together at about 3 baskets per second (one revolution takes about 93 s). No basket can pass another; the order B001…B280 never changes. All 280 are drawn on the plant floor. Colour shows each basket's state:
  - dark: empty
  - amber outline: empty and reserved for a loader
  - filled with the variant colour: loaded
  - purple outline: unloading
  - red outline: loaded but recirculating
- **Loading.** When a machine gets a load permit, its loader fills its magazine from the autoconer (about 25 s). The loader then drops the 32 cones into the empty basket reserved for it, as that basket passes. The basket chosen is the first free empty one that reaches the loader after the magazine is full.
- **Unloading.** From the approach point, just before U01, each loaded basket gets a dynamic unloader: a free bay still ahead of it. The preferred bay is one whose pallet already collects that variant. The next choice is a bay with an empty pallet. Failing both, the bay with the least-full pallet is used, and that pallet is changed over. The cones come out while the basket passes through that bay. The unloader then needs 4 s to stack them on the pallet.
- **Recirculation.** If no unloader is free, the loaded basket goes round the loop again and tries on the next pass. The Performance tab counts these recirculations.
- **Variant slots.** A variant holds one of the 4 slots while a magazine of it is filling or any basket of it is loaded on the loop.
- **Machines.** When an autoconer reaches its doff count, it keeps winding into its cone buffer (40–110 s, different per machine). When the buffer is full, the machine **stops**.
- **Time.** 1 tick = 1 simulated second. The speed buttons only change how fast the ticks run.

## What the decision panel shows

| Tab | What you see |
|---|---|
| Live thinking | The current decision cycle, in 5 steps: Sense → Slot manager → Score → Allocate basket → Command PLC. It shows the 4 variant slots (and why a slot is being drained), a scoring table for every waiting machine with a point breakdown and verdict, the basket reserved for each loader and why, and the dynamic unloader decisions. |
| Decision log | Every admission, drain and reservation, with the full snapshot frozen at that moment. |
| Rules & weights | The hard rules, sliders for every scoring weight (they apply live), urgent-order toggles, and **Simulate brain PC failure** (the PLC falls back to FIFO). |
| Performance | A 1-hour head-to-head of FIFO against Master Mind from the same starting plant, plus live KPIs. |

## How the brain decides (`src/simulation/masterMindBrain.js`)

1. **Sense.** Reads the waiting machines, 4Q usage, variant slots, and the empty and loaded baskets.
2. **Slot manager.** If a machine is blocked because all 4 variant slots are busy, and its buffer is getting full, the brain **drains** the slot that frees up soonest. That slot takes no new loads until it clears. The freed slot is then **reserved** for the blocked machine.
3. **Score.** Every waiting machine gets points for:
   - its variant already being open (+40), or a penalty for needing a new slot (−10)
   - cone-buffer risk (up to +50)
   - already stopped (+30)
   - fairness for waiting time (up to +30)
   - urgent order (+25)
   - waiting longer than the anti-starvation limit (forced priority)
4. **Select and allocate.** Goes down the ranking and admits every machine the rules allow. Each admitted machine gets the right empty basket on the chain.
5. **Command.** Writes `PERMIT_LOAD[Lxx]` and `BASKET_ID[Lxx]` to the PLC, and records a plain-language explanation.

FIFO (spec) is strict first-come-first-served under the same limits. When the machine at the head of the line cannot get a variant slot, everyone behind it waits.

## Files

| File | Purpose |
|---|---|
| `src/simulation/masterMindBrain.js` | The decision engine: scoring, slot manager, and the snapshot shown in the panel. |
| `src/simulation/masterMindEngine.js` | The plant model: the 280-basket chain, loaders, unloaders, pallets, FIFO and Master Mind strategies, KPIs, fallback, and the head-less comparison. The plant numbers are at the top of the file. |
| `src/simulation/trackGeometry.js` | The rail loop measured in code, the same one the plant floor draws: the positions of the loaders, the unloaders, and the approach point. |
| `src/components/BrainButton.jsx`, `BrainPanel.jsx`, `brain.css` | The clickable brain and the decision panel. |
| `src/App.jsx` | Changed: uses `MasterMindEngine` and places the brain inside the plant floor. |
| `src/components/PlantFloor.jsx` | Changed: draws all 280 baskets on the loop, loader docks above the rail, RESERVED / UNLOADING / STACKING states on the unloaders, WAIT LOAD / STOPPED on the machines, and ★ for urgent orders. |
| `src/components/LeftHUD.jsx` | Changed: loaded and empty counts on the loop, and the real active-variant count. |

The original `App.jsx`, `PlantFloor.jsx` and `LeftHUD.jsx` are kept in `_backup_before_mastermind/`.

**To tune the plant**, edit `MM_MACHINE_SETUP` (variant and buffer per machine) and the rates at the top of `masterMindEngine.js`. `CHAIN_PITCHES_PER_SEC` sets the chain speed, `LOAD_RATE` the magazine fill time, and `STACK_SECONDS` the unloader stacking time.

**Play Story** is the original scripted tour. B152 keeps its place on the chain and is only highlighted, and closing the story restarts the plant.
