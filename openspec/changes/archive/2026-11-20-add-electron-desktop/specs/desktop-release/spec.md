# Spec Delta

## Purpose

通过版本 tag 自动构建并发布三端桌面安装产物，保证版本号、更新元数据与发布资产一致，并且发布过程可重复执行。

## ADDED Requirements

### Requirement: 版本号单一来源

发布流水线 SHALL 以 `package.json` 的版本号作为唯一版本来源，并在构建开始前校验其与推送的 `v*` tag 一致；不一致时必须在构建前失败。

#### Scenario: 版本一致
- **WHEN** 推送的 tag 为 `v0.2.0` 且 `package.json` 版本为 `0.2.0`
- **THEN** 流水线继续构建

#### Scenario: 版本不一致
- **WHEN** tag 与 `package.json` 版本不一致
- **THEN** 流水线在构建和发布前失败，不产生任何 Release 资产

### Requirement: 平台产物矩阵

一次发布 SHALL 产出 macOS（x64 与 arm64 的 dmg、zip）、Windows（x64 NSIS 安装程序）与 Linux（x64 AppImage、deb），且文件名包含版本号与架构。

#### Scenario: macOS 双架构
- **WHEN** macOS 构建完成
- **THEN** 发布资产包含 x64 与 arm64 的 dmg 和 zip

#### Scenario: Windows 安装程序
- **WHEN** Windows 构建完成
- **THEN** 发布资产包含 x64 的 NSIS 安装程序

#### Scenario: Linux 包
- **WHEN** Linux 构建完成
- **THEN** 发布资产包含 x64 的 AppImage 与 deb

### Requirement: 更新元数据

每个平台 SHALL 随安装包一起发布对应的更新元数据（Windows 的 `latest.yml`、macOS 的 `latest-mac.yml`、Linux 的 `latest-linux.yml`），元数据必须引用本次上传的产物，且 Release 必须处于已发布状态。

#### Scenario: macOS 元数据包含双架构
- **WHEN** 发布 macOS 产物
- **THEN** `latest-mac.yml` 同时覆盖 x64 与 arm64 的 zip

#### Scenario: Release 已发布
- **WHEN** 发布流程结束
- **THEN** Release 不是 draft，已安装客户端可以读取更新

### Requirement: 签名按凭据启用

流水线 SHALL 在提供签名凭据时对 macOS 产物签名并公证、对 Windows 产物签名；未提供凭据时必须继续产出未签名安装包且不使流水线失败。

#### Scenario: 未配置签名凭据
- **WHEN** 仓库没有签名相关的 secrets
- **THEN** 流水线仍产出三端未签名安装包

#### Scenario: 配置了 macOS 凭据
- **WHEN** 提供 Apple 签名与公证凭据
- **THEN** macOS 产物完成签名与公证，且校验通过

### Requirement: 发布原子性与幂等

任一平台构建失败时流水线 SHALL NOT 发布新的 Release；同一 tag 重跑时必须替换已有资产，而不是创建重复 Release 或失败。

#### Scenario: 单个平台构建失败
- **WHEN** 三个平台中任一构建失败
- **THEN** 不发布或更新 Release，已有版本保持可用

#### Scenario: 重跑同一 tag
- **WHEN** 用户对同一 tag 重新运行发布流水线
- **THEN** 新资产覆盖同版本旧资产，Release 仍只有一个

### Requirement: Web 与桌面发布相互独立

桌面发布 SHALL NOT 改变现有 Web 部署行为：推送到 `main` 仍构建并部署 GitHub Pages，推送 tag 只触发桌面发布。

#### Scenario: 推送到 main
- **WHEN** 代码推送到 `main`
- **THEN** Web 构建与 Pages 部署按原流程执行，不触发桌面发布

#### Scenario: 推送 tag
- **WHEN** 推送 `v*` tag
- **THEN** 只执行桌面发布，不重新部署 Web

### Requirement: 发布说明

流水线 SHALL 为每个 Release 生成包含版本号与变更摘要的发布说明。

#### Scenario: 自动生成说明
- **WHEN** 发布流程创建 Release
- **THEN** Release 包含该 tag 对应的版本号与变更说明
