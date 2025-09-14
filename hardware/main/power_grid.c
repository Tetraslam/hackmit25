#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <math.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/timers.h"
#include "esp_timer.h"
#include "esp_log.h"
#include "esp_http_server.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_system.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "protocol_examples_common.h"
#include "driver/ledc.h"
#include "cJSON.h"
#include "esp_http_client.h"
#include "binary_protocol.h"

#define POWER_GRID_TAG "power_grid"
#define DATA_SEND_INTERVAL_MS 42  // 24 Hz = ~41.67ms
#define MAX_NODES 8
#define MAX_JSON_BUFFER 2048

#define LEDC_MODE LEDC_LOW_SPEED_MODE
#define LEDC_DUTY_RES LEDC_TIMER_13_BIT
#define LEDC_FREQUENCY 1000
#define MAX_DUTY (1 << LEDC_DUTY_RES) - 1

#define NUM_OUTPUT_PINS 3
#define MAX_WS_BUFFER 512

typedef struct {
    int id;
    char type[16];
    float demand;
    float fulfillment;
} power_node_t;

typedef struct {
    int timestamp;
    power_node_t nodes[MAX_NODES];
    int node_count;
} power_grid_data_t;

typedef struct {
    int node_id;
    int gpio_pin;
    ledc_channel_t channel;
} output_pin_map_t;

static const output_pin_map_t output_pins[NUM_OUTPUT_PINS] = {
    {1, 14, LEDC_CHANNEL_0},
    {2, 27, LEDC_CHANNEL_1},
    {3, 26, LEDC_CHANNEL_2}
};

static httpd_handle_t server_handle = NULL;
#define MAX_OUT_CLIENTS 4
static int ws_out_fds[MAX_OUT_CLIENTS] = {-1, -1, -1, -1};
static int ws_in_fd = -1;
static TaskHandle_t data_task = NULL;
static volatile bool should_send_data = false;
static power_grid_data_t grid_data;
static uint8_t ws_buffer[MAX_WS_BUFFER];
static uint8_t binary_buffer[256];  // Buffer for binary protocol
static ledc_channel_t node_to_channel[MAX_NODES] = {0};

static void init_pwm_outputs(void)
{
    ledc_timer_config_t timer_config = {
        .speed_mode = LEDC_MODE,
        .duty_resolution = LEDC_DUTY_RES,
        .timer_num = LEDC_TIMER_0,
        .freq_hz = LEDC_FREQUENCY,
        .clk_cfg = LEDC_AUTO_CLK
    };
    ESP_ERROR_CHECK(ledc_timer_config(&timer_config));

    for (int i = 0; i < NUM_OUTPUT_PINS; i++) {
        ledc_channel_config_t channel_config = {
            .speed_mode = LEDC_MODE,
            .channel = output_pins[i].channel,
            .timer_sel = LEDC_TIMER_0,
            .intr_type = LEDC_INTR_DISABLE,
            .gpio_num = output_pins[i].gpio_pin,
            .duty = 0,
            .hpoint = 0
        };
        ESP_ERROR_CHECK(ledc_channel_config(&channel_config));
    }

    ESP_LOGI(POWER_GRID_TAG, "PWM outputs initialized on pins 14, 27, 26");
}

static void set_output_pwm(int node_id, float supply)
{
    if (supply < 0.0f) supply = 0.0f;
    if (supply > 1.0f) supply = 1.0f;

    // Direct lookup - node_id is 1-based, array is 0-based
    if (node_id >= 1 && node_id <= MAX_NODES && node_to_channel[node_id - 1] != 0) {
        uint32_t duty = (uint32_t)(supply * MAX_DUTY);
        ledc_set_duty(LEDC_MODE, node_to_channel[node_id - 1], duty);
        ledc_update_duty(LEDC_MODE, node_to_channel[node_id - 1]);
    }
}

static void init_dummy_nodes(void)
{
    grid_data.node_count = 3;  // Only the 3 nodes with LEDs

    // All nodes with LEDs are consumers (nodes 1, 2, 3 have LEDs)
    grid_data.nodes[0] = (power_node_t){1, "consumer", 2.5, 0.92};
    grid_data.nodes[1] = (power_node_t){2, "consumer", 1.8, 0.88};
    grid_data.nodes[2] = (power_node_t){3, "consumer", 3.2, 0.95};

    // Initialize node-to-channel mapping
    memset(node_to_channel, 0, sizeof(node_to_channel));
    for (int i = 0; i < NUM_OUTPUT_PINS; i++) {
        int node_idx = output_pins[i].node_id - 1; // Convert to 0-based
        if (node_idx >= 0 && node_idx < MAX_NODES) {
            node_to_channel[node_idx] = output_pins[i].channel;
        }
    }
}

static void update_dummy_data(void)
{
    int64_t time_us = esp_timer_get_time();
    float time_s = time_us / 1000000.0f;

    grid_data.timestamp = (int)(time_us / 1000);

    for (int i = 0; i < grid_data.node_count; i++) {
        power_node_t *node = &grid_data.nodes[i];

        float phase_offset = i * 0.5f; // Different phase for each node

        if (strcmp(node->type, "consumer") == 0) {
            // Demand varies sinusoidally between 0.5 and 4.0
            float base_demand = 2.25f; // midpoint
            float demand_amplitude = 1.75f; // amplitude
            float demand_freq = 0.2f; // frequency in Hz
            node->demand = base_demand + demand_amplitude * sinf(2.0f * M_PI * demand_freq * time_s + phase_offset);

            // Fulfillment varies between 0.7 and 1.0
            float base_ff = 0.85f;
            float ff_amplitude = 0.15f;
            float ff_freq = 0.12f;
            node->fulfillment = base_ff + ff_amplitude * sinf(2.0f * M_PI * ff_freq * time_s + phase_offset + 1.0f);
        } else {
            // Power generators have zero demand
            node->demand = 0.0;

            // Generator fulfillment varies between 0.8 and 1.0
            float base_ff = 0.9f;
            float ff_amplitude = 0.1f;
            float ff_freq = 0.06f;
            node->fulfillment = base_ff + ff_amplitude * sinf(2.0f * M_PI * ff_freq * time_s + phase_offset + 2.0f);
        }
    }
}

static size_t generate_binary_telemetry(uint8_t *buffer, size_t buffer_size)
{
    telemetry_packet_t packet;
    
    // Fill packet header
    packet.magic = TELEMETRY_MAGIC;
    packet.timestamp = grid_data.timestamp;
    packet.node_count = grid_data.node_count;
    
    // Fill node data
    for (int i = 0; i < grid_data.node_count && i < MAX_NODES_PER_PACKET; i++) {
        power_node_t *src_node = &grid_data.nodes[i];
        telemetry_node_t *dst_node = &packet.nodes[i];
        
        dst_node->id = src_node->id;
        dst_node->type = (strcmp(src_node->type, "consumer") == 0) ? NODE_TYPE_CONSUMER : NODE_TYPE_POWER;
        dst_node->demand = src_node->demand;
        dst_node->fulfillment = src_node->fulfillment;
    }
    
    // Encode to binary buffer
    return encode_telemetry(&packet, buffer);
}


static void data_send_task(void *pvParameters)
{
    vTaskDelay(pdMS_TO_TICKS(100)); // Give connection time to establish

    while (1) {
        if (should_send_data && server_handle) {
            update_dummy_data();

            // Use binary protocol for efficiency
            size_t binary_len = generate_binary_telemetry(binary_buffer, sizeof(binary_buffer));
            if (binary_len > 0) {
                httpd_ws_frame_t ws_frame = {
                    .final = true,
                    .fragmented = false,
                    .type = HTTPD_WS_TYPE_BINARY,  // Binary instead of text
                    .payload = binary_buffer,
                    .len = binary_len
                };

                // Send to all connected /out clients
                int active_clients = 0;
                for (int i = 0; i < MAX_OUT_CLIENTS; i++) {
                    if (ws_out_fds[i] >= 0) {
                        esp_err_t ret = httpd_ws_send_frame_async(server_handle, ws_out_fds[i], &ws_frame);
                        if (ret != ESP_OK) {
                            ESP_LOGW(POWER_GRID_TAG, "WebSocket send failed to client %d: %s", i, esp_err_to_name(ret));
                            if (ret == ESP_ERR_INVALID_ARG || ret == ESP_ERR_INVALID_STATE) {
                                ESP_LOGI(POWER_GRID_TAG, "Output client %d disconnected", i);
                                ws_out_fds[i] = -1;
                            }
                        } else {
                            active_clients++;
                        }
                    }
                }

                // Update should_send_data based on active clients
                if (active_clients == 0) {
                    should_send_data = false;
                    ESP_LOGI(POWER_GRID_TAG, "No active /out clients, stopping data transmission");
                }

                // Log efficiency gain occasionally
                static int log_counter = 0;
                if (++log_counter % 240 == 0) {  // Log every 10 seconds at 24Hz
                    ESP_LOGI(POWER_GRID_TAG, "Binary telemetry: %d bytes to %d clients (vs ~150 JSON)", binary_len, active_clients);
                }
            }
        }
        vTaskDelay(pdMS_TO_TICKS(DATA_SEND_INTERVAL_MS));
    }
}

static esp_err_t power_grid_ws_out_handler(httpd_req_t *req)
{
    if (req->method == HTTP_GET) {
        ESP_LOGI(POWER_GRID_TAG, "WebSocket /out handshake completed, starting data stream");

        // Find empty slot for new client
        int client_slot = -1;
        for (int i = 0; i < MAX_OUT_CLIENTS; i++) {
            if (ws_out_fds[i] == -1) {
                client_slot = i;
                break;
            }
        }

        if (client_slot == -1) {
            ESP_LOGW(POWER_GRID_TAG, "Too many /out clients, rejecting connection");
            return ESP_FAIL;
        }

        ws_out_fds[client_slot] = httpd_req_to_sockfd(req);
        should_send_data = true;
        ESP_LOGI(POWER_GRID_TAG, "Added /out client %d (fd=%d)", client_slot, ws_out_fds[client_slot]);

        if (data_task == NULL) {
            xTaskCreate(data_send_task, "data_send", 4096, NULL, 5, &data_task);
            ESP_LOGI(POWER_GRID_TAG, "Started data send task at 24 Hz");
        }

        return ESP_OK;
    }

    // /out is send-only - we don't expect to receive data from clients
    // Just return OK and let data_send_task handle all outgoing frames

    return ESP_OK;
}

static esp_err_t power_grid_ws_in_handler(httpd_req_t *req)
{
    if (req->method == HTTP_GET) {
        ESP_LOGI(POWER_GRID_TAG, "WebSocket /in handshake completed, ready for input");
        ws_in_fd = httpd_req_to_sockfd(req);
        return ESP_OK;
    }

    httpd_ws_frame_t ws_pkt;
    memset(&ws_pkt, 0, sizeof(httpd_ws_frame_t));

    esp_err_t ret = httpd_ws_recv_frame(req, &ws_pkt, 0);
    if (ret != ESP_OK) {
        static int error_count = 0;
        static int64_t last_error_time = 0;
        int64_t now = esp_timer_get_time() / 1000;

        error_count++;

        if (now - last_error_time > 5000 || error_count >= 10) {
            ESP_LOGW(POWER_GRID_TAG, "WebSocket /in recv errors: %d in last %.1fs, latest: %s",
                    error_count, (now - last_error_time) / 1000.0f, esp_err_to_name(ret));
            error_count = 0;
            last_error_time = now;
        }

        if (ret == ESP_ERR_INVALID_STATE && error_count >= 10) {
            ESP_LOGE(POWER_GRID_TAG, "Persistent WebSocket /in errors, disconnecting");
            ws_in_fd = -1;
        }

        return ESP_OK;
    }

    ESP_LOGD(POWER_GRID_TAG, "WebSocket /in frame: type=%d, len=%d, fin=%d", ws_pkt.type, ws_pkt.len, ws_pkt.final);

    if (ws_pkt.len > 0 && ws_pkt.len < MAX_WS_BUFFER - 1) {
        ws_pkt.payload = ws_buffer;
        ret = httpd_ws_recv_frame(req, &ws_pkt, ws_pkt.len);

        if (ret == ESP_OK) {
            if (ws_pkt.type == HTTPD_WS_TYPE_CLOSE) {
                ESP_LOGI(POWER_GRID_TAG, "WebSocket /in connection closed by client");
                ws_in_fd = -1;
            } else if (ws_pkt.type == HTTPD_WS_TYPE_BINARY) {
                // Binary dispatch protocol
                dispatch_packet_t dispatch_packet;
                if (decode_dispatch(ws_buffer, ws_pkt.len, &dispatch_packet)) {
                    for (int i = 0; i < dispatch_packet.node_count; i++) {
                        dispatch_node_t *node = &dispatch_packet.nodes[i];
                        set_output_pwm(node->id, node->supply);

                        // Log occasionally for debugging
                        static int log_counter = 0;
                        if (++log_counter % 240 == 0) {  // Every 10 seconds
                            ESP_LOGI(POWER_GRID_TAG, "Binary dispatch: node %d gets %.3f supply from source %d",
                                    node->id, node->supply, node->source);
                        }
                    }
                } else {
                    ESP_LOGW(POWER_GRID_TAG, "Invalid binary dispatch received (%d bytes)", ws_pkt.len);
                }
            } else if (ws_pkt.type == HTTPD_WS_TYPE_TEXT) {
                // JSON protocol removed - binary only
                ESP_LOGW(POWER_GRID_TAG, "Text/JSON messages not supported - use binary protocol only");
            }
        }
    }

    return ESP_OK;
}

static const httpd_uri_t power_grid_ws_out_uri = {
    .uri = "/out",
    .method = HTTP_GET,
    .handler = power_grid_ws_out_handler,
    .user_ctx = NULL,
    .is_websocket = true
};

static const httpd_uri_t power_grid_ws_in_uri = {
    .uri = "/in",
    .method = HTTP_GET,
    .handler = power_grid_ws_in_handler,
    .user_ctx = NULL,
    .is_websocket = true
};

esp_err_t register_power_grid_handler(httpd_handle_t server)
{
    server_handle = server;
    init_dummy_nodes();
    ESP_LOGI(POWER_GRID_TAG, "Initialized %d power grid nodes", grid_data.node_count);

    esp_err_t ret1 = httpd_register_uri_handler(server, &power_grid_ws_out_uri);
    esp_err_t ret2 = httpd_register_uri_handler(server, &power_grid_ws_in_uri);

    if (ret1 == ESP_OK && ret2 == ESP_OK) {
        ESP_LOGI(POWER_GRID_TAG, "Power grid WebSocket handlers registered at /out and /in");
        return ESP_OK;
    } else {
        ESP_LOGE(POWER_GRID_TAG, "Failed to register WebSocket handlers: /out=%s, /in=%s",
                esp_err_to_name(ret1), esp_err_to_name(ret2));
        return (ret1 != ESP_OK) ? ret1 : ret2;
    }
}

void power_grid_cleanup(void)
{
    should_send_data = false;
    for (int i = 0; i < MAX_OUT_CLIENTS; i++) {
        ws_out_fds[i] = -1;
    }
    ws_in_fd = -1;
    server_handle = NULL;
    if (data_task) {
        vTaskDelete(data_task);
        data_task = NULL;
    }
}

static void post_ip_address(void)
{
    esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    esp_netif_ip_info_t ip_info;

    if (esp_netif_get_ip_info(netif, &ip_info) == ESP_OK) {
        char ip_str[16];
        snprintf(ip_str, sizeof(ip_str), IPSTR, IP2STR(&ip_info.ip));
        ESP_LOGI(POWER_GRID_TAG, "Local IP address: %s", ip_str);

        esp_http_client_config_t config = {
            .url = "http://kv.wfeng.dev/hackmit25:ip",
            .method = HTTP_METHOD_POST,
        };

        esp_http_client_handle_t client = esp_http_client_init(&config);
        esp_http_client_set_post_field(client, ip_str, strlen(ip_str));
        esp_http_client_set_header(client, "Content-Type", "text/plain");

        esp_err_t err = esp_http_client_perform(client);
        if (err == ESP_OK) {
            int status_code = esp_http_client_get_status_code(client);
            ESP_LOGI(POWER_GRID_TAG, "IP address posted successfully, status: %d", status_code);
        } else {
            ESP_LOGE(POWER_GRID_TAG, "Failed to post IP address: %s", esp_err_to_name(err));
        }

        esp_http_client_cleanup(client);
    } else {
        ESP_LOGE(POWER_GRID_TAG, "Failed to get IP address");
    }
}

static httpd_handle_t start_webserver(void)
{
    httpd_handle_t server = NULL;
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();

    // Increase timeout and buffer sizes for better WebSocket compatibility
    config.recv_wait_timeout = 10;
    config.send_wait_timeout = 10;
    config.max_resp_headers = 16;
    config.max_uri_handlers = 16;
    config.stack_size = 8192;  // Increase stack size for WebSocket handling

    if (httpd_start(&server, &config) == ESP_OK) {
        register_power_grid_handler(server);
        return server;
    }
    return NULL;
}

void app_main(void)
{
    ESP_LOGI(POWER_GRID_TAG, "Starting Power Grid Node");

    init_pwm_outputs();

    ESP_ERROR_CHECK(nvs_flash_init());
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    ESP_LOGI(POWER_GRID_TAG, "Connecting to network...");
    ESP_ERROR_CHECK(example_connect());
    ESP_LOGI(POWER_GRID_TAG, "Network connected");

    post_ip_address();

    httpd_handle_t server = start_webserver();
    if (server) {
        ESP_LOGI(POWER_GRID_TAG, "WebSocket server started on /out and /in");
    }

    while (1) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}