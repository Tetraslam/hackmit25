#!/usr/bin/env python3
import asyncio
import json
import math
import os
import sys
import time

import requests
import websockets

# Import binary protocol from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from binary_protocol import BinaryProtocol, DispatchNode, DispatchPacket


async def test_power_grid():
    # Get ESP IP
    response = requests.get('http://kv.wfeng.dev/hackmit25:ip')
    esp_ip = response.text.strip()

    uri = f"ws://{esp_ip}/ws"

    async with websockets.connect(uri) as websocket:
        print("Connected to ESP32 via binary protocol")

        # Wait for binary telemetry data
        data = await websocket.recv()
        
        if isinstance(data, bytes):
            packet = BinaryProtocol.decode_telemetry(data)
            if packet:
                print(f"Received binary telemetry: {len(data)} bytes")
                print(f"Timestamp: {packet.timestamp}")
                for node in packet.nodes:
                    node_type = "consumer" if node.type == 1 else "power"
                    print(f"  Node {node.id} ({node_type}): demand={node.demand:.2f}A, ff={node.fulfillment:.1f}%")
            else:
                print(f"Invalid binary data: {len(data)} bytes")
        else:
            print("Received text data (legacy):", data)

        # Send binary control command
        dispatch = DispatchPacket(nodes=[
            DispatchNode(id=3, supply=0.8, source=1),  # 80% supply to node 3
            DispatchNode(id=4, supply=0.6, source=1),  # 60% supply to node 4
        ])
        
        binary_command = BinaryProtocol.encode_dispatch(dispatch)
        await websocket.send(binary_command)
        print(f"Sent binary dispatch: {len(binary_command)} bytes (vs ~80 JSON bytes)")

if __name__ == "__main__":
    asyncio.run(test_power_grid())
