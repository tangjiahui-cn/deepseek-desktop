# desktop-shell Specification

## Purpose
让现有聊天界面在桌面环境中以稳定、安全的本地 origin 运行，并定义窗口、外链、附件、下载与权限等桌面外壳行为。

## Requirements

### Requirement: 稳定加载与本地 origin

应用 SHALL 从固定的应用内 origin 加载界面，不得依赖 `file://` 页面或启动时随机端口的本地服务，以保证 localStorage 与 IndexedDB 在每次启动后仍属于同一来源。

#### Scenario: 冷启动加载界面
- **WHEN** 用户启动已安装的应用
- **THEN** 主窗口显示聊天界面，且资源从应用内 origin 加载，不需要任何本地服务

#### Scenario: 重启后数据仍在
- **WHEN** 用户创建会话后退出并重新启动应用
- **THEN** 会话与设置从同一 origin 的本地存储中恢复

### Requirement: 单实例运行

应用 SHALL 保证同时只运行一个实例；再次启动时聚焦已有窗口，而不是创建第二个窗口。

#### Scenario: 重复启动
- **WHEN** 应用已在运行且用户再次打开
- **THEN** 已有窗口被聚焦，不会出现第二个主窗口

### Requirement: 窗口尺寸与位置恢复

应用 SHALL 在退出时记住窗口尺寸与位置并在下次启动时恢复；恢复位置必须落在当前可见的屏幕范围内，窗口不得小于可用的最小尺寸。

#### Scenario: 恢复窗口
- **WHEN** 用户调整窗口大小和位置后退出并重启
- **THEN** 主窗口以退出前的尺寸和位置打开

#### Scenario: 显示器变化
- **WHEN** 上次保存的位置位于已断开的显示器上
- **THEN** 窗口在可见屏幕内打开，而不是出现在屏幕外

### Requirement: 外部链接交给系统浏览器

应用内所有 http/https 链接 SHALL 在系统默认浏览器中打开，主窗口不得导航离开聊天界面；非 http/https 协议的链接不得打开或执行。

#### Scenario: 点击来源链接
- **WHEN** 用户点击回复中的来源或 Markdown 链接
- **THEN** 系统默认浏览器打开该地址，应用窗口仍停留在聊天界面

#### Scenario: 危险协议
- **WHEN** 内容中的链接使用 javascript:、file: 或其他非 http/https 协议
- **THEN** 应用忽略该链接，不执行也不打开

### Requirement: 附件预览与保存

应用 SHALL 在隔离的预览窗口中打开图片和 PDF 附件，该窗口不得获得应用 API 或 Node 能力；导出历史与下载附件时 SHALL 通过系统保存对话框让用户选择位置，取消时不得产生文件。

#### Scenario: 预览 PDF
- **WHEN** 用户点击 PDF 附件
- **THEN** 独立预览窗口打开该附件，且窗口内无法访问应用的 preload API

#### Scenario: 保存导出文件
- **WHEN** 用户导出历史并确认保存位置
- **THEN** ZIP 文件写入所选路径

#### Scenario: 取消保存
- **WHEN** 用户在保存对话框中取消
- **THEN** 不创建文件，应用恢复空闲状态

### Requirement: 麦克风权限

应用 SHALL 仅在用户主动使用语音输入时请求麦克风权限，并且只向应用自身 origin 授予媒体权限；其他权限请求默认拒绝。权限被拒绝时 SHALL 显示可理解的提示且不崩溃。

#### Scenario: 首次录音
- **WHEN** 用户首次点击语音输入
- **THEN** 系统弹出麦克风授权请求，允许后开始录音

#### Scenario: 拒绝麦克风
- **WHEN** 用户或系统拒绝麦克风权限
- **THEN** 应用提示无法录音，聊天界面仍可正常使用

### Requirement: 桌面菜单

应用 SHALL 提供可用的桌面菜单：macOS 上必须包含编辑菜单以支持复制、粘贴、全选快捷键；所有平台提供退出、最小化、缩放与应用信息入口。

#### Scenario: macOS 复制粘贴
- **WHEN** 用户在 macOS 的输入框中按下 Cmd+C 或 Cmd+V
- **THEN** 文本正常复制或粘贴

### Requirement: 渲染进程隔离

应用 SHALL 保持渲染进程与 Node.js 环境隔离，加载的内容只能来自应用包内；任何远程页面都不得以应用权限运行。

#### Scenario: 阻止外部导航
- **WHEN** 页面内容尝试把主窗口导航到应用外地址
- **THEN** 导航被阻止，聊天界面保持不变
