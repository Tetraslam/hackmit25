#ifndef BINARY_PROTOCOL_H
#define BINARY_PROTOCOL_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

// Protocol constants
#define TELEMETRY_MAGIC 0x47524944  // "GRID"
#define DISPATCH_MAGIC  0x44495350  // "DISP"
#define MAX_NODES_PER_PACKET 16

// Node types
#define NODE_TYPE_POWER    0
#define NODE_TYPE_CONSUMER 1

// Telemetry structures (ESP32 → Backend)
typedef struct __attribute__((packed)) {
    uint8_t id;
    uint8_t type;           // 0=power, 1=consumer
    float demand;           // Amps
    float fulfillment;      // Percentage
} telemetry_node_t;

typedef struct __attribute__((packed)) {
    uint32_t magic;         // TELEMETRY_MAGIC
    uint32_t timestamp;     // Milliseconds
    uint8_t node_count;
    telemetry_node_t nodes[MAX_NODES_PER_PACKET];
} telemetry_packet_t;

// Dispatch structures (Backend → ESP32)
typedef struct __attribute__((packed)) {
    uint8_t id;
    float supply;           // 0.0-1.0 normalized for PWM
    uint8_t source;         // Source ID
} dispatch_node_t;

typedef struct __attribute__((packed)) {
    uint32_t magic;         // DISPATCH_MAGIC
    uint8_t node_count;
    dispatch_node_t nodes[MAX_NODES_PER_PACKET];
} dispatch_packet_t;

/**
 * @brief Encode telemetry data to binary format
 * 
 * @param packet Telemetry packet to encode
 * @param buffer Output buffer (must be large enough)
 * @return Size of encoded data in bytes, or 0 on error
 */
size_t encode_telemetry(const telemetry_packet_t *packet, uint8_t *buffer);

/**
 * @brief Decode binary dispatch data
 * 
 * @param data Binary data buffer
 * @param size Size of data buffer
 * @param packet Output dispatch packet
 * @return true if decode successful, false otherwise
 */
bool decode_dispatch(const uint8_t *data, size_t size, dispatch_packet_t *packet);

/**
 * @brief Calculate telemetry packet size
 * 
 * @param node_count Number of nodes in packet
 * @return Total packet size in bytes
 */
static inline size_t telemetry_packet_size(uint8_t node_count) {
    return 9 + (node_count * 9);  // Header(4) + timestamp(4) + count(1) + nodes(9*count)
}

/**
 * @brief Calculate dispatch packet size
 * 
 * @param node_count Number of nodes in packet
 * @return Total packet size in bytes
 */
static inline size_t dispatch_packet_size(uint8_t node_count) {
    return 5 + (node_count * 6);  // Header(4) + count(1) + nodes(6*count)
}

#ifdef __cplusplus
}
#endif

#endif // BINARY_PROTOCOL_H
