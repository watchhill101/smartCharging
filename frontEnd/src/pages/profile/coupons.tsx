import { View, Text, Input, Picker } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { showSafeToast, safeNavigateBack, showSafeActionSheet } from '../../utils/taroUtils'
import { logEnvironmentInfo } from '../../utils/environment'
import couponService, { Coupon, CouponCounts, CouponQueryOptions } from '../../services/couponService'
import './coupons.scss'

// 使用数据服务管理优惠券数据

export default function Coupons() {
  const [activeTab, setActiveTab] = useState<'unused' | 'used' | 'expired'>('unused')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [filteredCoupons, setFilteredCoupons] = useState<Coupon[]>([])
  const [counts, setCounts] = useState<CouponCounts>({ unused: 0, used: 0, expired: 0, total: 0 })
  const [loading, setLoading] = useState(false)
  const [showUseConfirm, setShowUseConfirm] = useState(false)
  const [couponToUse, setCouponToUse] = useState<Coupon | null>(null)
  
  // 筛选和排序状态
  const [searchText, setSearchText] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'validUntil' | 'value' | 'createdAt'>('validUntil')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [showFilters, setShowFilters] = useState(false)
  const [showExpiringSoon, setShowExpiringSoon] = useState(false)
  
  // 新增高级筛选状态
  const [minValue, setMinValue] = useState<string>('')
  const [maxValue, setMaxValue] = useState<string>('')
  const [selectedStations, setSelectedStations] = useState<string[]>([])
  const [selectedChargers, setSelectedChargers] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({start: '', end: ''})
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  
  // 批量操作状态
  const [selectedCoupons, setSelectedCoupons] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [showBatchActions, setShowBatchActions] = useState(false)
  
  // 智能推荐状态
  const [recommendations, setRecommendations] = useState<Coupon[]>([])
  const [showRecommendations, setShowRecommendations] = useState(false)
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  // 处理返回功能
  const handleGoBack = () => {
    safeNavigateBack()
  }

  // 处理更多操作
  const handleMoreOptions = () => {
    showSafeActionSheet(
      ['分享', '收藏', '举报', '联系客服', '数据导出', '重置数据'],
      (res) => {
        console.log('选择了操作:', res.tapIndex)
        // 根据选择执行相应操作
        switch (res.tapIndex) {
          case 0:
            showSafeToast('分享功能开发中', 'none')
            break
          case 1:
            showSafeToast('收藏功能开发中', 'none')
            break
          case 2:
            showSafeToast('举报功能开发中', 'none')
            break
          case 3:
            showSafeToast('联系客服功能开发中', 'none')
            break
          case 4:
            handleExportData()
            break
          case 5:
            handleResetData()
            break
          default:
            break
        }
      },
      (error) => {
        console.error('显示操作菜单失败:', error)
        showSafeToast('操作菜单显示失败', 'error')
      }
    )
  }

  // 数据导出功能
  const handleExportData = () => {
    try {
      const exportData = couponService.exportData()
      const blob = new Blob([exportData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `coupons_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      showSafeToast('数据导出成功', 'success')
    } catch (error) {
      console.error('数据导出失败:', error)
      showSafeToast('数据导出失败', 'error')
    }
  }

  // 重置数据功能
  const handleResetData = () => {
    Taro.showModal({
      title: '确认重置',
      content: '这将重置所有优惠券数据到初始状态，已使用的优惠券将恢复为未使用状态。确定继续吗？',
      success: (res) => {
        if (res.confirm) {
          try {
            couponService.resetToDefault()
            loadCouponsData(true)
            showSafeToast('数据已重置', 'success')
          } catch (error) {
            console.error('重置数据失败:', error)
            showSafeToast('重置数据失败', 'error')
          }
        }
      }
    })
  }

  // 构建查询选项
  const buildQueryOptions = (): CouponQueryOptions => {
    const options: CouponQueryOptions = {
      status: activeTab === 'unused' ? 'unused' : activeTab === 'used' ? 'used' : 'expired',
      sortBy,
      sortOrder,
    }

    if (searchText.trim()) {
      options.search = searchText.trim()
    }

    if (selectedType && selectedType !== 'all') {
      options.type = selectedType as any
    }

    if (showExpiringSoon && activeTab === 'unused') {
      options.expiringSoon = true
    }

    // 新增高级筛选选项
    if (minValue && !isNaN(Number(minValue))) {
      options.minValue = Number(minValue)
    }
    if (maxValue && !isNaN(Number(maxValue))) {
      options.maxValue = Number(maxValue)
    }
    if (dateRange.start) {
      options.validFrom = new Date(dateRange.start)
    }
    if (dateRange.end) {
      options.validUntil = new Date(dateRange.end)
    }

    return options
  }

  // 加载优惠券数据（支持筛选、排序、分页）
  const loadCouponsData = (resetPage = false) => {
    try {
      setLoading(true)
      
      const page = resetPage ? 1 : currentPage
      const queryOptions = buildQueryOptions()
      
      // 使用分页查询
      const result = couponService.getCouponsPaginated(page, pageSize, queryOptions)
      
      if (resetPage) {
        setFilteredCoupons(result.coupons)
        setCurrentPage(1)
      } else {
        // 加载更多时追加数据
        setFilteredCoupons(prev => page === 1 ? result.coupons : [...prev, ...result.coupons])
        setCurrentPage(page)
      }
      
      setHasMore(result.hasMore)
      setTotalCount(result.total)
      
      // 加载所有数据和统计
      const allCoupons = couponService.getAllCoupons()
      const allCounts = couponService.getCounts()
      setCoupons(allCoupons)
      setCounts(allCounts)
      
      // 加载智能推荐
      loadRecommendations()
      
      console.log('✅ 加载优惠券数据成功:', {
        total: result.total,
        currentPage: page,
        pageSize,
        hasMore: result.hasMore,
        filters: queryOptions
      })
      
    } catch (error) {
      console.error('❌ 加载优惠券数据失败:', error)
      showSafeToast('数据加载失败，请重试', 'error')
      
      // 降级到空数据
      setFilteredCoupons([])
      setCoupons([])
      setCounts({ unused: 0, used: 0, expired: 0, total: 0 })
      setHasMore(false)
      setTotalCount(0)
      
      // 3秒后自动重试
      setTimeout(() => {
        if (!loading) {
          console.log('🔄 自动重试加载数据...')
          loadCouponsData(resetPage)
        }
      }, 3000)
    } finally {
      setLoading(false)
    }
  }

  // 加载智能推荐
  const loadRecommendations = () => {
    try {
      // 获取即将过期的优惠券作为推荐
      const expiringSoon = couponService.getExpiringSoonCoupons(7)
      // 获取高价值优惠券
      const highValue = couponService.queryCoupons({
        status: 'unused',
        sortBy: 'value',
        sortOrder: 'desc',
        limit: 3
      })
      
      const recommendations = [...expiringSoon, ...highValue]
        .filter((coupon, index, arr) => arr.findIndex(c => c._id === coupon._id) === index)
        .slice(0, 5)
      
      setRecommendations(recommendations)
    } catch (error) {
      console.error('加载推荐失败:', error)
    }
  }

  // 加载更多数据
  const loadMoreCoupons = () => {
    if (!loading && hasMore) {
      setCurrentPage(prev => {
        const nextPage = prev + 1
        setTimeout(() => loadCouponsData(false), 10)
        return nextPage
      })
    }
  }

  // 重置筛选条件
  const resetFilters = () => {
    setSearchText('')
    setSelectedType('all')
    setSortBy('validUntil')
    setSortOrder('asc')
    setShowExpiringSoon(false)
    setMinValue('')
    setMaxValue('')
    setSelectedStations([])
    setSelectedChargers([])
    setDateRange({start: '', end: ''})
    setCurrentPage(1)
    setTimeout(() => loadCouponsData(true), 10)
  }

  // 应用筛选条件
  const applyFilters = () => {
    setCurrentPage(1)
    loadCouponsData(true)
    setShowFilters(false)
    setShowAdvancedFilters(false)
  }

  // 显示使用确认对话框
  const showUseConfirmDialog = (coupon: Coupon) => {
    setCouponToUse(coupon)
    setShowUseConfirm(true)
  }

  // 确认使用优惠券
  const confirmUseCoupon = () => {
    if (!couponToUse) return
    
    try {
      // 使用数据服务更新优惠券状态
      const usedCoupon = couponService.useCoupon(couponToUse._id)
      
      if (usedCoupon) {
        // 重新加载数据
        loadCouponsData(true)
        showSafeToast('优惠券使用成功！', 'success')
        console.log('✅ 优惠券使用成功:', usedCoupon.title)
      } else {
        showSafeToast('优惠券使用失败，请重试', 'error')
        console.error('❌ 优惠券使用失败')
      }
    } catch (error) {
      console.error('使用优惠券时发生错误:', error)
      showSafeToast('使用优惠券时发生错误', 'error')
    } finally {
      // 关闭确认对话框
      setShowUseConfirm(false)
      setCouponToUse(null)
    }
  }

  // 取消使用优惠券
  const cancelUseCoupon = () => {
    setShowUseConfirm(false)
    setCouponToUse(null)
  }

  // 获取指定状态的优惠券
  const getCouponsByStatus = (status: string) => {
    return coupons.filter(coupon => coupon.status === status)
  }

  // 初始化数据服务
  const initializeDataService = () => {
    try {
      // 加载初始数据
      loadCouponsData(true)
      
      console.log('✅ 数据服务初始化成功')
    } catch (error) {
      console.error('❌ 数据服务初始化失败:', error)
      showSafeToast('数据服务初始化失败', 'error')
    }
  }

  // 格式化优惠券值显示
  const formatCouponValue = (coupon: Coupon) => {
    switch (coupon.type) {
      case 'discount':
        return `${(coupon.value * 10).toFixed(1)}折`
      case 'amount':
        return `¥${coupon.value}`
      case 'free_charge':
        return `${coupon.value}小时`
      case 'points':
        return `${coupon.value}积分`
      default:
        return coupon.value.toString()
    }
  }

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN')
  }

  // 检查优惠券是否即将过期
  const isExpiringSoon = (validUntil: string) => {
    const now = new Date()
    const expireDate = new Date(validUntil)
    const diffDays = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 3 && diffDays > 0
  }

  // 批量选择相关函数
  const handleSelectCoupon = (couponId: string) => {
    const newSelected = new Set(selectedCoupons)
    if (newSelected.has(couponId)) {
      newSelected.delete(couponId)
    } else {
      newSelected.add(couponId)
    }
    setSelectedCoupons(newSelected)
    setSelectAll(newSelected.size === getCouponsByStatus(activeTab).length)
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCoupons(new Set())
      setSelectAll(false)
    } else {
      const allIds = getCouponsByStatus(activeTab).map(c => c._id)
      setSelectedCoupons(new Set(allIds))
      setSelectAll(true)
    }
  }

  const handleBatchDelete = () => {
    if (selectedCoupons.size === 0) {
      showSafeToast('请先选择要删除的优惠券', 'none')
      return
    }

    Taro.showModal({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedCoupons.size} 张优惠券吗？此操作不可撤销。`,
      success: (res) => {
        if (res.confirm) {
          try {
            let successCount = 0
            selectedCoupons.forEach(id => {
              if (couponService.deleteCoupon(id)) {
                successCount++
              }
            })
            
            setSelectedCoupons(new Set())
            setSelectAll(false)
            loadCouponsData(true)
            showSafeToast(`成功删除 ${successCount} 张优惠券`, 'success')
          } catch (error) {
            console.error('批量删除失败:', error)
            showSafeToast('批量删除失败', 'error')
          }
        }
      }
    })
  }

  const handleBatchUse = () => {
    if (selectedCoupons.size === 0) {
      showSafeToast('请先选择要使用的优惠券', 'none')
      return
    }

    Taro.showModal({
      title: '确认使用',
      content: `确定要使用选中的 ${selectedCoupons.size} 张优惠券吗？使用后不可撤销。`,
      success: (res) => {
        if (res.confirm) {
          try {
            let successCount = 0
            selectedCoupons.forEach(id => {
              if (couponService.useCoupon(id)) {
                successCount++
              }
            })
            
            setSelectedCoupons(new Set())
            setSelectAll(false)
            loadCouponsData(true)
            showSafeToast(`成功使用 ${successCount} 张优惠券`, 'success')
          } catch (error) {
            console.error('批量使用失败:', error)
            showSafeToast('批量使用失败', 'error')
          }
        }
      }
    })
  }

  useLoad(() => {
    console.log('优惠券页面加载中...')
    
    // 检测当前运行环境
    logEnvironmentInfo()
    
    // 初始化数据服务并加载优惠券数据
    initializeDataService()
    
    // 检查过期优惠券
    setTimeout(() => {
      // checkExpiredCoupons() // Removed
    }, 1000)
  })

  // 刷新优惠券数据
  const refreshCoupons = async () => {
    try {
      setLoading(true)
      console.log('🔄 开始刷新优惠券数据...')
      
      // 重新加载优惠券数据
      loadCouponsData(true)
      
      showSafeToast('数据已刷新', 'success')
    } catch (error) {
      console.error('❌ 刷新优惠券数据失败:', error)
      showSafeToast('数据刷新失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  // 移除重复调用，只在标签页切换时过滤数据，不重新获取
  // useEffect(() => {
  //   fetchCoupons()
  // }, [activeTab])

  return (
    <View className='coupons-page'>
      {/* 头部导航栏 */}
      <View className='header-navbar'>
        <View className='navbar-left' onClick={handleGoBack}>
          <Text className='back-icon'>‹</Text>
        </View>
        <View className='navbar-center'>
          <Text className='navbar-title'>我的优惠券</Text>
        </View>
        <View className='navbar-right'>
          <View className='refresh-button' onClick={() => refreshCoupons()}>
            <Text className='refresh-icon'>🔄</Text>
          </View>
          <View className='more-button' onClick={handleMoreOptions}>
            <Text className='more-icon'>⋯</Text>
          </View>
        </View>
      </View>

      {/* 智能推荐区域 */}
      {recommendations.length > 0 && (
        <View className='recommendations-section'>
          <View className='recommendations-header'>
            <Text className='recommendations-title'>💡 智能推荐</Text>
            <View className='recommendations-toggle' onClick={() => setShowRecommendations(!showRecommendations)}>
              <Text className='toggle-icon'>{showRecommendations ? '▼' : '▶'}</Text>
            </View>
          </View>
          {showRecommendations && (
            <View className='recommendations-list'>
              {recommendations.map((coupon) => (
                <View key={coupon._id} className='recommendation-item'>
                  <View className='recommendation-content'>
                    <Text className='recommendation-title'>{coupon.title}</Text>
                    <Text className='recommendation-value'>{formatCouponValue(coupon)}</Text>
                    {isExpiringSoon(coupon.validUntil) && (
                      <Text className='expiring-badge'>即将过期</Text>
                    )}
                  </View>
                  {coupon.status === 'unused' && (
                    <View className='recommendation-action' onClick={() => showUseConfirmDialog(coupon)}>
                      <Text className='action-text'>立即使用</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* 导航标签页 */}
      <View className='tabs-section'>
        <View className='tabs-header'>
          <View 
            className={`tab ${activeTab === 'unused' ? 'active' : ''}`}
            onClick={() => setActiveTab('unused')}
          >
            待使用({counts.unused})
          </View>
          <View 
            className={`tab ${activeTab === 'used' ? 'active' : ''}`}
            onClick={() => setActiveTab('used')}
          >
            已使用({counts.used})
          </View>
          <View 
            className={`tab ${activeTab === 'expired' ? 'active' : ''}`}
            onClick={() => setActiveTab('expired')}
          >
            已过期({counts.expired})
          </View>
        </View>
        
        {/* 数据统计信息 */}
        <View className='stats-info'>
          <Text className='stats-text'>
            共 {counts.total} 张优惠券 • 
            {activeTab === 'unused' ? '待使用' : activeTab === 'used' ? '已使用' : '已过期'}: {getCouponsByStatus(activeTab).length} 张
          </Text>
        </View>
      </View>

      {/* 高级筛选器 */}
      <View className='filters-section'>
        <View className='filters-header'>
          <View className='filters-toggle' onClick={() => setShowFilters(!showFilters)}>
            <Text className='toggle-text'>🔍 筛选器</Text>
            <Text className='toggle-icon'>{showFilters ? '▼' : '▶'}</Text>
          </View>
          <View className='filters-actions'>
            <View className='filter-button' onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              <Text className='button-text'>高级</Text>
            </View>
            <View className='filter-button' onClick={resetFilters}>
              <Text className='button-text'>重置</Text>
            </View>
          </View>
        </View>
        
        {showFilters && (
          <View className='filters-content'>
            {/* 基础筛选 */}
            <View className='filter-row'>
              <View className='filter-item'>
                <Text className='filter-label'>搜索</Text>
                <Input 
                  className='filter-input'
                  placeholder='搜索优惠券标题或描述'
                  value={searchText}
                  onInput={(e) => setSearchText(e.detail.value)}
                />
              </View>
            </View>
            
            <View className='filter-row'>
              <View className='filter-item'>
                <Text className='filter-label'>类型</Text>
                <Picker 
                  mode='selector' 
                  range={['全部', '折扣券', '满减券', '免费券', '积分券']}
                  value={['all', 'discount', 'amount', 'free_charge', 'points'].indexOf(selectedType)}
                  onChange={(e) => setSelectedType(['all', 'discount', 'amount', 'free_charge', 'points'][e.detail.value])}
                >
                  <View className='picker-display'>
                    <Text className='picker-text'>
                      {selectedType === 'all' ? '全部' : 
                       selectedType === 'discount' ? '折扣券' : 
                       selectedType === 'amount' ? '满减券' : 
                       selectedType === 'free_charge' ? '免费券' : '积分券'}
                    </Text>
                    <Text className='picker-arrow'>▼</Text>
                  </View>
                </Picker>
              </View>
              
              <View className='filter-item'>
                <Text className='filter-label'>排序</Text>
                <Picker 
                  mode='selector' 
                  range={['有效期', '面值', '创建时间']}
                  value={['validUntil', 'value', 'createdAt'].indexOf(sortBy)}
                  onChange={(e) => setSortBy(['validUntil', 'value', 'createdAt'][e.detail.value] as any)}
                >
                  <View className='picker-display'>
                    <Text className='picker-text'>
                      {sortBy === 'validUntil' ? '有效期' : 
                       sortBy === 'value' ? '面值' : '创建时间'}
                    </Text>
                    <Text className='picker-arrow'>▼</Text>
                  </View>
                </Picker>
              </View>
            </View>
            
            <View className='filter-row'>
              <View className='filter-item'>
                <Text className='filter-label'>排序方向</Text>
                <View className='sort-direction'>
                  <View 
                    className={`direction-btn ${sortOrder === 'asc' ? 'active' : ''}`}
                    onClick={() => setSortOrder('asc')}
                  >
                    <Text className='direction-text'>↑ 升序</Text>
                  </View>
                  <View 
                    className={`direction-btn ${sortOrder === 'desc' ? 'active' : ''}`}
                    onClick={() => setSortOrder('desc')}
                  >
                    <Text className='direction-text'>↓ 降序</Text>
                  </View>
                </View>
              </View>
              
              <View className='filter-item'>
                <Text className='filter-label'>即将过期</Text>
                <View className='checkbox-wrapper'>
                  <View 
                    className={`checkbox ${showExpiringSoon ? 'checked' : ''}`}
                    onClick={() => setShowExpiringSoon(!showExpiringSoon)}
                  >
                    {showExpiringSoon && <Text className='checkmark'>✓</Text>}
                  </View>
                  <Text className='checkbox-label'>显示3天内过期</Text>
                </View>
              </View>
            </View>
            
            {/* 高级筛选 */}
            {showAdvancedFilters && (
              <>
                <View className='filter-row'>
                  <View className='filter-item'>
                    <Text className='filter-label'>面值范围</Text>
                    <View className='value-range'>
                      <Input 
                        className='range-input'
                        placeholder='最小值'
                        value={minValue}
                        onInput={(e) => setMinValue(e.detail.value)}
                      />
                      <Text className='range-separator'>-</Text>
                      <Input 
                        className='range-input'
                        placeholder='最大值'
                        value={maxValue}
                        onInput={(e) => setMaxValue(e.detail.value)}
                      />
                    </View>
                  </View>
                </View>
                
                <View className='filter-row'>
                  <View className='filter-item'>
                    <Text className='filter-label'>有效期范围</Text>
                    <View className='date-range'>
                      <Input 
                        className='date-input'
                        placeholder='开始日期'
                        value={dateRange.start}
                        onInput={(e) => setDateRange(prev => ({...prev, start: e.detail.value}))}
                      />
                      <Text className='range-separator'>至</Text>
                      <Input 
                        className='date-input'
                        placeholder='结束日期'
                        value={dateRange.end}
                        onInput={(e) => setDateRange(prev => ({...prev, end: e.detail.value}))}
                      />
                    </View>
                  </View>
                </View>
              </>
            )}
            
            <View className='filter-actions'>
              <View className='apply-button' onClick={applyFilters}>
                <Text className='button-text'>应用筛选</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* 批量操作栏 */}
      {activeTab === 'unused' && (
        <View className='batch-actions-bar'>
          <View className='batch-select'>
            <View className='select-all' onClick={handleSelectAll}>
              <View className={`checkbox ${selectAll ? 'checked' : ''}`}>
                {selectAll && <Text className='checkmark'>✓</Text>}
              </View>
              <Text className='select-text'>全选</Text>
            </View>
            <Text className='selected-count'>
              已选择 {selectedCoupons.size} 张
            </Text>
          </View>
          
          {selectedCoupons.size > 0 && (
            <View className='batch-buttons'>
              <View className='batch-btn use' onClick={handleBatchUse}>
                <Text className='btn-text'>批量使用</Text>
              </View>
              <View className='batch-btn delete' onClick={handleBatchDelete}>
                <Text className='btn-text'>批量删除</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 主要内容区域 */}
      <View className='main-content'>
        {loading ? (
          <View className='loading-state'>
            <View className='loading-spinner'></View>
            <Text className='loading-text'>加载中...</Text>
            <Text className='loading-subtext'>正在获取您的优惠券信息</Text>
          </View>
        ) : getCouponsByStatus(activeTab).length > 0 ? (
          <View className='coupons-list'>
            {getCouponsByStatus(activeTab).map((coupon) => (
              <View key={coupon._id} className='coupon-item'>
                {/* 批量选择复选框 */}
                {activeTab === 'unused' && (
                  <View className='coupon-select'>
                    <View 
                      className={`checkbox ${selectedCoupons.has(coupon._id) ? 'checked' : ''}`}
                      onClick={() => handleSelectCoupon(coupon._id)}
                    >
                      {selectedCoupons.has(coupon._id) && <Text className='checkmark'>✓</Text>}
                    </View>
                  </View>
                )}
                
                <View className='coupon-header'>
                  <View className='coupon-type'>
                    <Text className='type-icon'>
                      {coupon.type === 'discount' ? '🏷️' : 
                       coupon.type === 'amount' ? '💰' : 
                       coupon.type === 'free_charge' ? '⚡' : '🎯'}
                    </Text>
                    <Text className='type-text'>
                      {coupon.type === 'discount' ? '折扣券' : 
                       coupon.type === 'amount' ? '满减券' : 
                       coupon.type === 'free_charge' ? '免费券' : '积分券'}
                    </Text>
                  </View>
                  <View className='coupon-value'>
                    <Text className='value-text'>{formatCouponValue(coupon)}</Text>
                  </View>
                </View>
                
                <View className='coupon-content'>
                  <Text className='coupon-title'>{coupon.title}</Text>
                  <Text className='coupon-desc'>{coupon.description}</Text>
                  
                  {coupon.minAmount && (
                    <Text className='coupon-condition'>
                      满¥{coupon.minAmount}可用
                    </Text>
                  )}
                  
                  {coupon.conditions && coupon.conditions.length > 0 && (
                    <View className='coupon-conditions'>
                      {coupon.conditions.map((condition, index) => (
                        <Text key={index} className='condition-item'>• {condition}</Text>
                      ))}
                    </View>
                  )}
                </View>
                
                <View className='coupon-footer'>
                  <Text className='valid-date'>
                    有效期至: {formatDate(coupon.validUntil)}
                  </Text>
                  {isExpiringSoon(coupon.validUntil) && (
                    <View className='expiring-soon'>
                      <Text className='expiring-text'>即将过期</Text>
                    </View>
                  )}
                  
                  {/* 使用按钮 - 只在未使用的优惠券上显示 */}
                  {coupon.status === 'unused' && (
                    <View className='use-button-container'>
                      <View className='use-button' onClick={() => showUseConfirmDialog(coupon)}>
                        <Text className='use-button-text'>使用优惠券</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ))}
            
            {/* 加载更多按钮 */}
            {hasMore && (
              <View className='load-more' onClick={loadMoreCoupons}>
                <Text className='load-more-text'>加载更多优惠券</Text>
              </View>
            )}
          </View>
        ) : (
          <View className='empty-state'>
            <View className='wallet-illustration'>
              <View className='wallet-icon'>💼</View>
              <View className='money-symbol'>¥</View>
              <View className='paper-stack'></View>
            </View>
            <Text className='empty-text'>
              {activeTab === 'unused' ? '暂无可用优惠券' :
               activeTab === 'used' ? '暂无已使用优惠券' : '暂无已过期优惠券'}
            </Text>
            <Text className='empty-subtext'>
              尝试调整筛选条件或刷新页面
            </Text>
          </View>
        )}
      </View>

      {/* 添加/编辑优惠券模态框 */}
      {/* Removed Add/Edit Modal */}

      {/* 使用优惠券确认对话框 */}
      {showUseConfirm && couponToUse && (
        <View className='modal-overlay' onClick={cancelUseCoupon}>
          <View className='modal-content use-confirm-modal' onClick={(e) => e.stopPropagation()}>
            <View className='modal-header'>
              <Text className='modal-title'>使用优惠券</Text>
              <View className='modal-close' onClick={cancelUseCoupon}>
                <Text className='close-icon'>×</Text>
              </View>
            </View>
            
            <View className='modal-body'>
              <View className='coupon-preview'>
                <View className='coupon-preview-header'>
                  <Text className='coupon-preview-title'>{couponToUse.title}</Text>
                  <View className='coupon-preview-value'>
                    <Text className='value-text'>{formatCouponValue(couponToUse)}</Text>
                  </View>
                </View>
                
                <Text className='coupon-preview-desc'>{couponToUse.description}</Text>
                
                {couponToUse.minAmount && (
                  <Text className='coupon-preview-condition'>
                    满¥{couponToUse.minAmount}可用
                  </Text>
                )}
                
                <Text className='coupon-preview-validity'>
                  有效期至: {formatDate(couponToUse.validUntil)}
                </Text>
              </View>
              
              <View className='use-notice'>
                <Text className='notice-title'>使用须知：</Text>
                <Text className='notice-text'>• 使用后优惠券将标记为已使用</Text>
                <Text className='notice-text'>• 使用后不可撤销或重复使用</Text>
                <Text className='notice-text'>• 请在有效期内使用</Text>
              </View>
            </View>
            
            <View className='modal-footer'>
              <View className='modal-button cancel' onClick={cancelUseCoupon}>
                <Text className='button-text'>取消</Text>
              </View>
              <View className='modal-button confirm use' onClick={confirmUseCoupon}>
                <Text className='button-text'>确认使用</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
