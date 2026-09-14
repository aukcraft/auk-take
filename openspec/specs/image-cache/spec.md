# image-cache Specification

## Purpose

海报图片缓存契约：URL→本地路径解析、LRU 容量、原子写、失败降级。

## Requirements

### Requirement: 图片解析契约
`svc:image-cache` 服务 SHALL 提供 `resolve(url: string): Promise<string | null>`（远端 URL → 本地缓存路径；null = 不可用）。消费方（display 海报卡、timeline 缩略、tmdb 补全候选缩略）SHALL 按统一顺序解析：本地缓存 → 远端 URL 直连（平台允许时）→ 确定性色卡。服务未注册时消费方 MUST 直接跳到远端/色卡档位，不抛错。

#### Scenario: 服务缺失降级
- **WHEN** plugin-tmdb 未加载导致 `svc:image-cache` 未注册
- **THEN** 海报墙回退色卡（或远端直连），无崩溃，dev 模式警告

#### Scenario: 解析命中缓存
- **WHEN** 图片已在缓存且有效
- **THEN** resolve 返回本地路径，无网络请求

### Requirement: LRU 容量与原子写
缓存 SHALL 以 LRU 策略维持容量上限（可配置，默认覆盖个人规模海报库）。写入 SHALL 原子（临时文件 + rename），崩溃不留半写文件。缓存 key SHALL 由 URL 确定性派生（哈希），同 URL 双端命中同一缓存条目。

#### Scenario: 容量淘汰
- **WHEN** 缓存超出容量上限且新图片写入
- **THEN** 最久未使用条目被淘汰，总量回落到上限内

#### Scenario: 确定性缓存 key
- **WHEN** 同一 poster URL 在两端请求缓存
- **THEN** 派生的缓存文件名一致（同 URL 哈希），互不冲突
