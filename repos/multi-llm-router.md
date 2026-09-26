---
title: "三模型路由系统"
author: "Quentin040507"
authorName: "刘全"
major: "Data Science"
enrollmentYear: 2026
repoUrl: "https://github.com/Quentin040507/multi-llm-router"
homepageUrl: ''
summary: "三模型分工协作的 LLM 智能路由系统：智能路由、圆桌会诊、举手表决，支持多会话与历史记录"
tags: ["llm", "ai", "python", "fastapi", "deepseek", "glm", "kimi"]
category: "AI 工具"
featured: false
status: active
---

输入一个自然语言问题，系统自动判断它属于哪个领域，分发给最擅长的模型作答。三家模型各司其职：DeepSeek 负责代码与数学推理、GLM 负责中文写作、Kimi 负责通用对话与长文理解。

最有意思的是「圆桌会诊」模式——三个模型围绕同一个问题实时辩论：第一轮各自亮观点，第二轮互相挑刺、认怂、修正立场，第三轮主持人融合三方精华，输出一份完整可用的最终答案。全程逐字直播，讨论过程可展开回看，也可随时停止。

## Features

- 智能路由：自动判断问题领域，选最擅长模型，失败自动降级
- 圆桌会诊：三模型实时辩论 + 主持人总结，过程可回看
- 举手表决：客观题多数投票
- 多会话与历史记录：多任务切换，关闭重开不丢
- 网页窗口 + CLI 双入口，OpenAI 兼容接口
