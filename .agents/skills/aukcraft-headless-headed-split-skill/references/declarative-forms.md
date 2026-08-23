# 声明式表单（数据驱动）设计

## 问题

N 种插件/实体各自需要不同配置表单。若每写一个屏幕表单，头部就多一份业务知识——违反纯头零逻辑。

## 方案：表单是数据，不是代码

插件契约附带**声明式字段描述**，头部一个泛化表单组件渲染所有种类：

```ts
interface FormField {
  key: string;            // 提交对象的字段名
  label: string;
  type: 'text' | 'password' | 'url' | 'number' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];  // select 用
  helpText?: string;
}

// 插件侧
const FIELDS: FormField[] = [
  { key: 'serverUrl', label: '服务器', type: 'url', required: true, placeholder: 'https://tv.example.com' },
  { key: 'username',  label: '用户名', type: 'text', required: true },
  { key: 'password',  label: '密码',   type: 'password', required: true },
];
```

## 分层职责

| 层 | 职责 |
|---|---|
| 插件 | 声明 FIELDS；connect 内校验与握手 |
| 无头层 | FormController：字段值/脏检查/校验状态/提交状态机（idle→submitting→done/error） |
| 纯头层 | 泛化 `FormScreen({ fields, value, onChange, onSubmit, status })` —— 对字段种类零感知 |

## 收益

- 新增插件种类：设置页**零改动**（表单从 `registry.listPlugins()` 动态来）
- 校验规则可在字段声明扩展（`validate?: (v) => string | null`），行为仍归无头层
- 双端复用同一 FIELDS 数据（RN 与 web 头各自渲染）

## 边界

- 复杂联动/异步搜索字段（如下拉远程数据）：字段声明支持 `type: 'asyncSelect'` + 控制器方法，仍不进头部
- 真正一次性的特殊表单（如引导向导）可单独屏幕，但常规"添加/编辑实体"表单一律声明式
