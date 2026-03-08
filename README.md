# IoT-StreamLake

IoT-StreamLake is a live IoT observability demo that shows a full telemetry path from simulated devices to cloud ingest to a browser dashboard.

It is built to answer one simple question in a compelling way:

`What does a modern IoT streaming pipeline look like when devices are publishing right now and operators need to see the fleet respond live?`

The project is intentionally demo-first. It is designed to be shown, explored, and stress-tested. It is not positioned as a production platform, but it does demonstrate a real end-to-end architecture with live MQTT ingestion, cloud delivery, alerting, health scoring, and failure simulation.

## Demo Story

This demo simulates a fleet of sensors publishing telemetry such as:

- `device_id`
- `timestamp`
- `temperature`
- `humidity`

That data moves through three layers:

1. `simulator/`
   Generates realistic MQTT traffic at scale.
2. `infra/`
   Provisions AWS resources for ingest and browser access.
3. `frontend/`
   Displays live fleet state, alerts, and health in a dashboard.

The result is a hands-on demo for:

- live telemetry streaming
- AWS IoT Core integration
- Firehose delivery into S3
- browser-based MQTT subscriptions
- fleet activity tracking
- real-time throughput and health indicators
- operator-facing alerts
- client-side chaos and failure simulation

## What The Demo Shows

### Live Telemetry Dashboard

The frontend subscribes directly to AWS IoT Core over MQTT over WebSockets and keeps a rolling in-memory stream of the latest telemetry. From that stream it derives:

- active device count
- data throughput
- fleet health score
- current alert count
- latest temperature, humidity, and energy view
- device lookup from observed live traffic

### Alerting Experience

The dashboard includes an alerts workflow designed for live demo sessions:

- connection loss alerts
- stale stream detection
- throughput collapse warnings
- out-of-range sensor alerts
- per-device offline alerts
- fleet degradation alerts
- alert acknowledge and dismiss actions
- local alert history persistence

### Simulation And Chaos Controls

The demo includes a client-side simulation panel that can be enabled with `?sim=1` in the frontend URL. It allows you to simulate:

- forced disconnect
- message drops
- artificial message delay
- device dropout
- sensor spikes
- fleet degradation
- automatic demo-mode chaos cycling

This makes it easy to show how the dashboard reacts under stress without changing infrastructure.

## Architecture

### 1. Telemetry Generation

The simulator publishes MQTT messages to topics in the form:

```text
sensors/telemetry/{device_id}
```

It supports two modes:

- `POOL`
  Reuses a finite device pool for stable fleet demos.
- `INFINITE`
  Continuously introduces new device IDs for scale and churn testing.

### 2. Cloud Ingest

The AWS CDK stack provisions:

- an S3 bucket for raw telemetry
- a Firehose delivery stream
- an inline Lambda transform for newline-delimited JSON output
- an IoT Topic Rule that forwards telemetry to Firehose
- a Cognito Identity Pool for browser clients
- IAM permissions allowing the dashboard to subscribe to the telemetry topic

Telemetry is transformed, compressed, and written to S3 with date-based prefixes.

### 3. Browser Dashboard

The React frontend:

- authenticates via Cognito Identity Pool credentials
- connects to AWS IoT Core over WebSockets
- subscribes to `sensors/telemetry/#`
- stores a rolling buffer of messages
- derives health and alert state from the shared stream
- renders the operator dashboard from that live state

## Repository Layout

```text
.
|-- frontend/    React + TypeScript + Vite live dashboard
|-- infra/       AWS CDK stack for IoT Core, Firehose, S3, Cognito
|-- simulator/   Python MQTT publisher and Docker-based load generation
```

## Key Frontend Demo Features

- shared MQTT provider for a single app-wide live connection
- derived hooks for throughput, active devices, system health, device health, alerts, and device lookup
- KPI cards for live fleet visibility
- slide-out alerts panel with filtering and history
- sensor cards that react to incoming values
- device search from live-seen telemetry
- test coverage for core live-data hooks and sensor display logic

## Running The Demo

### Prerequisites

- AWS account with access to deploy the CDK stack
- Node.js for the frontend toolchain
- Python 3 for the standalone simulator, or Docker for containerized simulation

### 1. Deploy Infrastructure

From `infra/`:

```bash
npm install
npx cdk deploy
```

Capture the deployed values you need for the frontend, especially:

- AWS region
- Cognito Identity Pool ID
- AWS IoT endpoint

### 2. Configure The Frontend

Create `frontend/.env.local` with:

```bash
VITE_REGION=your-region
VITE_IOT_ENDPOINT=your-iot-endpoint
VITE_COGNITO_IDENTITY_POOL_ID=your-identity-pool-id
```

### 3. Start The Frontend

From `frontend/`:

```bash
npm install
npm run dev
```

To enable simulation and chaos controls in the UI:

```text
http://localhost:5173/?sim=1
```

### 4. Start The Simulator

You can run the Python publisher directly or use Docker Compose.

Direct Python run:

```bash
pip install -r simulator/requirements.txt
python simulator/publisher.py
```

Docker Compose run:

```bash
cd simulator
docker compose up --build
```

The compose setup is configured to target AWS IoT Core and can replicate the simulator for higher message volume.

## Demo Flow Suggestions

If you are presenting this project, this is the strongest sequence:

1. Start the simulator and let the dashboard populate.
2. Show active devices climbing and throughput changing live.
3. Open device lookup and search for an observed sensor.
4. Open the alerts panel and explain the categories.
5. Enable `?sim=1` and trigger delay, drops, or disconnect.
6. Show the system health score degrade and alerts react in real time.
7. Revert the simulation settings and show the dashboard recover.

## Why This Demo Works

This project is effective as a demo because it is not just static UI. It has:

- real message flow
- realistic cloud integration
- visible operational feedback
- controllable failure injection
- enough scale pressure to make the dashboard interesting

It gives a viewer a clear picture of how live IoT telemetry can be ingested, monitored, and explored in near real time.

## Demo Boundaries

This repository is best understood as a technical showcase, not a finished product. It currently focuses on:

- live monitoring
- ingest path demonstration
- streaming behavior
- dashboard interaction
- failure simulation

It does not yet attempt to be a complete commercial platform with:

- multi-tenant customer management
- device provisioning workflows
- historical analytics UI
- user roles and access control
- ticketing or incident workflow integrations
- long-term reporting

## Close-Out Summary

IoT-StreamLake is a strong end-of-project demo for showing:

- how simulated devices publish telemetry
- how AWS IoT Core and Firehose can ingest that data
- how a React dashboard can subscribe to it live
- how fleet status, alerts, and simulated failures can be presented in a credible operator experience

If the goal is to close out the project as a polished demo, this repository is in a good shape for that purpose.
