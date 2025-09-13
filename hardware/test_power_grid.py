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


async def test_out_endpoint_only(esp_ip):
    """Test only the /out endpoint to receive telemetry data."""
    out_uri = f"ws://{esp_ip}/out"
    print(f"\n--- Testing /out endpoint only ---")
    print(f"Connecting to: {out_uri}")

    try:
        # Simple connection with minimal configuration
        async with websockets.connect(out_uri) as websocket:
            print("✓ Connected to ESP32 /out endpoint")

            # Just receive telemetry data
            print("Waiting for telemetry data...")
            data = await websocket.recv()

            if isinstance(data, bytes):
                packet = BinaryProtocol.decode_telemetry(data)
                if packet:
                    print(f"✓ Received binary telemetry: {len(data)} bytes")
                    print(f"  Timestamp: {packet.timestamp}")
                    for node in packet.nodes:
                        node_type = "consumer" if node.type == 1 else "power"
                        print(f"  Node {node.id} ({node_type}): demand={node.demand:.2f}A, ff={node.fulfillment:.1f}%")
                else:
                    print(f"✗ Invalid binary data: {len(data)} bytes")
            else:
                print(f"✗ Received text data (unexpected): {data}")

    except Exception as e:
        print(f"✗ Error testing /out endpoint: {e}")

async def test_in_endpoint_with_simple_connect(esp_ip):
    """Test /in endpoint with a very simple connection approach."""
    in_uri = f"ws://{esp_ip}/in"
    print(f"\n--- Testing /in endpoint (simple) ---")
    print(f"Connecting to: {in_uri}")

    try:
        # Connect with very simple settings
        websocket = await websockets.connect(in_uri, ping_interval=None)
        print("✓ Connected to ESP32 /in endpoint")

        # Send just one command to test
        print("Sending single test command...")
        dispatch = DispatchPacket(nodes=[
            DispatchNode(id=2, supply=1.0, source=1),
        ])

        binary_command = BinaryProtocol.encode_dispatch(dispatch)
        print(f"Command size: {len(binary_command)} bytes")

        await websocket.send(binary_command)
        print("✓ Command sent successfully")

        # Wait a bit then close cleanly
        await asyncio.sleep(1.0)
        await websocket.close()
        print("✓ Connection closed cleanly")

    except Exception as e:
        print(f"✗ Error testing /in endpoint: {e}")

async def test_power_grid():
    # Get ESP IP
    response = requests.get('http://kv.wfeng.dev/hackmit25:ip')
    esp_ip = response.text.strip()
    print(f"ESP32 IP: {esp_ip}")

    # Test /out endpoint first (should work fine)
    await test_out_endpoint_only(esp_ip)

    # Wait between tests
    await asyncio.sleep(2.0)

    # Test /in endpoint with simpler approach
    await test_in_endpoint_with_simple_connect(esp_ip)

if __name__ == "__main__":
    asyncio.run(test_power_grid())
