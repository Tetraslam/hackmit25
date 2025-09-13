#!/usr/bin/env python3
import asyncio
import json
import math
import os
import sys
import time

import requests
import websockets
from websockets.client import WebSocketClientProtocol

# Import binary protocol from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from binary_protocol import BinaryProtocol, DispatchNode, DispatchPacket

# CONFIGURATION - Easy toggles for testing
USE_SLOW_MODE = True  # Set to False to revert to fast mode (24Hz)
ENABLE_LOGGING = False # Set to True to enable detailed logs
ENABLE_SENDING = True  # Set to False to disable sending (receive only)

SLOW_INTERVAL = 0.5  # 0.5 second intervals (2Hz)
FAST_INTERVAL = 1/24   # 24Hz intervals (~41.67ms)


def log(message):
    """Conditional logging based on ENABLE_LOGGING flag."""
    if ENABLE_LOGGING:
        print(message)


async def test_out_endpoint_only(esp_ip):
    """Test only the /out endpoint to receive telemetry data."""
    out_uri = f"ws://{esp_ip}/out"
    log(f"\n--- Testing /out endpoint only ---")
    log(f"Connecting to: {out_uri}")

    try:
        # Simple connection with minimal configuration
        async with websockets.connect(out_uri) as websocket:
            log("✓ Connected to ESP32 /out endpoint")

            # Just receive telemetry data
            log("Waiting for telemetry data...")
            data = await websocket.recv()

            if isinstance(data, bytes):
                packet = BinaryProtocol.decode_telemetry(data)
                if packet:
                    log(f"✓ Received binary telemetry: {len(data)} bytes")
                    log(f"  Timestamp: {packet.timestamp}")
                    for node in packet.nodes:
                        node_type = "consumer" if node.type == 1 else "power"
                        log(f"  Node {node.id} ({node_type}): demand={node.demand:.2f}A, ff={node.fulfillment:.1f}%")
                else:
                    log(f"✗ Invalid binary data: {len(data)} bytes")
            else:
                log(f"✗ Received text data (unexpected): {data}")

    except Exception as e:
        log(f"✗ Error testing /out endpoint: {e}")

async def test_in_endpoint_with_simple_connect(esp_ip):
    """Test /in endpoint with configurable timing and on/off toggle."""
    in_uri = f"ws://{esp_ip}/in"
    interval = SLOW_INTERVAL if USE_SLOW_MODE else FAST_INTERVAL
    mode_name = "1Hz (slow)" if USE_SLOW_MODE else "24Hz (fast)"
    
    log(f"\n--- Testing /in endpoint ({mode_name}) ---")
    log(f"Connecting to: {in_uri}")
    log(f"Send interval: {interval:.3f}s")
    log(f"Sending enabled: {ENABLE_SENDING}")

    try:
        # Connect with very simple settings
        websocket = await websockets.connect(in_uri, ping_interval=None)
        log("✓ Connected to ESP32 /in endpoint")

        if not ENABLE_SENDING:
            log("Sending disabled - connection only mode")
            log("Press Ctrl+C to stop")
            try:
                while True:
                    await asyncio.sleep(1.0)  
            except KeyboardInterrupt:
                log("\n✓ Connection test completed")
        else:
            # Send commands continuously for testing (10 second duration)
            test_duration = 10.0  # 10 seconds
            log(f"Sending commands at {mode_name} for {test_duration}s...")
            
            command_count = 0
            start_time = time.time()
            
            try:
                while True:
                    elapsed = time.time() - start_time
                    
                    # Stop after 10 seconds
                    if elapsed >= test_duration:
                        log(f"\n✓ Test completed after {test_duration}s")
                        break
                    
                    # Toggle every 0.5 seconds (matches command interval)
                    cycle_time = 0.5  # seconds per toggle (matches 2Hz sending)
                    toggle_state = int(elapsed / cycle_time) % 2
                    supply_value = 0.1 if toggle_state == 0 else 1.0  # Either 0.1 or 1.0
                    
                    dispatch = DispatchPacket(nodes=[
                        DispatchNode(id=2, supply=supply_value, source=1),
                        DispatchNode(id=3, supply=supply_value * 0.8, source=2),  # Secondary node at 80%
                    ])

                    binary_command = BinaryProtocol.encode_dispatch(dispatch)
                    
                    await websocket.send(binary_command)
                    command_count += 1
                    
                    # Log progress every 10 commands (or every command in slow mode) - only if logging enabled
                    if ENABLE_LOGGING and (USE_SLOW_MODE or command_count % 10 == 0):
                        rate = command_count / elapsed if elapsed > 0 else 0
                        log(f"  [{elapsed:4.1f}s] Sent {command_count} commands, rate: {rate:.1f} cmd/s, supply: {supply_value:.3f}A")
                    
                    # Wait for next interval
                    await asyncio.sleep(interval)
                    
            except KeyboardInterrupt:
                log(f"\n✓ Stopped after sending {command_count} commands")
        
        await websocket.close()
        log("✓ Connection closed cleanly")

    except Exception as e:
        log(f"✗ Error testing /in endpoint: {e}")

async def test_power_grid():
    # Show current configuration
    mode_name = "1Hz" if USE_SLOW_MODE else "5Hz"
    send_status = "ON" if ENABLE_SENDING else "OFF"
    log_status = "ON" if ENABLE_LOGGING else "OFF"
    
    print(f"=== Power Grid Test ===")
    print(f"Mode: {mode_name} | Sending: {send_status} | Logs: {log_status}")
    print(f"Duration: 10s | Supply: 0.1↔1.0A toggle (0.5s intervals)")
    print(f"Toggles: USE_SLOW_MODE={USE_SLOW_MODE}, ENABLE_SENDING={ENABLE_SENDING}, ENABLE_LOGGING={ENABLE_LOGGING}")
    
    # Get ESP IP
    response = requests.get('http://kv.wfeng.dev/hackmit25:ip')
    esp_ip = response.text.strip()
    print(f"ESP32 IP: {esp_ip}")

    # Skip /out endpoint test for now (receive at 24Hz later)
    # await test_out_endpoint_only(esp_ip)

    # Test /in endpoint with sending only (2Hz)
    await test_in_endpoint_with_simple_connect(esp_ip)

if __name__ == "__main__":
    asyncio.run(test_power_grid())

