---
title: "容器查询实践笔记"
notebook: "learning"
slug: "container-query"
published: 2026-07-26
description: "让卡片根据自己的空间变化，而不是猜测屏幕宽度。"
tags: ["CSS", "响应式"]
---

媒体查询回答的是视口有多宽，容器查询回答的是组件实际得到多少空间。

对于同时出现在主栏、侧栏和弹窗里的卡片，容器查询能减少很多只为特定页面编写的覆盖样式。
