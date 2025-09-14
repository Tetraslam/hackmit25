#!/usr/bin/env python3
"""
Simple Demo for Microgrid Optimizer
===================================
Run the microgrid optimization system without WebSocket dependencies.
"""

import sys
import time
import numpy as np
from microgrid_optimizer import MicrogridOptimizer, DemandRecord
from dummy_data_generator import DummyDataGenerator, create_sample_dataset


def run_demo():
    """
    Run a quick demonstration of the microgrid optimizer with dummy data.
    
    This shows:
    - Data generation
    - Single optimization cycle
    - Dispatch results
    """
    print("=" * 70)
    print(" MICROGRID OPTIMIZER DEMO ")
    print("=" * 70)
    
    # Generate sample data
    print("\n1. Generating dummy data...")
    records, sources = create_sample_dataset()
    
    # Create optimizer
    print("\n2. Initializing optimizer (24Hz, 10-epoch horizon)...")
    optimizer = MicrogridOptimizer(epoch_len=1/24, horizon=10)
    
    # Run single optimization
    print("\n3. Running optimization...")
    dispatch = optimizer.schedule(records[-240:], sources)  # Use last 10 seconds of data
    
    # Display results
    print("\n4. DISPATCH RESULTS:")
    print(f"   Generated {len(dispatch)} dispatch instructions\n")
    
    # Group by node for clarity
    node_dispatch = {}
    for d in dispatch:
        node_id = d['id']
        if node_id not in node_dispatch:
            node_dispatch[node_id] = []
        node_dispatch[node_id].append(d)
    
    # Display dispatch for each node
    for node_id in sorted(node_dispatch.keys())[:5]:  # Show first 5 nodes
        print(f"   {node_id}:")
        for d in node_dispatch[node_id]:
            print(f"     • {d['supply_amps']:.1f}A from {d['source_id']}")
    
    if len(node_dispatch) > 5:
        print(f"   ... and {len(node_dispatch) - 5} more nodes")
    
    # Calculate totals
    total_dispatched = sum(d['supply_amps'] for d in dispatch)
    sources_used = set(d['source_id'] for d in dispatch)
    
    print(f"\n   SUMMARY:")
    print(f"   • Total power dispatched: {total_dispatched:.1f}A")
    print(f"   • Sources utilized: {', '.join(sources_used)}")
    print(f"   • Nodes served: {len(node_dispatch)}")
    
    print("\n" + "=" * 70)
    print(" DEMO COMPLETED ")
    print("=" * 70)


def run_realtime_simulation():
    """
    Run the optimizer in real-time mode at 24Hz with continuous data generation.
    """
    print("=" * 70)
    print(" REAL-TIME SIMULATION MODE (24Hz) ")
    print("=" * 70)
    print("\nPress Ctrl+C to stop the simulation\n")
    
    # Initialize components
    generator = DummyDataGenerator(seed=42)
    optimizer = MicrogridOptimizer(epoch_len=1/24, horizon=10)
    
    # Generate initial configuration
    nodes = generator.generate_nodes(num_nodes=10)
    sources = generator.generate_energy_sources()
    
    # Display configuration
    print(f"Configuration:")
    print(f"  • Nodes: {len(nodes)}")
    print(f"  • Sources: {len(sources)}")
    print(f"  • Frequency: 24Hz")
    print(f"  • Horizon: 10 epochs\n")
    
    # Sliding window for historical data
    historical_records = []
    window_size = 240  # 10 seconds at 24Hz
    
    frequency_hz = 24
    period = 1.0 / frequency_hz
    iteration = 0
    
    try:
        while True:
            iteration_start = time.time()
            iteration += 1
            
            # Generate new demand data (simulating real-time stream)
            current_time = iteration_start
            new_records = []
            
            for node_id, node_type in nodes:
                # Generate realistic demand based on time and node type
                node_config = generator.node_types[node_type]
                hour_of_day = (int(current_time) // 3600) % 24
                
                if hour_of_day in node_config['peak_hours']:
                    base = node_config['base_demand'] * node_config['peak_multiplier']
                else:
                    base = node_config['base_demand']
                
                # Add temporal variation
                demand = base * (1 + 0.2 * np.sin(2 * np.pi * iteration / (24 * 60)))  # 1-minute cycle
                demand += np.random.normal(0, 0.1 * base)
                demand = max(0, demand)
                
                record = DemandRecord(
                    timestamp=current_time,
                    node_id=node_id,
                    demand_amps=round(demand, 2),
                    fulfillment=95.0
                )
                new_records.append(record)
            
            # Update historical data (sliding window)
            historical_records.extend(new_records)
            if len(historical_records) > window_size * len(nodes):
                historical_records = historical_records[-(window_size * len(nodes)):]
            
            # Modify source capacities (simulate renewable variability)
            time_factor = (iteration % (24 * 60)) / (24 * 60)  # Daily cycle
            current_sources = generator.generate_variable_source_capacity(sources, time_factor)
            
            # Run optimization
            opt_start = time.time()
            try:
                dispatch = optimizer.schedule(historical_records, current_sources)
                opt_time = (time.time() - opt_start) * 1000
                
                # Display results every second (24 iterations)
                if iteration % 24 == 0:
                    total_dispatched = sum(d['supply_amps'] for d in dispatch)
                    sources_used = len(set(d['source_id'] for d in dispatch))
                    nodes_served = len(set(d['id'] for d in dispatch))
                    
                    print(f"[{iteration//24:3d}s] Dispatch: {total_dispatched:6.1f}A | "
                               f"Sources: {sources_used} | Nodes: {nodes_served:2d} | "
                               f"Opt: {opt_time:5.1f}ms")
                
            except Exception as e:
                print(f"Optimization failed: {str(e)}")
            
            # Maintain 24Hz frequency
            elapsed = time.time() - iteration_start
            if elapsed < period:
                time.sleep(period - elapsed)
            
    except KeyboardInterrupt:
        print(f"\n\nSimulation stopped after {iteration} iterations ({iteration/24:.1f} seconds)")
        print("=" * 70)


def main():
    """
    Main entry point for the microgrid optimization system.
    """
    # Parse command line arguments
    if len(sys.argv) > 1:
        mode = sys.argv[1].lower()
    else:
        mode = "demo"
    
    print("\n" + "=" * 70)
    print(" MICROGRID OPTIMIZATION SYSTEM ")
    print(" Real-time Energy Dispatch at 24Hz ")
    print("=" * 70 + "\n")
    
    if mode == "test":
        # Run integration tests
        print("Running integration tests...\n")
        from integration_test import IntegrationTest
        test_suite = IntegrationTest()
        test_suite.run_all_tests()
        
    elif mode == "realtime":
        # Run real-time simulation
        print("Starting real-time simulation...\n")
        run_realtime_simulation()
        
    else:  # demo mode (default)
        # Run demonstration
        print("Running demonstration...\n")
        run_demo()
    
    print("\nProgram completed successfully.")


if __name__ == "__main__":
    main()
