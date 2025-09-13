#include <stdio.h>
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
#include "cJSON.h"

#define POWER_GRID_TAG "power_grid"
#define DATA_SEND_INTERVAL_MS 42  // 24 Hz = ~41.67ms
#define MAX_NODES 8
#define MAX_JSON_BUFFER 2048

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

static httpd_handle_t server_handle = NULL;
static int ws_fd = -1;
static TaskHandle_t data_task = NULL;
static volatile bool should_send_data = false;
static power_grid_data_t grid_data;
static char json_buffer[MAX_JSON_BUFFER];

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

        if (strcmp(node->type, "consumer") == 0) {
            float base_demand = (i == 2) ? 2.5 : (i == 3) ? 1.8 : 3.2;
            float variation = 0.3 * sinf(0.1 * time_s + i * 1.5);
            node->demand = base_demand + variation;
            if (node->demand < 0.1) node->demand = 0.1;

            node->fulfillment = 0.85 + 0.1 * sinf(0.05 * time_s + i * 0.8);
            if (node->fulfillment > 1.0) node->fulfillment = 1.0;
            if (node->fulfillment < 0.7) node->fulfillment = 0.7;
        } else {
            node->demand = 0.0;
            node->fulfillment = 0.85 + 0.1 * sinf(0.03 * time_s + i * 2.1);
            if (node->fulfillment > 1.0) node->fulfillment = 1.0;
            if (node->fulfillment < 0.8) node->fulfillment = 0.8;
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

        cJSON_AddItemToObject(node_obj, "id", cJSON_CreateNumber(node->id));
        cJSON_AddItemToObject(node_obj, "type", cJSON_CreateString(node->type));
        cJSON_AddItemToObject(node_obj, "demand", cJSON_CreateNumber(roundf(node->demand * 10000) / 10000));
        cJSON_AddItemToObject(node_obj, "ff", cJSON_CreateNumber(roundf(node->fulfillment * 10000) / 10000));

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
            if (ret == ESP_OK && ws_pkt.type == HTTPD_WS_TYPE_CLOSE) {
                ESP_LOGI(POWER_GRID_TAG, "WebSocket connection closed by client");
                ws_fd = -1;
                should_send_data = false;
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