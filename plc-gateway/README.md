# SIEGER OHC — PLC gateway and PLC simulator

```
PLC  ⇄  Modbus TCP  ⇄  gateway.js (Master Mind PC)  ⇄  WebSocket  ⇄  web page (PLC data source)
```

A web page cannot open a Modbus TCP connection by itself. `gateway.js` runs on the Master Mind PC, talks Modbus TCP to the PLC, and passes the registers to the page.

## First time

From the project folder:

```
npm run plc:install        (installs modbus-serial and ws into plc-gateway/)
```

## Connect to the real PLC

1. Start the gateway: `npm run plc:gateway`. It listens on `ws://localhost:8765`.
2. Start the app with `npm run dev`. Go to **Plant setup → 2 · PLC data source → Actual PLC data**.
3. Enter the PLC IP address, port (normally 502), unit ID and poll time. Press **Connect to PLC**.

The page checks every value against the plant setup and shows loaders, unloaders, pallet stations, baskets, raw registers and the information outputs.

## Test without the PLC

Open two terminals:

```
npm run plc:simulator      (Modbus TCP PLC simulator on port 5020)
npm run plc:gateway
```

On the page choose **Actual PLC data**, host `127.0.0.1`, port `5020`, then Connect.

To simulate your own setup:
1. On the page, press **Setup for the PLC simulator (JSON)**.
2. Run `node plc-gateway/plc-simulator.js --setup sieger-setup.json`.

Options: `--port 502` and `--unit 1`.

## Register map

- The map is built from the plant setup: 16 words of system data, 8 per loader, 6 per unloader, 8 per pallet station, and 4 per basket.
- Commands from the brain start at 3000.
- **Register map (CSV)** on the page lists every register with its 4xxxx address, for the PLC programmer.
- The block start addresses can be changed on the page to match the PLC program.

## Writes

The brain only writes (PERMIT_LOAD, LOAD_PACE, STATION, station assignment, brain heartbeat) when **Allow the brain to write commands to the PLC** is ticked. The gateway refuses writes otherwise.
