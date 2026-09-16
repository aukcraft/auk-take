## MODIFIED Requirements

### Requirement: LRU 容量与原子写
缓存 SHALL 以 LRU 策略维持容量上限（可配置，默认覆盖个人规模海报库）。Phase 5 起缓存档位 SHALL 扩展至 backdrop/stills：按 URL 形态（poster /backdrop /stills 尺寸段）分档计数，容量按比例分配且 poster 档优先保留。写入 SHALL 原子（临时文件 + rename），崩溃不留半写文件。缓存 key SHALL 由 URL 确定性派生（哈希），同 URL 双端命中同一缓存条目。对外 `resolve` 签名与消费方语义不变。

#### Scenario: 容量淘汰
- **WHEN** 缓存超出容量上限且新图片写入
- **THEN** 最久未使用条目被淘汰，总量回落到上限内

#### Scenario: 确定性缓存 key
- **WHEN** 同一 poster URL 在两端请求缓存
- **THEN** 派生的缓存文件名一致（同 URL 哈希），互不冲突

#### Scenario: backdrop 入缓存
- **WHEN** 分享海报请求某 backdrop URL 的缓存路径
- **THEN** 服务按 backdrop 档下载缓存并返回本地路径；poster 档条目不被 backdrop 挤占淘汰
