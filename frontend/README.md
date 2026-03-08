# Frontend Demo

This frontend is the live operator dashboard for the IoT-StreamLake demo.

It connects directly to AWS IoT Core over MQTT over WebSockets, consumes live telemetry, and derives:

- active device count
- throughput
- fleet health
- device health
- alert state
- device lookup data
- simulation and chaos controls

## Environment

Create `frontend/.env.local` with:

```bash
VITE_REGION=your-region
VITE_IOT_ENDPOINT=your-iot-endpoint
VITE_COGNITO_IDENTITY_POOL_ID=your-identity-pool-id
```

## Commands

```bash
npm install
npm run dev
npm run build
npm run test
```

## Demo Tip

Open the app with `?sim=1` to enable the floating simulation and chaos control panel.

For the full system overview, architecture, and demo walkthrough, see the project root [README](../README.md).
