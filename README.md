# CET-4 四级刷题实验室 · GitHub Pages 部署包

这个文件夹已经整理成可直接上传到 GitHub Pages 的静态站点：

- `index.html` 在根目录
- 所有资源使用相对路径，支持 `https://用户名.github.io/仓库名/` 子路径
- `manifest.webmanifest` + `sw.js` 支持 iPhone“添加到主屏幕”和离线缓存
- `.nojekyll` 防止 GitHub Pages 的 Jekyll 处理干扰静态文件

## 一、创建仓库

1. 登录 GitHub，点右上角 **+ → New repository**。
2. 仓库名建议：`cet4-practice-lab`。
3. 选择 **Public**（免费 GitHub Pages 需要公开仓库）。
4. 不要勾选初始化 README，直接创建。

## 二、上传文件

### 方法 A：网页上传（最简单）

1. 进入新仓库，点 **Add file → Upload files**。
2. 把本文件夹里的**所有文件和 `icons` 文件夹**拖进去。
3. 确认 `index.html` 在仓库根目录，不是在子文件夹里。
4. 填写提交信息，点 **Commit changes**。

### 方法 B：命令行

在本文件夹打开 PowerShell：

```powershell
git init
git add .
git commit -m "Deploy CET-4 practice lab"
git branch -M main
git remote add origin https://github.com/你的用户名/cet4-practice-lab.git
git push -u origin main
```

如果提示登录，按 Git Credential Manager 的提示在浏览器中授权 GitHub。

## 三、开启 Pages

1. 打开仓库的 **Settings → Pages**。
2. **Build and deployment** 的 Source 选择 **Deploy from a branch**。
3. Branch 选择 **main**，目录选择 **/ (root)**。
4. 点 **Save**。
5. 等待 1—3 分钟，页面顶部会出现网址：

```text
https://你的用户名.github.io/cet4-practice-lab/
```

如果仓库名是 `你的用户名.github.io`，网址则是 `https://你的用户名.github.io/`。

## 四、iPhone 安装

1. 用 **Safari** 打开上面的网址（不要用微信）。
2. 点底部分享按钮。
3. 选择 **添加到主屏幕**。
4. 从主屏幕打开“四级刷题”。
5. 首次打开保持联网，等应用缓存完成；之后可离线使用。

## 更新内容

以后修改了题库或页面：

```powershell
git add .
git commit -m "Update content"
git push
```

GitHub Pages 会自动重新发布。若希望 iPhone 上的离线缓存同步更新，请把 `sw.js` 里的：

```js
const CACHE_NAME = 'cet4-lab-pwa-v2';
```

改成新的版本号，例如 `cet4-lab-pwa-v3`，再提交。

## 常见问题

**打开是 404？**  
确认 `index.html` 在仓库根目录，且 Pages 的分支和目录设置正确。

**添加到主屏幕后没有离线？**  
第一次必须联网完整打开一次；确认网址是 `https://` 而不是 `http://`。

**没有声音？**  
iPhone 静音模式会影响部分语音；关闭静音，再点“朗读”。

**学习记录会丢吗？**  
记录保存在 iPhone Safari 的本地存储中。建议定期在应用内「设置与备份」导出 JSON。长期不打开网站时，iOS 可能清理网站数据。
