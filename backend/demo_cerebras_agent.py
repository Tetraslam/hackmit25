#!/usr/bin/env python3
"""
Cerebras AI Agent Demo for Griddy
================================
Demonstrates AI-powered microgrid optimization decisions in low-confidence scenarios.

This script simulates challenging grid conditions that trigger Cerebras AI escalation,
showing the agent's reasoning and dispatch decisions in real-time.

Usage: python demo_cerebras_agent.py
"""

import asyncio
import json
import math
import os
import sys
import time
from typing import List

import requests
import websockets
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

# Import from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from cerebras_agent import CerebrasAgent, EnergySourceInfo, NodeReading

from binary_protocol import BinaryProtocol, DispatchNode, DispatchPacket

console = Console()

# Demo configuration
DEMO_DURATION = 30  # seconds
SCENARIO_INTERVAL = 5  # seconds between scenarios
SEND_RATE = 2  # Hz for dispatch commands

class CerebrasDemo:
    def __init__(self):
        self.agent = None
        self.esp_ip = None
        self.websocket = None
        self.scenario_count = 0
        
    async def initialize(self):
        """Initialize Cerebras agent and get ESP32 IP."""
        console.print("[bold blue]🧠 Initializing Cerebras AI Demo[/bold blue]")
        
        # Initialize Cerebras agent
        try:
            self.agent = CerebrasAgent()
            console.print("✓ Cerebras agent initialized")
        except Exception as e:
            console.print(f"✗ Failed to initialize Cerebras agent: {e}")
            console.print("💡 Make sure CEREBRAS_API_KEY is set in your .env file")
            return False
            
        # Get ESP32 IP
        try:
            response = requests.get('http://kv.wfeng.dev/hackmit25:ip')
            self.esp_ip = response.text.strip()
            console.print(f"✓ ESP32 IP: {self.esp_ip}")
        except Exception as e:
            console.print(f"✗ Failed to get ESP32 IP: {e}")
            return False
            
        return True
    
    async def connect_to_esp32(self):
        """Connect to ESP32 /in endpoint."""
        try:
            in_uri = f"ws://{self.esp_ip}/in"
            self.websocket = await websockets.connect(in_uri, ping_interval=None)
            console.print(f"✓ Connected to ESP32 /in endpoint")
            return True
        except Exception as e:
            console.print(f"✗ Failed to connect to ESP32: {e}")
            return False
    
    def create_challenging_scenario(self, scenario_num: int) -> tuple[List[NodeReading], List[EnergySourceInfo], str]:
        """Create different challenging scenarios that require AI decision-making."""
        scenarios = [
            self._scenario_peak_demand_surge,
            self._scenario_unbalanced_load,
            self._scenario_rapid_fluctuations,
            self._scenario_grid_instability,
            self._scenario_emergency_demand
        ]
        
        scenario_func = scenarios[scenario_num % len(scenarios)]
        return scenario_func()
    
    def _scenario_peak_demand_surge(self):
        """Scenario 1: Sudden peak demand surge across all nodes."""
        readings = [
            NodeReading(id="1", type="consumer", demand_amps=4.8, fulfillment=0.65),
            NodeReading(id="2", type="consumer", demand_amps=5.2, fulfillment=0.58),
            NodeReading(id="3", type="consumer", demand_amps=4.9, fulfillment=0.62),
            NodeReading(id="4", type="consumer", demand_amps=5.1, fulfillment=0.60)
        ]
        
        sources = [
            EnergySourceInfo(id="1", max_supply_amps=12.0, cost_per_amp=0.08, ramp_limit_amps=2.0)
        ]
        
        return readings, sources, "Peak Demand Surge - All nodes experiencing 5A+ demand spikes"
    
    def _scenario_unbalanced_load(self):
        """Scenario 2: Severely unbalanced load distribution."""
        readings = [
            NodeReading(id="1", type="consumer", demand_amps=0.8, fulfillment=0.95),
            NodeReading(id="2", type="consumer", demand_amps=6.2, fulfillment=0.45),
            NodeReading(id="3", type="consumer", demand_amps=1.1, fulfillment=0.88),
            NodeReading(id="4", type="consumer", demand_amps=5.8, fulfillment=0.48)
        ]
        
        sources = [
            EnergySourceInfo(id="1", max_supply_amps=10.0, cost_per_amp=0.09, ramp_limit_amps=1.5)
        ]
        
        return readings, sources, "Unbalanced Load - Critical mismatch between nodes 2&4 vs 1&3"
    
    def _scenario_rapid_fluctuations(self):
        """Scenario 3: Rapid demand fluctuations causing instability."""
        t = time.time()
        base_demands = [2.5, 3.1, 2.8, 3.3]
        
        readings = []
        for i, base in enumerate(base_demands):
            # Add high-frequency oscillations
            noise = 1.5 * math.sin(t * 8 + i) + 0.8 * math.cos(t * 12 + i * 0.7)
            demand = max(0.5, base + noise)
            fulfillment = max(0.3, 0.85 - abs(noise) * 0.15)
            
            readings.append(NodeReading(
                id=str(i+1), 
                type="consumer", 
                demand_amps=demand, 
                fulfillment=fulfillment
            ))
        
        sources = [
            EnergySourceInfo(id="1", max_supply_amps=8.5, cost_per_amp=0.12, ramp_limit_amps=1.0)
        ]
        
        return readings, sources, "Rapid Fluctuations - High-frequency oscillations destabilizing grid"
    
    def _scenario_grid_instability(self):
        """Scenario 4: Grid instability with low fulfillment rates."""
        readings = [
            NodeReading(id="1", type="consumer", demand_amps=3.2, fulfillment=0.42),
            NodeReading(id="2", type="consumer", demand_amps=2.9, fulfillment=0.38),
            NodeReading(id="3", type="consumer", demand_amps=3.5, fulfillment=0.35),
            NodeReading(id="4", type="consumer", demand_amps=3.1, fulfillment=0.41)
        ]
        
        sources = [
            EnergySourceInfo(id="1", max_supply_amps=7.0, cost_per_amp=0.15, ramp_limit_amps=0.8)
        ]
        
        return readings, sources, "Grid Instability - All nodes showing <45% fulfillment rates"
    
    def _scenario_emergency_demand(self):
        """Scenario 5: Emergency high-priority demand requiring immediate action."""
        readings = [
            NodeReading(id="1", type="consumer", demand_amps=2.1, fulfillment=0.75),
            NodeReading(id="2", type="consumer", demand_amps=7.8, fulfillment=0.28),  # Emergency node
            NodeReading(id="3", type="consumer", demand_amps=1.9, fulfillment=0.82),
            NodeReading(id="4", type="consumer", demand_amps=2.3, fulfillment=0.71)
        ]
        
        sources = [
            EnergySourceInfo(id="1", max_supply_amps=9.0, cost_per_amp=0.10, ramp_limit_amps=1.8)
        ]
        
        return readings, sources, "Emergency Demand - Node 2 critical: 7.8A demand, 28% fulfillment"
    
    async def run_scenario(self, scenario_num: int):
        """Run a single challenging scenario through Cerebras AI."""
        self.scenario_count += 1
        
        # Create challenging scenario
        readings, sources, description = self.create_challenging_scenario(scenario_num)
        
        # Display scenario info
        scenario_panel = Panel(
            f"[bold yellow]Scenario {self.scenario_count}: {description}[/bold yellow]\n\n" +
            "\n".join([
                f"Node {r.id}: {r.demand_amps:.1f}A demand, {r.fulfillment*100:.0f}% fulfillment"
                for r in readings
            ]) + f"\n\nTotal Demand: {sum(r.demand_amps for r in readings):.1f}A",
            title="🚨 Grid Challenge Detected",
            border_style="red"
        )
        console.print(scenario_panel)
        
        # Get AI decision
        console.print("\n[bold blue]🧠 Escalating to Cerebras AI...[/bold blue]")
        
        try:
            start_time = time.time()
            # Simulate challenging optimization conditions
            fake_optimization_time = 150.0  # High optimization time indicates complexity
            fake_milp_confidence = 0.05  # Very low confidence triggers Cerebras
            
            ai_response = await self.agent.make_dispatch_decision(
                readings, 
                sources, 
                optimization_time_ms=fake_optimization_time,
                milp_confidence=fake_milp_confidence,
                context=f"Demo scenario {self.scenario_count}: {description}"
            )
            decision_time = (time.time() - start_time) * 1000
            
            # Display AI reasoning and decision
            ai_panel = Panel(
                f"[bold green]AI Reasoning:[/bold green]\n{ai_response.reasoning}\n\n" +
                f"[bold cyan]Dispatch Decision:[/bold cyan]\n" +
                "\n".join([
                    f"Node {d.id}: {d.supply_amps:.2f}A from source {d.source_id}"
                    for d in ai_response.decisions
                ]) + f"\n\n[dim]Decision time: {decision_time:.1f}ms | AI Confidence: {ai_response.confidence:.1%}[/dim]",
                title="🤖 Cerebras AI Response",
                border_style="green"
            )
            console.print(ai_panel)
            
            # Send AI decision to ESP32
            if self.websocket:
                dispatch_nodes = [
                    DispatchNode(id=int(d.id), supply=min(1.0, d.supply_amps/5.0), source=int(d.source_id))
                    for d in ai_response.decisions
                ]
                
                dispatch_packet = DispatchPacket(nodes=dispatch_nodes)
                binary_command = BinaryProtocol.encode_dispatch(dispatch_packet)
                
                await self.websocket.send(binary_command)
                console.print(f"✓ AI decision sent to ESP32 ({len(binary_command)} bytes)")
            
            return True
            
        except Exception as e:
            console.print(f"✗ Cerebras AI failed: {e}")
            return False
    
    async def run_demo(self):
        """Run the complete Cerebras AI demo."""
        if not await self.initialize():
            return
            
        if not await self.connect_to_esp32():
            return
            
        # Demo intro
        intro_panel = Panel(
            f"[bold white]Cerebras AI will analyze {DEMO_DURATION//SCENARIO_INTERVAL} challenging grid scenarios\n" +
            f"Each scenario triggers AI decision-making due to:\n" +
            f"• High demand spikes\n• Unbalanced loads\n• Grid instability\n• Emergency conditions\n\n" +
            f"The AI will provide reasoning and optimal dispatch commands.[/bold white]",
            title="🧠 Cerebras AI Microgrid Demo",
            border_style="blue"
        )
        console.print(intro_panel)
        
        # Run scenarios
        start_time = time.time()
        scenario_num = 0
        
        try:
            while time.time() - start_time < DEMO_DURATION:
                await self.run_scenario(scenario_num)
                scenario_num += 1
                
                # Wait for next scenario
                console.print(f"\n[dim]Next scenario in {SCENARIO_INTERVAL}s...[/dim]\n")
                await asyncio.sleep(SCENARIO_INTERVAL)
                
        except KeyboardInterrupt:
            console.print("\n[yellow]Demo interrupted by user[/yellow]")
        
        # Demo summary
        summary_panel = Panel(
            f"[bold green]Demo completed successfully![/bold green]\n\n" +
            f"Scenarios processed: {self.scenario_count}\n" +
            f"AI decisions made: {self.scenario_count}\n" +
            f"Commands sent to ESP32: {self.scenario_count}\n\n" +
            f"The Cerebras AI agent successfully handled complex grid optimization\n" +
            f"scenarios that would challenge traditional MILP solvers.",
            title="📊 Demo Summary",
            border_style="green"
        )
        console.print(summary_panel)
        
        # Clean up
        if self.websocket:
            await self.websocket.close()
            console.print("✓ ESP32 connection closed")

async def main():
    demo = CerebrasDemo()
    await demo.run_demo()

if __name__ == "__main__":
    # Load environment variables
    from pathlib import Path
    env_file = Path(__file__).parent / '.env'
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                if '=' in line and not line.strip().startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value
    
    asyncio.run(main())
