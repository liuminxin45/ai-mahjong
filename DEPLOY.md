# 🚀 Vercel 部署指南

## 方式 1：命令行部署（最快）

### 1. 安装 Vercel CLI
```bash
npm install -g vercel
```

### 2. 登录 Vercel
```bash
vercel login
```
会打开浏览器，选择登录方式（GitHub/GitLab/Email）

### 3. 部署项目
在项目根目录运行：
```bash
vercel
```

第一次部署会问几个问题：
- Set up and deploy? → **Y**
- Which scope? → 选择你的账号
- Link to existing project? → **N**
- What's your project's name? → **neo-mahjong** (或自定义)
- In which directory is your code located? → **./** (直接回车)

### 4. 生产部署
```bash
vercel --prod
```

完成！你会得到一个 URL：`https://neo-mahjong.vercel.app`

---

## 方式 2：GitHub 自动部署（推荐）

### 1. 推送代码到 GitHub
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push
```

### 2. 连接 Vercel
1. 访问 [vercel.com](https://vercel.com)
2. 点击 "Add New..." → "Project"
3. 选择你的 GitHub 仓库
4. 点击 "Import"
5. 配置会自动检测（已有 vercel.json）
6. 点击 "Deploy"

### 3. 自动部署
以后每次 `git push`，Vercel 会自动重新部署！

---

## 📱 访问你的应用

部署成功后：
- **预览 URL**: `https://neo-mahjong-xxx.vercel.app`
- **生产 URL**: `https://neo-mahjong.vercel.app`

可以在：
- 电脑浏览器访问
- 手机浏览器访问
- 分享给朋友

---

## 🔧 自定义域名（可选）

1. 在 Vercel 项目设置中
2. 点击 "Domains"
3. 添加你的域名
4. 按提示配置 DNS

---

## 📊 查看部署状态

访问 [vercel.com/dashboard](https://vercel.com/dashboard) 查看：
- 部署历史
- 访问统计
- 错误日志

---

## ⚡ 快速命令

```bash
# 预览部署
vercel

# 生产部署
vercel --prod

# 查看部署列表
vercel ls

# 查看项目信息
vercel inspect
```

---

## 🎯 故障排除

### 构建失败？
检查本地是否能成功构建：
```bash
npm run build
```

### 404 错误？
`vercel.json` 已配置 SPA 路由重写，应该不会有问题。

### 需要环境变量？
在 Vercel 项目设置 → Environment Variables 添加。

---

## 📞 需要帮助？

- Vercel 文档: https://vercel.com/docs
- 项目问题: 查看 GitHub Issues
