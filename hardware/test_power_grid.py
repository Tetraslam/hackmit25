#!/usr/bin/env python3
import asyncio
import websockets
import requests
import json

async def test_power_grid():
    # Get ESP IP
    response = requests.get('http://kv.wfeng.dev/hackmit25:ip')
    esp_ip = response.text.strip()

    uri = f"ws://{esp_ip}/ws"

    async with websockets.connect(uri) as websocket:
        print("Connected")

        # Wait for websocket data
        data = await websocket.recv()
        print("Received data:", data)

        # Send control command
        control_msg = json.dumps({"nodes": [{"id": 27, "supply": 1.0, "source": 1}]})
        await websocket.send(control_msg)
        print("Sent control command")

if __name__ == "__main__":
    asyncio.run(test_power_grid())
    