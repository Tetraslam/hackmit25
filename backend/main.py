"""
Griddy - Microgrid Optimization Backend
======================================
ESP32 hardware-in-the-loop power grid optimization for HackMIT 2025.

What it does:
- Connects to ESP32 microgrid hardware via WebSocket (24Hz)
- Runs MILP optimization with Fourier demand forecasting
- Escalates to Cerebras AI when confidence is low
- Serves metrics API for dashboard
- Streams dispatch commands back to hardware

Author: HackMIT 2025 Team
"""

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import numpy as np
import websockets
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from microgrid_optimizer import DemandRecord, EnergySource, MicrogridOptimizer
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global state
hardware_websocket: Optional[websockets.WebSocketCommonProtocol] = None
frontend_clients: List[WebSocket] = []
optimizer = MicrogridOptimizer(epoch_len=1/24, horizon=10)
telemetry_buffer = deque(maxlen=1000)  # Store last 1000 readings
latest_metrics: Dict[str, Any] = {}
confidence_scores = deque(maxlen=100)

# Energy sources configuration
ENERGY_SOURCES = [
    EnergySource(id="ESP32_MAIN", max_supply_amps=5.0, cost_per_amp=0.10, ramp_limit_amps=None),
    EnergySource(id="IRON_AIR_BACKUP", max_supply_amps=3.0, cost_per_amp=0.05, ramp_limit_amps=1.0),
]

class TelemetryData(BaseModel):
    timestamp: int
    nodes: List[Dict[str, Any]]

class DispatchCommand(BaseModel):
    nodes: List[Dict[str, Any]]

async def connect_to_esp32():
    """Connect to ESP32 hardware via WebSocket and handle telemetry stream."""
    global hardware_websocket
    
    # Get ESP32 IP from key-value store
    import httpx
    try:
        async with httpx.AsyncClient(verify=False) as client:  # Disable SSL verification for dev
            response = await client.get('https://kv.wfeng.dev/hackmit25:ip', timeout=5.0)
            esp_ip = response.text.strip()
            logger.info(f"ESP32 IP: {esp_ip}")
    except Exception as e:
        logger.error(f"Failed to get ESP32 IP: {e}")
        esp_ip = "192.168.1.100"  # fallback
    
    while True:
        try:
            uri = f"ws://{esp_ip}/ws"
            logger.info(f"Connecting to ESP32 at {uri}")
            
            async with websockets.connect(uri) as websocket:
                hardware_websocket = websocket
                logger.info("Connected to ESP32 hardware")
                
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        await process_hardware_telemetry(data)
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON from ESP32: {message}")
                    except Exception as e:
                        logger.error(f"Error processing telemetry: {e}")
                        
        except Exception as e:
            logger.error(f"ESP32 connection failed: {e}")
            hardware_websocket = None
            await asyncio.sleep(5)  # Retry after 5 seconds

async def process_hardware_telemetry(data: Dict[str, Any]):
    """Process incoming telemetry from ESP32 and run optimization."""
    global latest_metrics
    
    try:
        # Parse ESP32 data format: {"timestamp": ms, "nodes": [{"id", "type", "demand", "ff"}]}
        timestamp = data.get("timestamp", int(time.time() * 1000)) / 1000  # Convert to seconds
        nodes = data.get("nodes", [])
        
        # Convert to DemandRecord format
        records = []
        for node in nodes:
            if node.get("type") == "consumer":  # Only consumers have demand
                record = DemandRecord(
                    timestamp=timestamp,
                    node_id=str(node.get("id", 0)),  # Keep as string for optimizer consistency
                    demand_amps=float(node.get("demand", 0)),
                    fulfillment=float(node.get("ff", 95.0))
                )
                records.append(record)
        
        # Add to telemetry buffer
        telemetry_buffer.extend(records)
        
        # Run optimization if we have enough data
        if len(telemetry_buffer) >= 10:  # Need some history
            opt_start = time.time()
            
            try:
                # Run MILP optimization
                dispatch_instructions = optimizer.schedule(list(telemetry_buffer), ENERGY_SOURCES)
                opt_time = (time.time() - opt_start) * 1000
                
                # Debug: Log node IDs being processed
                unique_nodes = set(r.node_id for r in list(telemetry_buffer)[-20:])  # Last 20 records
                logger.debug(f"Processing nodes: {sorted(unique_nodes)}, got {len(dispatch_instructions)} dispatch commands")
                
                # Calculate confidence score
                confidence = calculate_confidence_score(records, dispatch_instructions, opt_time)
                confidence_scores.append(confidence)
                
                # Check if we need Cerebras escalation
                if confidence < 0.5:  # Low confidence threshold
                    logger.info(f"Low confidence ({confidence:.2f}), considering Cerebras escalation")
                    # TODO: Implement Cerebras API call
                
                # Send dispatch commands back to ESP32
                await send_dispatch_to_hardware(dispatch_instructions)
                
                # Update metrics for frontend
                latest_metrics = {
                    "timestamp": int(timestamp * 1000),
                    "nodes": [
                        {
                            "id": int(record.node_id),  # Convert string back to int for frontend
                            "type": "consumer",
                            "demand": record.demand_amps,
                            "fulfillment": record.fulfillment
                        }
                        for record in records
                    ] + [
                        {
                            "id": 999,  # Use a high ID for the power source to avoid conflicts
                            "type": "power", 
                            "demand": 0.0,
                            "fulfillment": sum(d["supply_amps"] for d in dispatch_instructions)
                        }
                    ],
                    "optimization_time_ms": opt_time,
                    "confidence_score": confidence,
                    "dispatch_count": len(dispatch_instructions)
                }
                
                # Broadcast to frontend clients
                await broadcast_to_frontend(latest_metrics)
                
            except Exception as e:
                logger.error(f"Optimization failed: {e}")
                
    except Exception as e:
        logger.error(f"Error processing telemetry: {e}")

def calculate_confidence_score(records: List[DemandRecord], dispatch: List[Dict], opt_time: float) -> float:
    """Calculate confidence score based on optimization quality and timing."""
    
    # Base confidence from optimization time (faster = more confident)
    time_confidence = max(0, 1 - (opt_time / 100))  # 100ms = 0 confidence
    
    # Demand satisfaction confidence
    total_demand = sum(r.demand_amps for r in records)
    total_dispatched = sum(d["supply_amps"] for d in dispatch)
    satisfaction_ratio = min(1.0, total_dispatched / max(total_demand, 0.1))
    
    # Historical variance confidence
    recent_demands = [r.demand_amps for r in list(telemetry_buffer)[-50:]]
    if len(recent_demands) > 10:
        demand_variance = np.var(recent_demands) / max(np.mean(recent_demands), 0.1)
        variance_confidence = max(0, 1 - demand_variance)
    else:
        variance_confidence = 0.5  # Neutral when insufficient data
    
    # Weighted average
    confidence = (0.3 * time_confidence + 0.5 * satisfaction_ratio + 0.2 * variance_confidence)
    return min(1.0, max(0.0, confidence))

async def send_dispatch_to_hardware(dispatch_instructions: List[Dict[str, Any]]):
    """Send optimization results back to ESP32 hardware."""
    global hardware_websocket
    
    if not hardware_websocket:
        return
    
    try:
        # Convert to ESP32 expected format
        command = {
            "nodes": [
                {
                    "id": int(d["id"]),  # Convert string node_id back to int for ESP32
                    "supply": float(d["supply_amps"]) / 5.0,  # Normalize to 0-1 for PWM
                    "source": 1  # Source ID (simplified)
                }
                for d in dispatch_instructions
            ]
        }
        
        await hardware_websocket.send(json.dumps(command))
        logger.debug(f"Sent dispatch to ESP32: {len(command['nodes'])} commands")
        
    except Exception as e:
        logger.error(f"Failed to send dispatch to hardware: {e}")

async def broadcast_to_frontend(metrics: Dict[str, Any]):
    """Broadcast metrics to all connected frontend clients."""
    if not frontend_clients:
        return
    
    message = json.dumps(metrics)
    disconnected = []
    
    for client in frontend_clients:
        try:
            await client.send_text(message)
        except:
            disconnected.append(client)
    
    # Remove disconnected clients
    for client in disconnected:
        frontend_clients.remove(client)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Start ESP32 connection task
    esp32_task = asyncio.create_task(connect_to_esp32())
    logger.info("Griddy backend started - connecting to ESP32")
    
    yield
    
    # Cleanup
    esp32_task.cancel()
    logger.info("Griddy backend shutting down")

# FastAPI app
app = FastAPI(
    title="Griddy Backend",
    description="ESP32 microgrid optimization with MILP and Cerebras AI",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "active",
        "hardware_connected": hardware_websocket is not None,
        "frontend_clients": len(frontend_clients),
        "telemetry_buffer_size": len(telemetry_buffer),
        "latest_confidence": confidence_scores[-1] if confidence_scores else None
    }

@app.get("/metrics")
async def get_metrics():
    """Get latest metrics for frontend dashboard."""
    if not latest_metrics:
        # Return empty state if no data yet
        return {
            "timestamp": int(time.time() * 1000),
            "nodes": [],
            "optimization_time_ms": 0,
            "confidence_score": 0.0,
            "dispatch_count": 0
        }
    
    return latest_metrics

@app.websocket("/ws/frontend")
async def frontend_websocket(websocket: WebSocket):
    """WebSocket endpoint for frontend real-time updates."""
    await websocket.accept()
    frontend_clients.append(websocket)
    logger.info("Frontend client connected")
    
    try:
        # Send current metrics immediately
        if latest_metrics:
            await websocket.send_text(json.dumps(latest_metrics))
        
        # Keep connection alive
        while True:
            await websocket.receive_text()  # Ping/pong or commands from frontend
            
    except WebSocketDisconnect:
        frontend_clients.remove(websocket)
        logger.info("Frontend client disconnected")

@app.post("/dispatch")
async def manual_dispatch(command: DispatchCommand):
    """Manual dispatch override (for testing)."""
    try:
        await send_dispatch_to_hardware(command.nodes)
        return {"status": "sent", "nodes": len(command.nodes)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/telemetry")
async def get_telemetry(limit: int = 100):
    """Get recent telemetry data."""
    recent_data = list(telemetry_buffer)[-limit:]
    return {
        "count": len(recent_data),
        "data": [
            {
                "timestamp": r.timestamp,
                "node_id": r.node_id,
                "demand_amps": r.demand_amps,
                "fulfillment": r.fulfillment
            }
            for r in recent_data
        ]
    }

@app.get("/confidence")
async def get_confidence_history():
    """Get confidence score history."""
    return {
        "scores": list(confidence_scores),
        "current": confidence_scores[-1] if confidence_scores else 0.0,
        "average": np.mean(confidence_scores) if confidence_scores else 0.0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
    )
