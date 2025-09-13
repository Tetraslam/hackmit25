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

#define POWER_GRID_TAG "power_grid"
#define DATA_SEND_INTERVAL_MS 42  // 24 Hz = ~41.67ms
#define MAX_NODES 8
#define MAX_JSON_BUFFER 2048

#define LEDC_MODE LEDC_LOW_SPEED_MODE
#define LEDC_DUTY_RES LEDC_TIMER_13_BIT
#define LEDC_FREQUENCY 1000
#define MAX_DUTY (1 << LEDC_DUTY_RES) - 1

#define NUM_OUTPUT_PINS 3

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
    {14, 14, LEDC_CHANNEL_0},
    {27, 27, LEDC_CHANNEL_1},
    {26, 26, LEDC_CHANNEL_2}
};

static httpd_handle_t server_handle = NULL;
static int ws_fd = -1;
static TaskHandle_t data_task = NULL;
static volatile bool should_send_data = false;
static power_grid_data_t grid_data;
static char json_buffer[MAX_JSON_BUFFER];

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

    for (int i = 0; i < NUM_OUTPUT_PINS; i++) {
        if (output_pins[i].node_id == node_id) {
            uint32_t duty = (uint32_t)(supply * MAX_DUTY);
            ledc_set_duty(LEDC_MODE, output_pins[i].channel, duty);
            ledc_update_duty(LEDC_MODE, output_pins[i].channel);
            ESP_LOGI(POWER_GRID_TAG, "Set node %d (pin %d) to %.3f%% duty",
                     node_id, output_pins[i].gpio_pin, supply * 100.0f);
            break;
        }
    }
}

static void init_dummy_nodes(void)
{
    grid_data.node_count = 6;

    grid_data.nodes[0] = (power_node_t){1, "power", 0.0, 0.95};
    grid_data.nodes[1] = (power_node_t){2, "power", 0.0, 0.87};
    grid_data.nodes[2] = (power_node_t){3, "consumer", 2.5, 0.92};
    grid_data.nodes[3] = (power_node_t){4, "consumer", 1.8, 0.88};
    grid_data.nodes[4] = (power_node_t){5, "consumer", 3.2, 0.95};
    grid_data.nodes[5] = (power_node_t){6, "power", 0.0, 0.91};
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
            float demand_freq = 0.08f; // frequency in Hz
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

static int generate_json_data(char *buffer, size_t buffer_size)
{
    cJSON *root = cJSON_CreateObject();
    cJSON *timestamp = cJSON_CreateNumber(grid_data.timestamp);
    cJSON *nodes_array = cJSON_CreateArray();

    cJSON_AddItemToObject(root, "timestamp", timestamp);
    cJSON_AddItemToObject(root, "nodes", nodes_array);

    for (int i = 0; i < grid_data.node_count; i++) {
        power_node_t *node = &grid_data.nodes[i];
        cJSON *node_obj = cJSON_CreateObject();

        char demand_str[16], ff_str[16];
        snprintf(demand_str, sizeof(demand_str), "%.4f", node->demand);
        snprintf(ff_str, sizeof(ff_str), "%.4f", node->fulfillment);

        cJSON_AddItemToObject(node_obj, "id", cJSON_CreateNumber(node->id));
        cJSON_AddItemToObject(node_obj, "type", cJSON_CreateString(node->type));
        cJSON_AddItemToObject(node_obj, "demand", cJSON_CreateNumber(atof(demand_str)));
        cJSON_AddItemToObject(node_obj, "ff", cJSON_CreateNumber(atof(ff_str)));

        cJSON_AddItemToArray(nodes_array, node_obj);
    }

    char *json_string = cJSON_PrintUnformatted(root);
    if (json_string) {
        int len = snprintf(buffer, buffer_size, "%s", json_string);
        free(json_string);
        cJSON_Delete(root);
        return len;
    }

    cJSON_Delete(root);
    return 0;
}

static void data_send_task(void *pvParameters)
{
    vTaskDelay(pdMS_TO_TICKS(100)); // Give connection time to establish

    while (1) {
        if (should_send_data && ws_fd >= 0 && server_handle) {
            update_dummy_data();

            int json_len = generate_json_data(json_buffer, sizeof(json_buffer));
            if (json_len > 0) {
                httpd_ws_frame_t ws_frame = {
                    .final = true,
                    .fragmented = false,
                    .type = HTTPD_WS_TYPE_TEXT,
                    .payload = (uint8_t*)json_buffer,
                    .len = json_len
                };

                esp_err_t ret = httpd_ws_send_frame_async(server_handle, ws_fd, &ws_frame);
                if (ret != ESP_OK) {
                    ESP_LOGE(POWER_GRID_TAG, "WebSocket send failed: %s", esp_err_to_name(ret));
                    if (ret == ESP_ERR_INVALID_ARG || ret == ESP_ERR_INVALID_STATE) {
                        ESP_LOGI(POWER_GRID_TAG, "Connection lost, stopping data transmission");
                        ws_fd = -1;
                        should_send_data = false;
                    }
                }
            }
        }
        vTaskDelay(pdMS_TO_TICKS(DATA_SEND_INTERVAL_MS));
    }
}

static esp_err_t power_grid_ws_handler(httpd_req_t *req)
{
    if (req->method == HTTP_GET) {
        ESP_LOGI(POWER_GRID_TAG, "WebSocket handshake completed, starting data stream");

        ws_fd = httpd_req_to_sockfd(req);
        should_send_data = true;

        if (data_task == NULL) {
            xTaskCreate(data_send_task, "data_send", 4096, NULL, 5, &data_task);
            ESP_LOGI(POWER_GRID_TAG, "Started data send task at 24 Hz");
        }

        return ESP_OK;
    }

    httpd_ws_frame_t ws_pkt;
    memset(&ws_pkt, 0, sizeof(httpd_ws_frame_t));

    esp_err_t ret = httpd_ws_recv_frame(req, &ws_pkt, 0);
    if (ret != ESP_OK) {
        ESP_LOGI(POWER_GRID_TAG, "WebSocket connection closed");
        ws_fd = -1;
        should_send_data = false;
        return ESP_OK;
    }

    if (ws_pkt.len > 0) {
        uint8_t *buf = malloc(ws_pkt.len + 1);
        if (buf) {
            ws_pkt.payload = buf;
            ret = httpd_ws_recv_frame(req, &ws_pkt, ws_pkt.len);

            if (ret == ESP_OK) {
                if (ws_pkt.type == HTTPD_WS_TYPE_CLOSE) {
                    ESP_LOGI(POWER_GRID_TAG, "WebSocket connection closed by client");
                    ws_fd = -1;
                    should_send_data = false;
                } else if (ws_pkt.type == HTTPD_WS_TYPE_TEXT) {
                    buf[ws_pkt.len] = '\0';

                    cJSON *json = cJSON_Parse((char *)buf);
                    if (json) {
                        cJSON *nodes = cJSON_GetObjectItem(json, "nodes");
                        if (cJSON_IsArray(nodes)) {
                            int array_size = cJSON_GetArraySize(nodes);
                            for (int i = 0; i < array_size; i++) {
                                cJSON *node = cJSON_GetArrayItem(nodes, i);
                                if (node) {
                                    cJSON *id = cJSON_GetObjectItem(node, "id");
                                    cJSON *supply = cJSON_GetObjectItem(node, "supply");
                                    cJSON *source = cJSON_GetObjectItem(node, "source");

                                    if (cJSON_IsNumber(id) && cJSON_IsNumber(supply) && cJSON_IsNumber(source)) {
                                        int node_id = (int)cJSON_GetNumberValue(id);
                                        float supply_val = (float)cJSON_GetNumberValue(supply);
                                        int source_id = (int)cJSON_GetNumberValue(source);

                                        ESP_LOGI(POWER_GRID_TAG, "Received: node %d gets %.3f supply from source %d",
                                                node_id, supply_val, source_id);
                                        set_output_pwm(node_id, supply_val);
                                    }
                                }
                            }
                        }
                        cJSON_Delete(json);
                    } else {
                        ESP_LOGW(POWER_GRID_TAG, "Invalid JSON received");
                    }
                }
            }

            free(buf);
        }
    }

    return ESP_OK;
}

static const httpd_uri_t power_grid_ws_uri = {
    .uri = "/ws",
    .method = HTTP_GET,
    .handler = power_grid_ws_handler,
    .user_ctx = NULL,
    .is_websocket = true
};

esp_err_t register_power_grid_handler(httpd_handle_t server)
{
    server_handle = server;
    init_dummy_nodes();
    ESP_LOGI(POWER_GRID_TAG, "Initialized %d power grid nodes", grid_data.node_count);

    esp_err_t ret = httpd_register_uri_handler(server, &power_grid_ws_uri);
    if (ret == ESP_OK) {
        ESP_LOGI(POWER_GRID_TAG, "Power grid WebSocket handler registered at /ws");
    }
    return ret;
}

void power_grid_cleanup(void)
{
    should_send_data = false;
    ws_fd = -1;
    server_handle = NULL;
    if (data_task) {
        vTaskDelete(data_task);
        data_task = NULL;
    }
}

static httpd_handle_t start_webserver(void)
{
    httpd_handle_t server = NULL;
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();

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

    httpd_handle_t server = start_webserver();
    if (server) {
        ESP_LOGI(POWER_GRID_TAG, "WebSocket server started on /ws");
    }

    while (1) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}