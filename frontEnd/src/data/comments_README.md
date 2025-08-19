# 评论数据说明文档

## 文件概述
`comments.json` 文件包含了各个充电站的初始评论数据，用于为评论区提供基础内容。

## 数据结构

### 文件格式
```json
{
  "充电站ID": [
    {
      "id": "评论唯一标识",
      "user": "用户名",
      "avatar": "用户头像emoji",
      "content": "评论内容",
      "rating": 评分(1-5),
      "time": "评论时间",
      "likes": "点赞数"
    }
  ]
}
```

### 字段说明
- **充电站ID**: 对应 `stationDetails.json` 中的 `_id` 字段
- **id**: 评论的唯一标识符
- **user**: 发表评论的用户名称
- **avatar**: 用户头像，使用emoji表情
- **content**: 评论的具体内容
- **rating**: 用户评分，范围1-5星
- **time**: 评论发表时间，格式：YYYY-MM-DD HH:MM
- **likes**: 该评论获得的点赞数量

## 数据来源

### 初始数据
- 从 `stationDetails.json` 中提取充电站ID
- 为每个充电站预设2-3条示例评论
- 评论内容贴近实际使用场景

### 动态数据
- 用户新增的评论会保存到本地存储
- 本地存储键名格式：`comments_充电站ID`
- 支持Taro存储和浏览器localStorage

## 使用方法

### 1. 导入数据
```typescript
import commentsData from '../../data/comments.json'
```

### 2. 获取特定充电站评论
```typescript
const stationId = 'cs001'
const stationComments = commentsData[stationId] || []
```

### 3. 合并本地存储数据
```typescript
// 优先使用本地存储的评论
const storedComments = getCommentsFromStorage(stationId)
const finalComments = storedComments.length > 0 ? storedComments : commentsData[stationId] || []
```

## 数据更新

### 添加新评论
- 用户发表新评论时，自动保存到本地存储
- 新评论会添加到评论列表顶部
- 评论ID使用时间戳确保唯一性

### 点赞功能
- 用户点赞后，点赞数实时更新
- 更新后的数据自动保存到本地存储
- 刷新页面后点赞数据保持

## 注意事项

1. **数据持久化**: 用户添加的评论会保存在本地，刷新页面不会丢失
2. **数据隔离**: 每个充电站的评论独立存储，互不影响
3. **兼容性**: 支持Taro环境和普通浏览器环境
4. **错误处理**: 包含完整的错误处理和降级方案

## 扩展建议

1. **评论分类**: 可以按评分、时间等维度对评论进行排序
2. **用户系统**: 可以集成真实的用户系统，替换预设用户名
3. **评论审核**: 可以添加评论内容审核机制
4. **数据同步**: 可以添加云端数据同步功能
