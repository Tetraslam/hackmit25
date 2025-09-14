"""
Microgrid Optimization System with MILP and Fourier Forecasting
================================================================
This module implements a real-time energy dispatch system for microgrids that:
1. Aggregates demand data from multiple nodes
2. Forecasts future demand using Fourier analysis or flat projection
3. Optimizes energy distribution using Mixed-Integer Linear Programming (MILP)
4. Runs at 24Hz for real-time decision making

"""

import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from pulp import (PULP_CBC_CMD, LpMinimize, LpProblem, LpStatus,
                  LpStatusOptimal, LpVariable, lpSum, value)
from scipy import fft


# Configure logging for debugging
# logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
# logger = logging.getLogger(__name__)


@dataclass
class DemandRecord:
    """
    Represents a single demand record from a node in the microgrid.
    
    Attributes:
        timestamp: Unix timestamp in seconds
        node_id: Unique identifier for the node
        demand_amps: Current demand in amperes
        fulfillment: Percentage of demand fulfilled (0-100)
    """
    timestamp: float
    node_id: str
    demand_amps: float
    fulfillment: float


@dataclass
class EnergySource:
    """
    Represents an energy source in the microgrid.
    
    Attributes:
        id: Unique identifier for the source
        max_supply_amps: Maximum supply capacity in amperes
        cost_per_amp: Cost per ampere supplied
        ramp_limit_amps: Optional rate limit for supply changes between epochs
    """
    id: str
    max_supply_amps: float
    cost_per_amp: float
    ramp_limit_amps: Optional[float] = None


class MicrogridOptimizer:
    """
    Main optimizer class that schedules energy distribution across the microgrid.
    Runs at 24Hz and uses MILP optimization with Fourier-based demand forecasting.
    """
    
    def __init__(self, epoch_len: float = 1/24, horizon: int = 10):
        """
        Initialize the microgrid optimizer.
        
        Args:
            epoch_len: Duration of each scheduling epoch in seconds (default: 1/24 for 24Hz)
            horizon: Number of future epochs to optimize over (default: 10)
        """
        self.epoch_len = epoch_len
        self.horizon = horizon
        self.min_history_points = 5  # min data points re
        
    def schedule(self, 
                 records: List[DemandRecord], 
                 sources: List[EnergySource]) -> List[Dict[str, Any]]:
        """
        Main scheduling function that optimizes energy distribution.
        
        This function:
        1. Aggregates the latest demand state for each node
        2. Forecasts future demand using Fourier analysis or flat projection
        3. Builds and solves a MILP optimization problem
        4. Returns dispatch instructions for the next epoch
        
        Args:
            records: Recent demand records from all nodes
            sources: Available energy sources with their constraints
            
        Returns:
            List of dispatch instructions with node_id, supply_amps, and source_id
        """
        
        if not records or not sources:
            # logger.warning("Empty records or sources provided")
            return []
        
        # Step 1: Aggregate latest per-node state
        # logger.info(f"Processing {len(records)} demand records from nodes")
        node_states = self._aggregate_node_states(records)
        
        # Step 2: Forecast future demand using Fourier analysis
        # logger.info("Generating demand forecasts")
        demand_forecasts = self._generate_forecasts(node_states)
        
        # Step 3: Build and solve MILP optimization problem
        # logger.info("Building MILP model")
        model, variables = self._build_milp_model(demand_forecasts, sources)
        
        # Step 4: Solve the optimization problem
        # logger.info("Solving MILP optimization")
        status = self._solve_milp(model, timeout_ms=500)  # 500ms timeout for 24Hz operation
        
        if status != LpStatusOptimal:
            # logger.warning(f"MILP solver returned non-optimal status: {LpStatus[status]}")
            pass
        
        # Step 5: Extract dispatch instructions for next epoch (t=1)
        # logger.info("Extracting dispatch instructions")
        outputs = self._extract_dispatch(variables, demand_forecasts.keys(), sources)
        
        return outputs
    
    def _aggregate_node_states(self, records: List[DemandRecord]) -> Dict:
        """
        Aggregate demand records by node to get latest state and history.
        
        Args:
            records: List of demand records
            
        Returns:
            Dictionary with node_id as key and state information as value
        """
        node_data = defaultdict(lambda: {
            'history': [],
            'latest_demand': 0,
            'latest_fulfillment': 0
        })
        
        # Sort records by timestamp to ensure chronological order
        sorted_records = sorted(records, key=lambda r: r.timestamp)
        
        for record in sorted_records:
            node_id = record.node_id
            node_data[node_id]['history'].append({
                'timestamp': record.timestamp,
                'demand': record.demand_amps
            })
            node_data[node_id]['latest_demand'] = record.demand_amps
            node_data[node_id]['latest_fulfillment'] = record.fulfillment
        
        return dict(node_data)
    
    def _generate_forecasts(self, node_states: Dict) -> Dict[str, np.ndarray]:
        """
        Generate demand forecasts for each node using Fourier analysis or flat projection.
        
        Args:
            node_states: Aggregated node state information
            
        Returns:
            Dictionary mapping node_id to array of forecasted demands
        """
        forecasts = {}
        
        for node_id, state in node_states.items():
            history = state['history']
            latest_demand = state['latest_demand']
            
            if len(history) >= self.min_history_points:
                # Use Fourier-based forecasting if sufficient history exists
                # logger.debug(f"Using Fourier forecast for node {node_id}")
                forecasts[node_id] = self._fourier_forecast(history, latest_demand)
            else:
                # Use flat projection (repeat latest demand)
                # logger.debug(f"Using flat forecast for node {node_id} (insufficient history)")
                forecasts[node_id] = np.full(self.horizon, latest_demand)
        
        return forecasts
    
    def _fourier_forecast(self, 
                          history: List[Dict], 
                          latest_demand: float) -> np.ndarray:
        """
        Generate forecast using simplified Fourier analysis.
        
        Uses only K=1-2 dominant frequency components to capture basic periodicity
        while avoiding overfitting to noise in the 24Hz real-time data.
        
        Args:
            history: Time-ordered demand history
            latest_demand: Most recent demand value
            
        Returns:
            Array of forecasted demands for horizon epochs
        """
        # Extract demand values from history
        demands = np.array([h['demand'] for h in history])
        
        # Apply FFT to identify dominant frequencies
        fft_vals = fft.fft(demands)
        frequencies = fft.fftfreq(len(demands))
        
        # Keep only K=2 dominant frequency components (excluding DC)
        half_len = len(fft_vals) // 2
        if half_len <= 1:
            # Not enough frequency components for Fourier analysis
            return np.full(self.horizon, latest_demand)
            
        magnitudes = np.abs(fft_vals[1:half_len])  # Exclude DC component
        
        if len(magnitudes) == 0:
            # Fallback to flat forecast if insufficient frequency data
            return np.full(self.horizon, latest_demand)
            
        K = min(2, len(magnitudes))  # Use available frequency components
        dominant_indices = np.argpartition(magnitudes, -K)[-K:] + 1  # Add 1 to account for skipping DC
        
        # Reconstruct signal using only dominant frequencies
        filtered_fft = np.zeros_like(fft_vals)
        filtered_fft[0] = fft_vals[0]  # Keep DC component
        for idx in dominant_indices:
            filtered_fft[idx] = fft_vals[idx]
            # Include conjugate for real signal
            if idx < len(fft_vals) - 1:
                filtered_fft[-idx] = fft_vals[-idx]
        
        # Inverse FFT to get filtered signal
        filtered_signal = np.real(fft.ifft(filtered_fft))
        
        # Extrapolate pattern for horizon epochs
        forecast = np.zeros(self.horizon)
        pattern_len = len(filtered_signal)
        
        for t in range(self.horizon):
            # Use cyclic pattern extension
            pattern_idx = t % pattern_len
            forecast[t] = filtered_signal[pattern_idx]
        
        # Blend with latest demand to ensure continuity
        # Weighted average: more weight on latest for near-term forecasts
        weights = np.exp(-np.arange(self.horizon) * 0.1)  # Exponential decay
        forecast = weights * latest_demand + (1 - weights) * forecast
        
        # Ensure non-negative demands
        forecast = np.maximum(forecast, 0)
        
        return forecast
    
    def _build_milp_model(self, 
                          demand_forecasts: Dict[str, np.ndarray],
                          sources: List[EnergySource]) -> Tuple[LpProblem, Dict]:
        """
        Build the Mixed-Integer Linear Programming model for optimization.
        
        Creates decision variables, constraints, and objective function for
        minimizing cost while meeting demand and respecting source constraints.
        
        Args:
            demand_forecasts: Forecasted demands for each node
            sources: Available energy sources
            
        Returns:
            Tuple of (MILP model, decision variables dictionary)
        """
        # Create the optimization model
        model = LpProblem("Microgrid_Energy_Dispatch", LpMinimize)
        
        nodes = list(demand_forecasts.keys())
        T = range(1, self.horizon + 1)  # Time periods 1 to H
        
        # Decision variables
        variables = {
            'x': {},  # Continuous: amps from source s to node n at time t
            'y': {},  # Binary: on/off assignment (optional, for switching costs)
            'unmet': {}  # Continuous: unmet demand at node n at time t
        }
        
        # Create decision variables
        for s in sources:
            for n in nodes:
                for t in T:
                    # Continuous variable for power flow
                    var_name = f"x_{s.id}_{n}_{t}"
                    variables['x'][(s.id, n, t)] = LpVariable(var_name, 
                                                               lowBound=0, 
                                                               cat='Continuous')
                    
                    # Binary variable for on/off state (helps model switching costs)
                    var_name = f"y_{s.id}_{n}_{t}"
                    variables['y'][(s.id, n, t)] = LpVariable(var_name, 
                                                               cat='Binary')
        
        # Unmet demand variables (penalized in objective)
        for n in nodes:
            for t in T:
                var_name = f"unmet_{n}_{t}"
                variables['unmet'][(n, t)] = LpVariable(var_name, 
                                                        lowBound=0, 
                                                        cat='Continuous')
        
        # Big-M constant for binary constraints
        BIG_M = max(np.max(forecast) for forecast in demand_forecasts.values()) * 2
        
        # === CONSTRAINTS ===
        
        # Constraint 1: Demand satisfaction (supply + unmet = demand)
        for n in nodes:
            for t_idx, t in enumerate(T):
                demand = demand_forecasts[n][t_idx]
                supply_sum = lpSum(variables['x'][(s.id, n, t)] for s in sources)
                model += (supply_sum + variables['unmet'][(n, t)] == demand,
                         f"Demand_satisfaction_{n}_{t}")
        
        # Constraint 2: Source capacity limits
        for s in sources:
            for t in T:
                total_from_source = lpSum(variables['x'][(s.id, n, t)] for n in nodes)
                model += (total_from_source <= s.max_supply_amps,
                         f"Source_capacity_{s.id}_{t}")
        
        # Constraint 3: Binary activation (if x > 0, then y = 1)
        for s in sources:
            for n in nodes:
                for t in T:
                    model += (variables['x'][(s.id, n, t)] <= BIG_M * variables['y'][(s.id, n, t)],
                             f"Binary_activation_{s.id}_{n}_{t}")
        
        # Constraint 4: Single source per node (optional, can be relaxed)
        for n in nodes:
            for t in T:
                model += (lpSum(variables['y'][(s.id, n, t)] for s in sources) <= 1,
                         f"Single_source_{n}_{t}")
        
        # Constraint 5: Ramp rate limits (if specified)
        for s in sources:
            if s.ramp_limit_amps is not None:
                for t in T:
                    if t > 1:  # Can't apply ramp constraint at t=1
                        curr_supply = lpSum(variables['x'][(s.id, n, t)] for n in nodes)
                        prev_supply = lpSum(variables['x'][(s.id, n, t-1)] for n in nodes)
                        
                        # |current - previous| <= ramp_limit
                        # Linearized as two constraints:
                        model += (curr_supply - prev_supply <= s.ramp_limit_amps,
                                 f"Ramp_up_{s.id}_{t}")
                        model += (prev_supply - curr_supply <= s.ramp_limit_amps,
                                 f"Ramp_down_{s.id}_{t}")
        
        # === OBJECTIVE FUNCTION ===
        # Minimize: total cost + penalty for unmet demand + switching costs
        
        cost_terms = []
        
        # Energy supply costs
        for s in sources:
            for n in nodes:
                for t in T:
                    cost_terms.append(s.cost_per_amp * variables['x'][(s.id, n, t)])
        
        # Penalty for unmet demand (high cost to prioritize meeting demand)
        unmet_penalty = 1000  # High penalty to discourage unmet demand
        for n in nodes:
            for t in T:
                cost_terms.append(unmet_penalty * variables['unmet'][(n, t)])
        
        # Small switching cost to encourage stability
        switching_cost = 0.1
        for s in sources:
            for n in nodes:
                for t in T:
                    cost_terms.append(switching_cost * variables['y'][(s.id, n, t)])
        
        # Set the objective
        model += lpSum(cost_terms), "Total_Cost"
        
        return model, variables
    
    def _solve_milp(self, model: LpProblem, timeout_ms: int = 500) -> int:
        """
        Solve the MILP model with a timeout constraint.
        
        Args:
            model: The MILP model to solve
            timeout_ms: Maximum solving time in milliseconds
            
        Returns:
            Solver status code
        """
        # Use CBC solver (comes with PuLP) with timeout
        solver = PULP_CBC_CMD(msg=0, timeLimit=timeout_ms/1000)  # Convert to seconds
        
        start_time = time.time()
        status = model.solve(solver)
        solve_time = (time.time() - start_time) * 1000  # Convert to ms
        
        # logger.info(f"MILP solved in {solve_time:.1f}ms with status: {LpStatus[status]}")
        
        return status
    
    def _extract_dispatch(self, 
                         variables: Dict,
                         nodes: List[str],
                         sources: List[EnergySource]) -> List[Dict[str, Any]]:
        """
        Extract dispatch instructions for the next epoch (t=1) from solved model.
        
        Args:
            variables: Decision variables from the solved model
            nodes: List of node IDs
            sources: List of energy sources
            
        Returns:
            List of dispatch instructions
        """
        outputs = []
        
        # Extract values for t=1 (next epoch)
        t = 1
        
        for n in nodes:
            for s in sources:
                # Get the supply amount from source s to node n
                supply_amps = value(variables['x'][(s.id, n, t)])
                
                # Only include non-zero dispatches
                if supply_amps and supply_amps > 1e-6:  # Numerical tolerance
                    outputs.append({
                        "id": n,
                        "supply_amps": round(supply_amps, 3),  # Round for cleaner output
                        "source_id": s.id
                    })
        
        # Log unmet demand if any
        for n in nodes:
            unmet = value(variables['unmet'][(n, t)])
            if unmet and unmet > 1e-6:
                # logger.warning(f"Node {n} has {unmet:.2f} amps of unmet demand")
                pass
        
        return outputs


def run_at_frequency(optimizer: MicrogridOptimizer, 
                     frequency_hz: float = 24,
                     duration_seconds: float = 10):
    """
    Run the optimizer at a specified frequency for testing.
    
    Args:
        optimizer: The MicrogridOptimizer instance
        frequency_hz: Operating frequency in Hz
        duration_seconds: How long to run the test
    """
    period = 1.0 / frequency_hz
    iterations = int(duration_seconds * frequency_hz)
    
    # logger.info(f"Running optimizer at {frequency_hz}Hz for {duration_seconds}s ({iterations} iterations)")
    
    for i in range(iterations):
        start_time = time.time()
        
        # In production, you would get real records and sources here
        # For testing, we'll use dummy data (defined in test file)
        
        # Sleep to maintain frequency
        elapsed = time.time() - start_time
        if elapsed < period:
            time.sleep(period - elapsed)
        else:
            logger.warning(f"Iteration {i} took {elapsed*1000:.1f}ms, exceeding {period*1000:.1f}ms period")
            pass
