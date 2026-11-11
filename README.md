<<<<<<< HEAD
# EcoRoute AI 🌿
> **"Smarter Routes. Cleaner Cities."**  
> AI-Powered Smart Waste Collection Optimizer for Municipal Fleets

---

## 🌟 Executive Overview
Urban waste collection has historically relied on rigid, static schedules. Refuse trucks frequently travel to empty bins while high-density receptacles overflow, wasting diesel fuel, inflating municipal budgets, and releasing avoidable carbon emissions.

**EcoRoute AI** transforms urban waste logistics into an intelligent, data-driven operation. By continuously monitoring receptacle fill levels and elapsed time, the platform identifies urgent bins, evaluates collection priority scores, calculates optimized collection loops using nearest-neighbor TSP heuristics, and quantifies potential fuel and CO₂ savings against baseline dispatch schedules.

---

## 🎨 Visual Design Identity
- **Climate-Tech Aesthetics**: Designed to feel like an environmental intelligence startup product rather than a generic SaaS template.
- **Natural Color Palette**:
  - Forest Green (`#234C36`)
  - Deep Evergreen (`#183D2B`)
  - Sage Green (`#8BA88E`)
  - Soft Mint (`#E6EFE5`)
  - Warm Ivory (`#F8F7F1`)
  - Charcoal Text (`#252B26`)
  - Soft Border (`#E5E8DF`)
- **Typography**: Plus Jakarta Sans & Inter for clean, confident hierarchy.

---

## 🛠 Tech Stack & Architecture

### Backend (Python & FastAPI)
```
backend/
  app/
    main.py          # FastAPI application routes & middleware
    models.py        # Pydantic data schemas & request/response validation
    data.py          # Synthetic dataset generator for Delhi (Rohini / DTU Zone)
    priority.py      # Transparent multi-factor priority scoring engine
    routing.py       # Haversine distance matrix & Nearest-Neighbor TSP optimizer
    analytics.py     # Aggregated fleet telemetry & environmental impact calculator
  requirements.txt   # Dependencies: fastapi, uvicorn, pydantic
```

### Frontend (React & Vite)
```
frontend/
  src/
    components/
      Sidebar.jsx           # Clean navigation & system status badge
      DashboardHeader.jsx   # Contextual greeting, telemetry indicator & refresh trigger
      MetricSummary.jsx     # Four compact core operational metrics
      WasteMap.jsx          # React Leaflet interactive map with custom SVG circular markers
      PriorityList.jsx      # Scannable "Needs attention" list with batch actions & map centering
      RouteOptimizer.jsx    # Baseline vs optimized distance comparison & turn-by-turn sequence
      ImpactSummary.jsx     # Distance saved, fuel saved, and CO₂ emissions mitigated
      BinDetailsModal.jsx   # Deep sensor telemetry inspector (battery, temp, capacity)
      BinMonitoringView.jsx # Searchable grid/table view of all 52 receptacles
      AnalyticsView.jsx     # Environmental intelligence & fleet analytics
    api.js                  # Frontend API communication layer
    App.jsx                 # Central workflow state orchestrator
    index.css               # Nature-inspired Tailwind CSS theme & Leaflet styles
```

---

## 🚀 Running the Project

### 1. Backend Server
```bash
# Activate virtual environment
.\venv\Scripts\activate

# Launch FastAPI server on port 8000
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
- API Docs: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/api/health`

### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev
```
- Web Application: `http://127.0.0.1:5173`

---

## 📊 Transparent Priority & Impact Formulas

### Priority Scoring Formula
$$\text{Time Score} = \min\left(100, \frac{\text{Hours Since Last Collection}}{48} \times 100\right)$$
$$\text{Priority Score} = 0.75 \times \text{Fill Level} + 0.25 \times \text{Time Score}$$
- **Critical**: Assigned whenever $\text{Fill Level} \ge 90\%$.
- **High**: $\text{Score} \ge 75$ or $\text{Fill Level} \ge 75\%$.
- **Medium**: $\text{Score} \ge 45$ or $\text{Fill Level} \ge 45\%$.
- **Low**: $< 45\%$.

### Fleet Fuel & Carbon Equations
- **Vehicle Standard**: 16-tonne medium urban refuse vehicle
- **Fuel Consumption**: $28.0\text{ L} / 100\text{ km}$
- **Diesel CO₂ Factor**: $2.68\text{ kg CO}_2 / \text{L}$

$$\text{Fuel Saved (L)} = \frac{\text{Distance Saved (km)} \times 28.0}{100}$$
$$\text{CO}_2\text{ Avoided (kg)} = \text{Fuel Saved (L)} \times 2.68$$

---

## 🛡 Prototype Disclosures
- **Geographic Approximation**: Distances are computed via the Haversine great-circle formula between coordinates. Straight-line geodesic distance represents an operational heuristic approximation for demonstration purposes.
- **Simulated Stream**: Receptacle telemetry is simulated around the Delhi Smart Urban Zone (Rohini / DTU Campus environs) using a deterministic seed (42) for reproducible demonstrations. Dynamic sensor updates can be simulated at any time using the "Refresh Readings" action.
=======
# edusure
Edu Sure OS
>>>>>>> 9038c0ee369ebe2108ff55e597ea5e270666c520
