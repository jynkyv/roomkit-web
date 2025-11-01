# HTTPS 配置指南

## 前提条件

1. **拥有一个域名**（例如：`example.com`）
2. **域名已解析到服务器 IP**
   - 在域名 DNS 设置中添加 A 记录，指向服务器 IP（如：`47.111.225.130`）
   - 等待 DNS 解析生效（通常几分钟到几小时）
   - 验证：`ping your-domain.com` 应该返回服务器 IP
3. **服务器已开放 80 和 443 端口**
   - 检查 ECS 安全组规则
   - 检查服务器防火墙（ufw）

## 快速配置

### 方法 1: 使用自动配置脚本（推荐）

```bash
# 在项目根目录运行
./scripts/setup-https.sh <服务器IP> <域名>

# 示例
./scripts/setup-https.sh 47.111.225.130 example.com

# 如果 SSH 端口不是 22
./scripts/setup-https.sh 47.111.225.130 example.com 2222
```

脚本会自动：
1. ✅ 验证域名解析
2. ✅ 安装 Certbot（Let's Encrypt 客户端）
3. ✅ 获取 SSL 证书
4. ✅ 配置 Nginx HTTPS
5. ✅ 配置 HTTP 自动重定向到 HTTPS
6. ✅ 配置证书自动续期

### 方法 2: 手动配置

#### 步骤 1: 在服务器上安装 Certbot

```bash
ssh root@your-server-ip

# 更新系统
apt-get update

# 安装 Certbot
apt-get install -y certbot python3-certbot-nginx
```

#### 步骤 2: 获取 SSL 证书

```bash
# 方法 A: 使用 standalone 模式（暂时停止 Nginx）
systemctl stop nginx
certbot certonly --standalone -d your-domain.com -d www.your-domain.com
systemctl start nginx

# 方法 B: 使用 Nginx 插件（需要先配置好 Nginx）
certbot --nginx -d your-domain.com -d www.your-domain.com
```

#### 步骤 3: 配置 Nginx

编辑 `/etc/nginx/sites-available/roomkit-web`:

```nginx
# HTTP 服务器（重定向到 HTTPS）
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 服务器
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    
    # ... 其他配置（前端静态文件、WebSocket 代理等）
}
```

#### 步骤 4: 测试并重载 Nginx

```bash
nginx -t
systemctl reload nginx
```

#### 步骤 5: 配置自动续期

```bash
# 添加到 crontab
echo "0 3 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'" >> /etc/crontab
```

## 验证 HTTPS 配置

1. **访问 HTTPS 地址**
   ```
   https://your-domain.com
   ```

2. **检查证书状态**
   ```bash
   ssh root@your-server-ip 'certbot certificates'
   ```

3. **测试 SSL 配置**
   - 访问 [SSL Labs](https://www.ssllabs.com/ssltest/) 测试您的域名

## 故障排查

### 问题 1: 证书获取失败

**错误**: `Failed to connect to x.x.x.x:80 for domain validation`

**解决**:
- 确保域名 A 记录指向正确的服务器 IP
- 确保 80 端口已开放（ECS 安全组 + 服务器防火墙）
- 确保 Nginx 未占用 80 端口（standalone 模式需要）

### 问题 2: 证书已过期

**解决**:
```bash
# 手动续期
certbot renew

# 检查自动续期配置
cat /etc/crontab | grep certbot
```

### 问题 3: WebSocket 无法连接（WSS）

**检查**:
- Nginx 配置中的 `/translation` 路径是否正确代理
- WebSocket 服务是否在运行（`http://localhost:3002/health`）
- 浏览器控制台是否有错误

**解决**:
前端会自动根据页面协议（HTTP/HTTPS）使用 WS/WSS，无需额外配置。

## 注意事项

1. **证书有效期**: Let's Encrypt 证书有效期为 90 天，脚本已配置自动续期
2. **域名验证**: 证书获取需要域名能够访问到服务器（80 端口）
3. **WebSocket**: 使用 HTTPS 时，WebSocket 会自动使用 WSS（安全 WebSocket）
4. **自动重定向**: HTTP 请求会自动重定向到 HTTPS

## 后续操作

配置 HTTPS 后，建议：

1. **更新前端 WebSocket 配置**（已自动支持）
   - 前端会根据页面协议自动使用 WS 或 WSS
   - 无需手动修改代码

2. **测试所有功能**
   - 访问 https://your-domain.com
   - 测试 WebSocket 连接（翻译功能）
   - 检查浏览器控制台是否有错误

3. **配置防火墙**
   - 确保 443 端口已开放
   ```bash
   ufw allow 443/tcp
   ufw reload
   ```

## 参考资源

- [Let's Encrypt 官方文档](https://letsencrypt.org/)
- [Certbot 使用指南](https://certbot.eff.org/)
- [Nginx SSL 配置最佳实践](https://nginx.org/en/docs/http/configuring_https_servers.html)


