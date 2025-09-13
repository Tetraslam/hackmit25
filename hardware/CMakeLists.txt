# The following lines of boilerplate have to be in your project's
# CMakeLists in this exact order for cmake to work correctly
cmake_minimum_required(VERSION 3.16)

# Add common_components to component paths
set(EXTRA_COMPONENT_DIRS "${CMAKE_CURRENT_SOURCE_DIR}/common_components")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(power_grid)
