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

        while True:
            message = await websocket.recv()
            data = json.loads(message)
            print(f"Timestamp: {data['timestamp']}, Nodes: {len(data['nodes'])}")

if __name__ == "__main__":
    asyncio.run(test_power_grid())