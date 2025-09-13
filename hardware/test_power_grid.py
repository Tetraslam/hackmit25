#!/usr/bin/env python3
import asyncio
import websockets
import requests
import json
import math
import time

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

        # Send control command at 24 hz as sine wave
        for i in range(1):
            # supply = math.sin(i * 0.1) * .5 + .6
            supply = 0.1
            control_msg = json.dumps({"nodes": [{"id": 26, "supply": supply, "source": 1}]})
            await websocket.send(control_msg)
            # time.sleep(0.10)

if __name__ == "__main__":
    asyncio.run(test_power_grid())
