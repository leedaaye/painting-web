# Painting Web

基于 Next.js 的 AI 图像生成 Web 应用，支持多模型切换、用户密钥管理和使用量统计。

## 功能特性

- 多模型支持：可配置多个 AI 图像生成模型（如 Gemini）
- 参考图上传：支持上传参考图进行图生图
- 比例选择：支持多种宽高比（Auto、1:1、16:9、9:16 等）
- 分辨率选择：支持 1K/2K/4K 分辨率（部分模型）
- 用户密钥系统：通过密钥认证用户，支持启用/禁用
- 使用量统计：按模型统计每个用户的使用次数
- 管理后台：管理 API 提供商和用户密钥

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **数据库**: SQLite + Prisma ORM
- **状态管理**: Zustand
- **样式**: Tailwind CSS 4
- **UI 组件**: Radix UI + shadcn/ui
- **认证**: JWT (jose)

## 快速开始

### 环境要求

- Node.js 18+
- pnpm

### 安装

```bash
# 克隆仓库
git clone <repo-url>
cd painting-web

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 设置 DATABASE_URL

# 初始化数据库
npx prisma generate
npx prisma db push

# 启动开发服务器
pnpm dev
```

### 环境变量

```env
DATABASE_URL="file:./dev.db"
```

## 项目结构

```
painting-web/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── admin/         # 管理接口
│   │   └── generate/      # 图像生成接口
│   ├── admin/             # 管理后台页面
│   └── page.tsx           # 首页
├── components/            # React 组件
│   ├── ui/               # 基础 UI 组件
│   └── image-generator.tsx
├── lib/                   # 工具库
│   ├── server/           # 服务端工具
│   └── store.ts          # Zustand 状态
├── prisma/               # 数据库
│   └── schema.prisma
└── middleware.ts         # 认证中间件
```

## 数据模型

- **ApiProvider**: API 提供商配置（密钥、端点、模型）
- **UserKey**: 用户密钥（认证、使用统计）
- **UserUsage**: 按模型的使用量统计
- **AdminConfig**: 管理员密码配置

## API 接口

### 图像生成

```
POST /api/generate
Headers: Authorization: Bearer <user-key>
Body: {
  prompt: string,
  modelKey: string,
  inputImage?: { mimeType: string, data: string },
  aspectRatio?: string,
  imageSize?: string
}
```

### 管理接口

- `GET/POST /api/admin/providers` - 管理 API 提供商
- `GET/POST /api/admin/users` - 管理用户密钥
- `PATCH/DELETE /api/admin/users/[id]` - 更新/删除用户

## 许可证

MIT
