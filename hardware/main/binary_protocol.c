#include "binary_protocol.h"
#include <string.h>

size_t encode_telemetry(const telemetry_packet_t *packet, uint8_t *buffer)
{
    if (!packet || !buffer) {
        return 0;
    }
    
    size_t offset = 0;
    
    // Magic (4 bytes, little-endian)
    uint32_t magic = TELEMETRY_MAGIC;
    memcpy(buffer + offset, &magic, 4);
    offset += 4;
    
    // Timestamp (4 bytes, little-endian)
    memcpy(buffer + offset, &packet->timestamp, 4);
    offset += 4;
    
    // Node count (1 byte)
    buffer[offset] = packet->node_count;
    offset += 1;
    
    // Nodes (9 bytes each)
    for (int i = 0; i < packet->node_count; i++) {
        const telemetry_node_t *node = &packet->nodes[i];
        
        buffer[offset] = node->id;              // ID (1 byte)
        offset += 1;
        
        buffer[offset] = node->type;            // Type (1 byte)
        offset += 1;
        
        memcpy(buffer + offset, &node->demand, 4);      // Demand (4 bytes)
        offset += 4;
        
        memcpy(buffer + offset, &node->fulfillment, 4); // Fulfillment (4 bytes)
        offset += 4;
    }
    
    return offset;
}

bool decode_dispatch(const uint8_t *data, size_t size, dispatch_packet_t *packet)
{
    if (!data || !packet || size < 5) {
        return false;
    }
    
    size_t offset = 0;
    
    // Check magic (4 bytes)
    uint32_t magic;
    memcpy(&magic, data + offset, 4);
    offset += 4;
    
    if (magic != DISPATCH_MAGIC) {
        return false;
    }
    
    // Node count (1 byte)
    uint8_t node_count = data[offset];
    offset += 1;
    
    // Validate size
    size_t expected_size = dispatch_packet_size(node_count);
    if (size != expected_size || node_count > MAX_NODES_PER_PACKET) {
        return false;
    }
    
    packet->magic = magic;
    packet->node_count = node_count;
    
    // Parse nodes (6 bytes each)
    for (int i = 0; i < node_count; i++) {
        dispatch_node_t *node = &packet->nodes[i];
        
        node->id = data[offset];                        // ID (1 byte)
        offset += 1;
        
        memcpy(&node->supply, data + offset, 4);        // Supply (4 bytes)
        offset += 4;
        
        node->source = data[offset];                    // Source (1 byte)
        offset += 1;
    }
    
    return true;
}
