#!/bin/bash
# Railway 启动脚本

# 设置内存限制
export NODE_OPTIONS="--max-old-space-size=768"

# 启动服务器
node bin/server.js