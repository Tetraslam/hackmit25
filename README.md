# griddy

## Hardware

Connect to the WebSocket server (its IP address is published to http://kv.wfeng.dev/hackmit25:ip). e.g. connect to
```
ws://10.31.182.234/ws
```
The server will send readings at 24 Hz as JSON, which looks like
```json
{
    "timestamp":21199,
    "nodes":[
        { "id": 1, "type": "power", "demand": 0, "ff": 0.8463 },
        { "id": 2, "type": "power", "demand": 0, "ff": 0.8124 },
        { "id": 3, "type": "consumer", "demand": 0.8682, "ff": 0.7358 },
        { "id": 4, "type": "consumer", "demand": 1.5521, "ff": 0.7964 },
        { "id": 5, "type": "consumer", "demand": 2.407, "ff": 0.8701 },
        { "id": 6, "type": "power", "demand": 0, "ff": 0.8926 }
    ]
}
```

To send a control command, send a JSON object of the form
```json
{
    "nodes": [
        { "id": 27, "supply": 1.0, "source": 1 }
    ]
}
```
