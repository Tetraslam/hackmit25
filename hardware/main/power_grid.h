#ifndef POWER_GRID_H
#define POWER_GRID_H

#include "esp_http_server.h"
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

esp_err_t register_power_grid_handler(httpd_handle_t server);
void power_grid_cleanup(void);

#ifdef __cplusplus
}
#endif

#endif // POWER_GRID_H