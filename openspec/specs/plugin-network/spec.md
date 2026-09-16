# plugin-network Specification

## Purpose

网络插件：`svc:http` 统一 HTTP 服务（超时/有限重试/统一错误/dev 日志），供 tmdb、jellyfin 等消费方经 ServiceRegistry 取用，服务缺失时消费方裸 fetch 回退。

## Requirements

### Requirement: svc:http 服务契约
plugin-network SHALL 实现 `AukPlugin` 契约（id `network`，tier `locked`，无 permissions 声明——它不发起业务请求，仅提供封装），在 `create` 时向 ServiceRegistry 注册 `svc:http` 服务：`(url, init?) => Promise<Response>` 签名兼容原生 fetch，附加行为——**超时**（默认 15s，可配置 AbortController 注入）、**有限重试**（仅幂等 GET；网络/5xx 重试至多 2 次，指数退避）、**统一错误**（`HttpError`：`kind: timeout | network | status` + status + url；4xx 不重试直接抛）、**dev 日志**（dev 模式打印方法/url/耗时/状态，不打印 header 与 body）。服务未注册时消费方 SHALL 回退裸 fetch，功能不变。

#### Scenario: 超时中断
- **WHEN** 请求超过配置时长未响应
- **THEN** 以 `HttpError{kind:"timeout"}` 拒绝，底层连接被中止

#### Scenario: GET 5xx 重试
- **WHEN** GET 收到 502 且首次重试成功
- **THEN** 调用方拿到重试后的成功响应，注入 fetch 共被调用 2 次

#### Scenario: 4xx 不重试
- **WHEN** GET 收到 401
- **THEN** 立即抛 `HttpError{kind:"status", status:401}`，注入 fetch 仅调用 1 次

#### Scenario: 服务缺失回退
- **WHEN** plugin-network 未加载
- **THEN** 消费方（tmdb/jellyfin）使用裸 fetch，行为与 Phase 3 一致

### Requirement: headless 可测性
超时定时器、重试退避、AbortController SHALL 全部可注入（timer/abort 工厂参数），`HttpService` 的全部行为 MUST 在纯 Node 环境以 stub fetch/定时器验证，不发起真实网络。

#### Scenario: stub 注入单测
- **WHEN** 以受控定时器与 stub fetch 构造服务
- **THEN** 重试次数、退避间隔、错误 kind 均可精确断言
