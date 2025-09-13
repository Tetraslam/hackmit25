idf_component_register(SRCS "power_grid.c" "binary_protocol.c"
                       PRIV_REQUIRES esp_driver_ledc esp_driver_gpio esp_http_server esp_http_client esp_wifi nvs_flash esp_eth protocol_examples_common esp_timer json
                       INCLUDE_DIRS "")
