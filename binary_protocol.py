"""
Binary Protocol for Griddy ESP32 ↔ Backend Communication
========================================================
Efficient binary format for 24Hz real-time telemetry and dispatch.

Protocol Design:
- Little-endian byte order (ESP32 native)
- Fixed-size structures for parsing efficiency
- Minimal overhead for high-frequency transmission
- Type-safe with struct packing

Telemetry Format (ESP32 → Backend):
  Header: 4 bytes
    - Magic: 0x47524944 ("GRID")
  Timestamp: 4 bytes (uint32, milliseconds)
  Node Count: 1 byte (uint8)
  Nodes: Variable length
    Each node: 9 bytes
      - ID: 1 byte (uint8)
      - Type: 1 byte (0=power, 1=consumer)
      - Demand: 4 bytes (float32, amps)
      - Fulfillment: 4 bytes (float32, percentage)

Dispatch Format (Backend → ESP32):
  Header: 4 bytes
    - Magic: 0x44495350 ("DISP")
  Node Count: 1 byte (uint8)
  Nodes: Variable length
    Each node: 6 bytes
      - ID: 1 byte (uint8)
      - Supply: 4 bytes (float32, 0.0-1.0 normalized)
      - Source: 1 byte (uint8, source ID)

Total sizes:
- Telemetry: 9 + (9 * node_count) bytes
- Dispatch: 9 + (6 * node_count) bytes
- For 6 nodes: Telemetry=63 bytes, Dispatch=45 bytes
- JSON equivalent: ~200-300 bytes each

Author: HackMIT 2025 Team
"""

import struct
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

# Protocol constants
TELEMETRY_MAGIC = 0x47524944  # "GRID"
DISPATCH_MAGIC = 0x44495350   # "DISP"

# Node types
NODE_TYPE_POWER = 0
NODE_TYPE_CONSUMER = 1

@dataclass
class TelemetryNode:
    """Single node telemetry data."""
    id: int
    type: int  # 0=power, 1=consumer
    demand: float  # Amps
    fulfillment: float  # Percentage

@dataclass
class TelemetryPacket:
    """Complete telemetry packet from ESP32."""
    timestamp: int  # Milliseconds
    nodes: List[TelemetryNode]

@dataclass
class DispatchNode:
    """Single node dispatch command."""
    id: int
    supply: float  # 0.0-1.0 normalized for PWM
    source: int  # Source ID

@dataclass
class DispatchPacket:
    """Complete dispatch packet to ESP32."""
    nodes: List[DispatchNode]

class BinaryProtocol:
    """Binary protocol encoder/decoder for ESP32 ↔ Backend communication."""
    
    @staticmethod
    def encode_telemetry(packet: TelemetryPacket) -> bytes:
        """
        Encode telemetry packet to binary format.
        
        Args:
            packet: TelemetryPacket to encode
            
        Returns:
            Binary data ready for WebSocket transmission
        """
        data = bytearray()
        
        # Header: Magic (4 bytes)
        data.extend(struct.pack('<I', TELEMETRY_MAGIC))
        
        # Timestamp (4 bytes)
        data.extend(struct.pack('<I', packet.timestamp))
        
        # Node count (1 byte)
        data.extend(struct.pack('<B', len(packet.nodes)))
        
        # Nodes (9 bytes each)
        for node in packet.nodes:
            data.extend(struct.pack('<B', node.id))        # ID (1 byte)
            data.extend(struct.pack('<B', node.type))      # Type (1 byte)
            data.extend(struct.pack('<f', node.demand))    # Demand (4 bytes)
            data.extend(struct.pack('<f', node.fulfillment))  # Fulfillment (4 bytes)
        
        return bytes(data)
    
    @staticmethod
    def decode_telemetry(data: bytes) -> Optional[TelemetryPacket]:
        """
        Decode binary telemetry data from ESP32.
        
        Args:
            data: Binary data from WebSocket
            
        Returns:
            TelemetryPacket or None if invalid
        """
        if len(data) < 9:  # Minimum: header + timestamp + count
            return None
        
        try:
            offset = 0
            
            # Check magic
            magic, = struct.unpack('<I', data[offset:offset+4])
            offset += 4
            if magic != TELEMETRY_MAGIC:
                return None
            
            # Timestamp
            timestamp, = struct.unpack('<I', data[offset:offset+4])
            offset += 4
            
            # Node count
            node_count, = struct.unpack('<B', data[offset:offset+1])
            offset += 1
            
            # ESP32 C struct has padding - actual node size is 10 bytes, not 9
            expected_len = 9 + (node_count * 10)  # Account for 1-byte padding per node
            if len(data) != expected_len:
                return None
            
            # Parse nodes with padding
            nodes = []
            for i in range(node_count):
                node_id, = struct.unpack('<B', data[offset:offset+1])
                offset += 1
                
                node_type, = struct.unpack('<B', data[offset:offset+1])
                offset += 1
                
                # Skip 1 byte of padding due to C struct alignment
                offset += 1
                
                demand, = struct.unpack('<f', data[offset:offset+4])
                offset += 4
                
                fulfillment, = struct.unpack('<f', data[offset:offset+4])
                offset += 4
                
                nodes.append(TelemetryNode(
                    id=node_id,
                    type=node_type,
                    demand=demand,
                    fulfillment=fulfillment
                ))
            
            return TelemetryPacket(timestamp=timestamp, nodes=nodes)
            
        except struct.error as e:
            return None
    
    @staticmethod
    def encode_dispatch(packet: DispatchPacket) -> bytes:
        """
        Encode dispatch packet to binary format.
        
        Args:
            packet: DispatchPacket to encode
            
        Returns:
            Binary data ready for WebSocket transmission
        """
        data = bytearray()
        
        # Header: Magic (4 bytes)
        data.extend(struct.pack('<I', DISPATCH_MAGIC))
        
        # Node count (1 byte)
        data.extend(struct.pack('<B', len(packet.nodes)))
        
        # Nodes (6 bytes each)
        for node in packet.nodes:
            data.extend(struct.pack('<B', node.id))        # ID (1 byte)
            data.extend(struct.pack('<f', node.supply))    # Supply (4 bytes)
            data.extend(struct.pack('<B', node.source))    # Source (1 byte)
        
        return bytes(data)
    
    @staticmethod
    def decode_dispatch(data: bytes) -> Optional[DispatchPacket]:
        """
        Decode binary dispatch data.
        
        Args:
            data: Binary data
            
        Returns:
            DispatchPacket or None if invalid
        """
        if len(data) < 5:  # Minimum: header + count
            return None
        
        try:
            offset = 0
            
            # Check magic
            magic, = struct.unpack('<I', data[offset:offset+4])
            offset += 4
            if magic != DISPATCH_MAGIC:
                return None
            
            # Node count
            node_count, = struct.unpack('<B', data[offset:offset+1])
            offset += 1
            
            # Validate remaining data length
            expected_len = 5 + (node_count * 6)
            if len(data) != expected_len:
                return None
            
            # Parse nodes
            nodes = []
            for _ in range(node_count):
                node_id, = struct.unpack('<B', data[offset:offset+1])
                offset += 1
                
                supply, = struct.unpack('<f', data[offset:offset+4])
                offset += 4
                
                source, = struct.unpack('<B', data[offset:offset+1])
                offset += 1
                
                nodes.append(DispatchNode(
                    id=node_id,
                    supply=supply,
                    source=source
                ))
            
            return DispatchPacket(nodes=nodes)
            
        except struct.error:
            return None

    @staticmethod
    def telemetry_to_json_compat(packet: TelemetryPacket) -> Dict[str, Any]:
        """Convert binary telemetry to JSON-compatible format for existing code."""
        return {
            "timestamp": packet.timestamp,
            "nodes": [
                {
                    "id": node.id,
                    "type": "consumer" if node.type == NODE_TYPE_CONSUMER else "power",
                    "demand": node.demand,
                    "ff": node.fulfillment
                }
                for node in packet.nodes
            ]
        }
    
    @staticmethod
    def json_to_dispatch_compat(json_data: Dict[str, Any]) -> DispatchPacket:
        """Convert JSON-compatible format to binary dispatch packet."""
        nodes = []
        for node_data in json_data.get("nodes", []):
            nodes.append(DispatchNode(
                id=int(node_data["id"]),
                supply=float(node_data["supply"]),
                source=int(node_data["source"])
            ))
        return DispatchPacket(nodes=nodes)

# Test functions for validation
def test_protocol():
    """Test binary protocol encoding/decoding."""
    print("Testing Griddy Binary Protocol...")
    
    # Test telemetry
    telemetry = TelemetryPacket(
        timestamp=1234567890,
        nodes=[
            TelemetryNode(id=1, type=NODE_TYPE_POWER, demand=0.0, fulfillment=95.5),
            TelemetryNode(id=2, type=NODE_TYPE_CONSUMER, demand=2.5, fulfillment=88.2),
            TelemetryNode(id=3, type=NODE_TYPE_CONSUMER, demand=1.8, fulfillment=92.1),
        ]
    )
    
    # Encode and decode
    encoded = BinaryProtocol.encode_telemetry(telemetry)
    decoded = BinaryProtocol.decode_telemetry(encoded)
    
    print(f"Telemetry: {len(encoded)} bytes (vs ~150 JSON bytes)")
    print(f"Original: {telemetry}")
    print(f"Decoded:  {decoded}")
    print(f"Match: {telemetry == decoded}")
    print()
    
    # Test dispatch
    dispatch = DispatchPacket(
        nodes=[
            DispatchNode(id=2, supply=0.65, source=1),
            DispatchNode(id=3, supply=0.42, source=1),
        ]
    )
    
    # Encode and decode
    encoded = BinaryProtocol.encode_dispatch(dispatch)
    decoded = BinaryProtocol.decode_dispatch(encoded)
    
    print(f"Dispatch: {len(encoded)} bytes (vs ~80 JSON bytes)")
    print(f"Original: {dispatch}")
    print(f"Decoded:  {decoded}")
    print(f"Match: {dispatch == decoded}")

if __name__ == "__main__":
    test_protocol()
