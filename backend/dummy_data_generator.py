"""
Dummy Data Generator for Microgrid Optimization Testing
========================================================
This module generates realistic synthetic data for testing the microgrid optimizer.
It simulates:
- Multiple nodes with varying demand patterns (residential, commercial, industrial)
- Energy sources with different characteristics (solar, battery, grid)
- Temporal patterns (daily fluctuations, outages etc)

"""

import numpy as np
import random
from typing import List, Tuple
from dataclasses import dataclass
import time
from microgrid_optimizer import DemandRecord, EnergySource


class DummyDataGenerator:
    """
    Generates realistic dummy data for microgrid optimization testing.
    Simulates different node types with characteristic demand patterns.
    """
    
    def __init__(self, seed: int = 42):
        """
        Initialize the data generator with a random seed for reproducibility.
        
        Args:
            seed: Random seed for consistent test data generation
        """
        np.random.seed(seed)
        random.seed(seed)
        
        # Define node types with characteristic patterns
        self.node_types = {
            'residential': {
                'base_demand': 30,  # Base demand in amps
                'peak_hours': [7, 8, 18, 19, 20],  # Morning and evening peaks
                'peak_multiplier': 1.8,
                'noise_level': 0.15  # 15% random variation
            },
            'commercial': {
                'base_demand': 50,
                'peak_hours': list(range(9, 18)),  # Business hours
                'peak_multiplier': 1.5,
                'noise_level': 0.10
            },
            'industrial': {
                'base_demand': 100,
                'peak_hours': list(range(6, 22)),  # Extended operating hours
                'peak_multiplier': 1.2,
                'noise_level': 0.05  # More stable demand
            },
            'ev_charging': {
                'base_demand': 20,
                'peak_hours': [18, 19, 20, 21, 22],  # Evening charging
                'peak_multiplier': 3.0,  # High peak for fast charging
                'noise_level': 0.25  # High variability
            }
        }
    
    def generate_nodes(self, num_nodes: int = 10) -> List[Tuple[str, str]]:
        """
        Generate a list of nodes with assigned types.
        
        Args:
            num_nodes: Number of nodes to generate
            
        Returns:
            List of (node_id, node_type) tuples
        """
        nodes = []
        type_names = list(self.node_types.keys())
        
        for i in range(num_nodes):
            node_id = f"NODE_{i+1:03d}"
            # Distribute node types with some bias
            if i < 4:
                node_type = 'residential'  
            elif i < 6:
                node_type = 'commercial'
            elif i < 8:
                node_type = 'industrial'
            else:
                node_type = random.choice(type_names)
            
            nodes.append((node_id, node_type))
        
        return nodes
    
    def generate_demand_records(self, 
                               nodes: List[Tuple[str, str]],
                               duration_seconds: float = 60,
                               frequency_hz: float = 24) -> List[DemandRecord]:
        """
        Generate time-series demand records for all nodes.
        
        Creates realistic demand patterns with:
        - Daily cycles based on node type
        - Random variations and noise
        - Occasional demand spikes
        - Fulfillment rates based on current system stress
        
        Args:
            nodes: List of (node_id, node_type) tuples
            duration_seconds: Duration of data to generate
            frequency_hz: Sampling frequency in Hz
            
        Returns:
            List of DemandRecord objects
        """
        records = []
        num_samples = int(duration_seconds * frequency_hz)
        
        # Generate base timestamp array
        start_time = time.time()
        timestamps = np.linspace(start_time, start_time + duration_seconds, num_samples)
        
        for node_id, node_type in nodes:
            node_config = self.node_types[node_type]
            
            for i, ts in enumerate(timestamps):
                # Simulate hour of day (for daily pattern)
                hour_of_day = (int(ts) // 3600) % 24
                
                # Base demand with daily pattern
                if hour_of_day in node_config['peak_hours']:
                    base = node_config['base_demand'] * node_config['peak_multiplier']
                else:
                    base = node_config['base_demand']
                
                # Add sinusoidal variation (simulates gradual changes)
                daily_phase = 2 * np.pi * (ts % 86400) / 86400  # Daily cycle
                sinusoidal = 0.1 * base * np.sin(daily_phase)
                
                # Add random noise
                noise = np.random.normal(0, node_config['noise_level'] * base)
                
                if random.random() < 0.05:
                    spike = random.uniform(0.2, 0.5) * base
                else:
                    spike = 0
                
                # Calculate total demand (ensure non-negative)
                demand = max(0, base + sinusoidal + noise + spike)
                
                # Simulate fulfillment (higher demand = lower fulfillment probability)
                # This simulates system stress
                if demand > node_config['base_demand'] * 1.5:
                    fulfillment = random.uniform(70, 90)  # High stress
                elif demand > node_config['base_demand'] * 1.2:
                    fulfillment = random.uniform(85, 95)  # Medium stress
                else:
                    fulfillment = random.uniform(95, 100)  # Low stress
                
                record = DemandRecord(
                    timestamp=ts,
                    node_id=node_id,
                    demand_amps=round(demand, 2),
                    fulfillment=round(fulfillment, 1)
                )
                records.append(record)
        
        return records
    
    def generate_energy_sources(self) -> List[EnergySource]:
        """
        Generate a diverse set of energy sources with realistic characteristics.
        
        Returns:
            List of EnergySource objects representing different generation types
        """
        sources = [
            # Solar farm - cheap but limited and variable
            EnergySource(
                id="SOLAR_001",
                max_supply_amps=200.0,  # Peak capacity during sunny periods
                cost_per_amp=0.05,  # Very low marginal cost
                ramp_limit_amps=50.0  # Can change quickly with cloud cover
            ),
            
            # Battery storage - moderate cost, fast response
            EnergySource(
                id="BATTERY_001",
                max_supply_amps=150.0,
                cost_per_amp=0.15,  # Includes degradation cost
                ramp_limit_amps=100.0  # Very fast response
            ),
            
            # Natural gas generator - higher cost, reliable
            EnergySource(
                id="GAS_GEN_001",
                max_supply_amps=300.0,  # Large capacity
                cost_per_amp=0.25,
                ramp_limit_amps=30.0  # Slower ramp rate
            ),
            
            # Grid connection - highest cost but unlimited (practically)
            EnergySource(
                id="GRID_001",
                max_supply_amps=500.0,  # Very high capacity
                cost_per_amp=0.35,  # Most expensive
                ramp_limit_amps=None  # No ramp limit
            ),
            
            # Wind turbine - variable, cheap when available
            EnergySource(
                id="WIND_001",
                max_supply_amps=100.0,
                cost_per_amp=0.08,
                ramp_limit_amps=40.0
            ),
            
            # Diesel backup generator - emergency use, very expensive
            EnergySource(
                id="DIESEL_001",
                max_supply_amps=200.0,
                cost_per_amp=0.50,  # Very expensive to run
                ramp_limit_amps=25.0  # Slow startup
            )
        ]
        
        return sources
    
    def generate_variable_source_capacity(self, 
                                         sources: List[EnergySource],
                                         time_factor: float) -> List[EnergySource]:
        """
        Modify source capacities based on time to simulate renewable variability.
        
        Args:
            sources: Original list of energy sources
            time_factor: Time-based factor (0-1) representing time of day/weather
            
        Returns:
            Modified list of sources with adjusted capacities
        """
        modified_sources = []
        
        for source in sources:
            modified = EnergySource(
                id=source.id,
                max_supply_amps=source.max_supply_amps,
                cost_per_amp=source.cost_per_amp,
                ramp_limit_amps=source.ramp_limit_amps
            )
            
            # Adjust renewable sources based on time/conditions
            if "SOLAR" in source.id:
                # Solar varies with time of day (peak at noon)
                solar_factor = max(0, np.sin(np.pi * time_factor))
                modified.max_supply_amps = source.max_supply_amps * solar_factor
                
            elif "WIND" in source.id:
                # Wind varies randomly
                wind_factor = 0.3 + 0.7 * random.random()
                modified.max_supply_amps = source.max_supply_amps * wind_factor
                
            elif "BATTERY" in source.id:
                # Battery capacity decreases as it discharges
                battery_factor = 0.5 + 0.5 * random.random()
                modified.max_supply_amps = source.max_supply_amps * battery_factor
            
            modified_sources.append(modified)
        
        return modified_sources
    
    def generate_stress_scenario(self, 
                                nodes: List[Tuple[str, str]],
                                multiplier: float = 1.5) -> List[DemandRecord]:
        """
        Generate a high-stress scenario with increased demand.
        
        Useful for testing system behavior under peak load conditions.
        
        Args:
            nodes: List of (node_id, node_type) tuples
            multiplier: Demand multiplication factor
            
        Returns:
            List of high-demand records
        """
        records = []
        timestamp = time.time()
        
        for node_id, node_type in nodes:
            node_config = self.node_types[node_type]
            
            # Generate high demand
            base_demand = node_config['base_demand'] * node_config['peak_multiplier']
            stress_demand = base_demand * multiplier
            
            record = DemandRecord(
                timestamp=timestamp,
                node_id=node_id,
                demand_amps=round(stress_demand, 2),
                fulfillment=75.0  # Lower fulfillment during stress
            )
            records.append(record)
        
        return records


def create_sample_dataset() -> Tuple[List[DemandRecord], List[EnergySource]]:
    """
    Create a complete sample dataset for testing.
    
    Returns:
        Tuple of (demand_records, energy_sources)
    """
    generator = DummyDataGenerator(seed=42)
    
    # Generate 10 nodes of different types
    nodes = generator.generate_nodes(num_nodes=10)
    
    # Generate 10 seconds of data at 24Hz (240 records per node)
    records = generator.generate_demand_records(
        nodes=nodes,
        duration_seconds=10,
        frequency_hz=24
    )
    
    # Generate energy sources
    sources = generator.generate_energy_sources()
    
    print(f"Generated {len(records)} demand records from {len(nodes)} nodes")
    print(f"Generated {len(sources)} energy sources")
    
    # Print sample statistics
    node_demands = {}
    for record in records:
        if record.node_id not in node_demands:
            node_demands[record.node_id] = []
        node_demands[record.node_id].append(record.demand_amps)
    
    print("\nNode demand statistics:")
    for node_id, demands in list(node_demands.items())[:3]:  # Show first 3 nodes
        print(f"  {node_id}: mean={np.mean(demands):.1f}A, "
              f"max={np.max(demands):.1f}A, min={np.min(demands):.1f}A")
    
    print("\nEnergy source characteristics:")
    for source in sources:
        print(f"  {source.id}: max={source.max_supply_amps}A, "
              f"cost=${source.cost_per_amp:.2f}/A, "
              f"ramp={'∞' if source.ramp_limit_amps is None else f'{source.ramp_limit_amps}A/epoch'}")
    
    return records, sources


if __name__ == "__main__":
    # Generate and display sample data
    records, sources = create_sample_dataset()
