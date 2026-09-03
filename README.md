# HospitalFlow AI

> **Intelligent Hospital Flow, Emergency Readiness & Care Continuity**

HospitalFlow AI is an end-to-end hospital operations coordination platform that manages the patient journey across three foundational pillars: **Flow Intelligence**, **Emergency Blood Readiness**, and **Care Continuity**.

Built with a medical-grade visual design system, transparent operational heuristics, zero-dependency pure ES Modules architecture, and an event-driven core, HospitalFlow AI bridges the operational disconnects that lead to emergency overcrowding, critical supply shortages, and post-discharge readmissions.

---

## 🌟 Core Pillars & Key Capabilities

### 1. Flow Intelligence (OPD & Queue Operations)
- **Smart Appointment Booking**: Schedule appointments with automatic doctor availability checks and no-show risk classification.
- **Explainable Wait-Time Predictions**: Transparent, deterministic queuing calculations ($ETA = \frac{\text{Patients Ahead}}{\text{Active Capacity}} + \text{Emergency Buffer}$) with clear factor breakdowns.
- **Digital Check-In via QR Code**: Instant check-in simulation transforming scheduled appointments into live queue tokens.
- **Live OPD Queue Engine**: Real-time queue state transitions (`Waiting` $\rightarrow$ `Called` $\rightarrow$ `Consulting` $\rightarrow$ `Completed`).
- **Emergency Priority Insertion**: Dynamic position #1 insertion that recalculates ETAs across the department in real-time.
- **Doctor Capacity Management**: Real-time availability toggles (`Available`, `Consulting`, `Break`, `Unavailable`) with automatic patient redistribution suggestions.

### 2. Emergency Blood Readiness (Supply & Escalation)
- **FEFO Inventory Tracking**: First-Expire, First-Out monitoring across all 8 blood groups ($A^\pm, B^\pm, AB^\pm, O^\pm$) and component types.
- **Automated Escalation Pipeline**: Seamless multi-stage resolution (`Created` $\rightarrow$ `Internal Check` $\rightarrow$ `Multi-Facility Matching` $\rightarrow$ `Donor Wave Notification` $\rightarrow$ `Reservation & Issue`).
- **Multi-Facility Sourced Matching**: Scored ranking algorithm weighing available stock (50%), distance (30%), and estimated transport transit time (20%).
- **Donor Network Coordination**: Locality-based wave broadcasting (5 donors/wave) with SMS/WhatsApp preference and 6-digit OTP verification.

### 3. Care Continuity (Post-Discharge Recovery)
- **Interactive Discharge Plans**: Comprehensive recovery itineraries with time-slotted medications, dietary instructions, warning signs, and caregiver sharing.
- **Medication Adherence Tracking**: Check-off timeline with real-time adherence rate calculations and missed-dose alerts.
- **Multilingual Support**: Instant locale toggling for patient instructions in **English**, **Hindi (हिन्दी)**, and **Marathi (मराठी)**.
- **Cross-Pillar Follow-up Scheduling**: Scheduling a discharge follow-up automatically creates linked appointments and queue entries in Flow Intelligence.
- **Patient Warning Sign Reporting & Care Re-entry**: Structured reporting triggers high-priority clinical notifications and prioritized re-entry triage.

### 4. What-If Scenario Simulator
- **Non-Destructive Simulation**: Clones the live application state for sandboxed stress-testing.
- **Parametric Stress Testing**: Adjust mass casualty surge (+1 to +10 emergency patients), doctor unavailabilities (-1 to -5 physicians), and general OPD influx (+1 to +50 arrivals).
- **Comparative Analytics & Recommendations**: Side-by-side baseline vs simulated metric cards and automated operational remedies.

### 5. Central Event Bus & Audit Logging
- **Event-Driven Architecture**: Decoupled domain events (`APPOINTMENT_BOOKED`, `PATIENT_CHECKED_IN`, `BLOOD_STOCK_CRITICAL`, `DISCHARGE_PLAN_CREATED`, etc.).
- **Live Audit Trail**: Timestamped historical audit trail with full event payloads and filtering.

---

## 🛠️ Technology Stack & Architecture

- **Frontend**: Pure Vanilla HTML5, CSS3, ES2022 JavaScript Modules (`type="module"`).
- **Design System**: Medical-grade CSS token architecture, HSL color system, Inter typography, glassmorphism accents, and responsive layout.
- **Visualizations**: [Chart.js 4.x](https://www.chartjs.org/) for OPD congestion bar charts, blood stock distribution, and trend curves.
- **Utilities**: [QRCode.js](https://github.com/davidshimjs/qrcodejs) for client-side ticket generation, [Font Awesome 6](https://fontawesome.com/) for iconography.
- **Backend / Database**: [Supabase](https://supabase.com/) PostgreSQL schema with RLS policies, or standalone zero-backend **Demo Mode** using persistent `localStorage`.

```
AnjumanProto/
├── css/
│   ├── variables.css      # Design tokens (colors, typography, spacing, shadows)
│   ├── base.css           # Global resets and HTML element styling
│   ├── layout.css         # App shell, sidebar, header, grids
│   ├── components.css     # Buttons, cards, forms, tables, badges, modals, toasts
│   ├── pages.css          # Page-specific styling for all modules
│   ├── responsive.css     # Tablet, mobile, and print media queries
│   └── animations.css     # Keyframes and micro-interaction transitions
├── js/
│   ├── config.js          # App constants, thresholds, role definitions
│   ├── utils.js           # ID generation, date formatters, sanitization
│   ├── events.js          # Central Pub/Sub event bus & audit registry
│   ├── storage.js         # LocalStorage persistence manager
│   ├── state.js           # Central reactive state manager
│   ├── demo-data.js       # High-fidelity synthetic dataset
│   ├── notifications.js   # Toast notifications & alert center
│   ├── auth.js            # Role-based access control & demo switcher
│   ├── router.js          # Client-side hash SPA router
│   ├── charts.js          # Chart.js visualization wrappers
│   ├── app.js             # Main bootstrap and window.HospitalFlow API
│   ├── engines/
│   │   ├── prediction-engine.js  # Transparent queuing & ETA calculation
│   │   ├── flow-engine.js        # Appointments, check-ins, queue lifecycle
│   │   ├── blood-engine.js       # Escalation pipeline & donor matching
│   │   ├── care-engine.js        # Discharge plans, adherence & multilingual
│   │   └── simulation-engine.js  # What-if scenario stress-tester
│   └── pages/
│       ├── login.js        # Split-screen brand & role authentication
│       ├── dashboard.js    # Command center KPIs & live monitoring
│       ├── flow.js         # Booking, live queue, doctor capacity, simulation
│       ├── emergency.js    # FEFO blood inventory, requests, donor directory
│       └── care.js         # Discharge plans, medication logs, follow-ups
├── supabase/
│   └── schema.sql         # Production PostgreSQL schema, RLS, and seed data
├── index.html             # Main single-page application entrypoint
└── README.md              # Documentation and presentation guide
```

---

## 🚀 Quick Start Guide

HospitalFlow AI is built with zero build steps or heavy bundlers required.

### 1. Launch with Any Local Web Server

#### Option A: Python (Built-in)
```bash
# Python 3.x
python -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

#### Option B: Node.js (npx)
```bash
npx serve .
# or
npx live-server
```

#### Option C: VS Code Live Server
Right-click `index.html` $\rightarrow$ **"Open with Live Server"**.

---

## 🎯 5-Minute Hackathon Demo Script

Follow this script to demonstrate the platform:

| Step | Action | What to Highlight |
| :--- | :--- | :--- |
| **1. Role Login** | On the login screen, click **"Administrator"** quick access. | Clean medical UI, instant session bootstrap with 35 patients, 12 doctors, 8 blood groups. |
| **2. Command Center** | Navigate to the **Command Center**. | Real-time KPIs (Active Patients, OPD Wait, Critical Alerts), live queue, FEFO inventory chart, and live event audit stream. |
| **3. Smart Booking & Prediction** | Go to **Flow Intelligence** $\rightarrow$ **Booking**. Select patient `Amit Kumar`, Department `Cardiology`, Doctor `Dr. Rajesh Mehta`. | The explainable ETA predictor calculates estimated wait time before booking based on live doctor workload. Click **Book Appointment** $\rightarrow$ instant QR code generation. |
| **4. Check-In & Queue Management** | Click **Simulate Check-In** on the generated ticket. Switch to the **Live Queue** tab. | Amit is now queued. Demonstrate calling the patient, starting consultation, and completing consultation. Watch stats update automatically. |
| **5. Emergency Insertion** | In the Live Queue tab, click **"Insert Emergency"**. | Emergency case placed at position #1; all subsequent queue ETAs are recalculated with notifications dispatched. |
| **6. Blood Escalation & Matching** | Go to **Emergency Readiness** $\rightarrow$ **Requests**. Create an emergency request for `2 units of O-`. | Stock is critically low. Click **View Sources** to see external facilities ranked by score, distance, and transit time. Click **Reserve** to resolve. |
| **7. Donor Wave & OTP** | Switch to **Donors** tab or trigger donor wave. | View locality-sorted eligible donors. Verify donor availability via simulated 6-digit OTP confirmation. |
| **8. Care Continuity & Adherence** | Go to **Care Continuity** $\rightarrow$ **Discharge Plans**. Select `Amit Kumar`. | View time-slotted medication schedule. Toggle medication checkboxes to update the adherence rate. Switch language to **Hindi** or **Marathi** to showcase localization. |
| **9. What-If Simulator** | Return to **Flow Intelligence** $\rightarrow$ **Simulator**. Set Emergency = 3, Doctors Unavailable = 2. Click **Run Simulation**. | Compare baseline vs stress-tested scenario with actionable operational remedies. |

---

## 🔒 Role-Based Permissions Summary

| Capability | Admin | Doctor | Reception | Blood Bank | Patient |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **View Command Center** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Book Appointments** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Patient Check-In** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Manage Queue / Consult** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Insert Emergency Patient** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Create Blood Request** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Reserve / Issue Blood** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Manage Donors & OTP** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Create Discharge Plans** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Personal Care Plan** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Run / Apply Simulator** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 📄 License & Medical Disclaimer

**Operational Coordination Platform**: HospitalFlow AI is designed for hospital logistics, queue coordination, supply chain readiness, and post-discharge schedule compliance. Clinical decisions and blood transfusion authorizations require confirmation by licensed healthcare professionals.
