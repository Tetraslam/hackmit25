"""
Cerebras AI Agent for Griddy Microgrid Optimization
==================================================
High-speed AI decision making for low-confidence scenarios using Cerebras gpt-oss-120b.

This agent receives sensor readings and provides dispatch decisions when the MILP
optimizer has low confidence in its solution. Uses structured output to match
the existing dispatch schema.

Author: HackMIT 2025 Team
"""

import asyncio
import json
import os
import time
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI
from pydantic import BaseModel


class NodeReading(BaseModel):
    """Single node sensor reading for Cerebras input."""
    id: str
    type: str  # "consumer" or "power"
    demand_amps: float
    fulfillment: float


class EnergySourceInfo(BaseModel):
    """Energy source information for Cerebras context."""
    id: str
    max_supply_amps: float
    cost_per_amp: float
    ramp_limit_amps: Optional[float]


class DispatchDecision(BaseModel):
    """Single dispatch decision from Cerebras."""
    id: str
    supply_amps: float
    source_id: str


class CerebrasDispatchResponse(BaseModel):
    """Structured output schema for Cerebras dispatch decisions."""
    decisions: List[DispatchDecision]
    reasoning: str
    confidence: float  # 0.0-1.0


class CerebrasAgent:
    """
    High-speed AI agent using Cerebras gpt-oss-120b for microgrid optimization.
    
    Provides dispatch decisions when MILP optimizer confidence is low.
    Operates at 3000+ tokens/sec for real-time decision making.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Cerebras agent with OpenAI-compatible client.
        
        Args:
            api_key: Cerebras API key (defaults to CEREBRAS_API_KEY env var)
        """
        self.api_key = api_key or os.getenv("CEREBRAS_API_KEY")
        if not self.api_key:
            raise ValueError("CEREBRAS_API_KEY environment variable required")
        
        # Initialize OpenAI client with Cerebras endpoint
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://api.cerebras.ai/v1"
        )
        
        self.model = "gpt-oss-120b"
        self.max_tokens = 1000
        self.temperature = 0.1  # Low temperature for consistent decisions
        
    async def make_dispatch_decision(
        self,
        sensor_readings: List[NodeReading],
        energy_sources: List[EnergySourceInfo],
        optimization_time_ms: float,
        milp_confidence: float,
        context: Optional[str] = None
    ) -> CerebrasDispatchResponse:
        """
        Generate dispatch decisions using Cerebras AI for low-confidence scenarios.
        
        Args:
            sensor_readings: Current sensor data from all nodes
            energy_sources: Available energy sources and their constraints
            optimization_time_ms: Time taken by MILP optimization
            milp_confidence: Confidence score from MILP solver (0.0-1.0)
            context: Additional context (e.g., grid conditions, weather)
            
        Returns:
            Structured dispatch decisions with reasoning
        """
        
        # Prepare system prompt for microgrid optimization
        system_prompt = """You are an expert microgrid operator with deep knowledge of power systems, renewable energy, and grid stability. You make real-time dispatch decisions for a microgrid when automated optimization has low confidence.

Your role:
- Analyze sensor readings from power grid nodes
- Consider energy source constraints and costs
- Make dispatch decisions to meet demand while minimizing cost
- Ensure grid stability and prevent blackouts
- Provide clear reasoning for decisions

Key principles:
1. Meet consumer demand first (prevent blackouts)
2. Use cheapest available sources when possible
3. Respect ramp rate limits for sources
4. Consider fulfillment rates as grid stress indicators
5. Balance cost optimization with reliability

Output format: Provide dispatch decisions as JSON with reasoning."""

        # Prepare user prompt with current grid state
        consumer_nodes = [n for n in sensor_readings if n.type == "consumer"]
        power_nodes = [n for n in sensor_readings if n.type == "power"]
        
        total_demand = sum(n.demand_amps for n in consumer_nodes)
        total_capacity = sum(s.max_supply_amps for s in energy_sources)
        avg_fulfillment = sum(n.fulfillment for n in consumer_nodes) / len(consumer_nodes) if consumer_nodes else 100.0
        
        user_prompt = f"""MICROGRID DISPATCH DECISION REQUIRED

SITUATION:
- MILP optimizer confidence: {milp_confidence:.1%} (below 50% threshold)
- Optimization time: {optimization_time_ms:.1f}ms
- Total demand: {total_demand:.2f}A from {len(consumer_nodes)} consumers
- Total capacity: {total_capacity:.1f}A from {len(energy_sources)} sources
- Average fulfillment: {avg_fulfillment:.1f}%

CURRENT SENSOR READINGS:
Consumer Nodes:
{chr(10).join(f"  Node {n.id}: {n.demand_amps:.2f}A demand, {n.fulfillment:.1f}% fulfillment" for n in consumer_nodes)}

Power Sources:
{chr(10).join(f"  Node {n.id}: {n.fulfillment:.1f}% availability" for n in power_nodes)}

AVAILABLE ENERGY SOURCES:
{chr(10).join(f"  {s.id}: max={s.max_supply_amps:.1f}A, cost=${s.cost_per_amp:.2f}/A" + (f", ramp_limit={s.ramp_limit_amps:.1f}A/epoch" if s.ramp_limit_amps else ", no_ramp_limit") for s in energy_sources)}

{f"ADDITIONAL CONTEXT: {context}" if context else ""}

TASK: Provide dispatch decisions to allocate power from sources to consumer nodes. Consider costs, constraints, and grid stability. Explain your reasoning clearly."""

        try:
            # Call Cerebras with structured output
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "dispatch_response",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "decisions": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "id": {"type": "string"},
                                            "supply_amps": {"type": "number"},
                                            "source_id": {"type": "string"}
                                        },
                                        "required": ["id", "supply_amps", "source_id"]
                                    }
                                },
                                "reasoning": {"type": "string"},
                                "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0}
                            },
                            "required": ["decisions", "reasoning", "confidence"]
                        }
                    }
                }
            )
            
            # Parse structured response
            content = response.choices[0].message.content
            result_data = json.loads(content)
            
            return CerebrasDispatchResponse(**result_data)
            
        except Exception as e:
            # Re-raise exception - no fallback, let caller handle
            raise e
    
    async def health_check(self) -> bool:
        """Check if Cerebras API is available."""
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Test"}],
                max_tokens=10,
                temperature=0.0
            )
            return True
        except Exception:
            return False


# Factory function for easy integration
def create_cerebras_agent() -> Optional[CerebrasAgent]:
    """Create Cerebras agent if API key is available."""
    try:
        return CerebrasAgent()
    except ValueError:
        return None
