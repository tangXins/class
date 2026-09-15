# 班级管理大师 Relay Server

手机 App 和教室 PC 之间的云端中转服务。

## 本地运行

```bash
cd relay
npm install
node relay-server.js
# 监听 ws://localhost:9000/relay
```

## Render 一键部署（免费）

1. 打开 https://render.com 注册账号（免费）
2. 点击 **New → Web Service**
3. 连接 GitHub 仓库（把整个项目推上去）
4. 在 Render 里选择 `relay/` 子目录
5. 或直接复制 `relay-server.js` + `package.json` 到一个新仓库
6. 部署完成后，得到类似 `wss://classmanager-relay.onrender.com/relay` 的地址
7. 把这个地址填到 PC 软件 → 设置 → Relay 服务器地址

## 手机 App 扫码时二维码里编码的就是这个 Relay 地址

## 协议

WebSocket + JSON，路径 `/relay`

### PC 端（教室主机）

```
→ register   { type:'register', name:'高一3班', deviceId:'xxx', pairCode:'K7M9P2' }
← registered { type:'registered', deviceId, name, pairCode }
→ heartbeat  { type:'heartbeat' }
← code       { type:'code', pairCode:'新配对码' }  // 配对码过期自动刷新
← message    { type:'message', sender:'学生A', content:'老师好！' }
→ refreshCode { type:'refreshCode' }               // 手动刷新配对码
```

### 手机端

```
→ list     { type:'list' }
← list     { type:'list', rooms:[{name, deviceId}] }
→ verify   { type:'verify', hostDeviceId, pairCode }
← verifyOk { type:'verifyOk', room:{name,hostDeviceId} }
→ join     { type:'join', hostDeviceId, pairCode, sender, content }
← joinOk   { type:'joinOk', room }
```

配对码 6 位大写字母+数字，2 分钟过期自动刷新。
