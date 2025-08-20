import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { TaroSafe } from '../../utils/taroSafe';
import {
  SearchBar,
  Cell,
  Button as NutButton,
  Loading,
  Empty,
  Tag,
  Popup,
  Range,
  Switch,
  Checkbox,
  CheckboxGroup,
  Radio,
  RadioGroup,
  Divider,
  Toast
} from '@nutui/nutui-react-taro';
import { LocationInfo } from '../../services/AmapService';
import './index.scss';

export interface StationSearchFilters {
  keyword?: string;
  city?: string;
  district?: string;
  operator?: string;
  connectorType?: string[];
  powerRange?: { min: number; max: number };
  priceRange?: { min: number; max: number };
  services?: string[];
  rating?: { min: number };
  availability?: 'available' | 'all';
  distance?: number;
}

export interface StationSearchOptions {
  page?: number;
  limit?: number;
  sortBy?: 'distance' | 'rating' | 'price' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  id: string;
  stationId: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  distance?: number;
  operator: {
    name: string;
  };
  totalPiles: number;
  availablePiles: number;
  rating: {
    average: number;
    count: number;
  };
  priceRange: {
    minServicePrice: number;
    maxServicePrice: number;
  };
  services: string[];
  images?: string[];
}

export interface StationSearchProps {
  visible?: boolean;
  onClose?: () => void;
  onSearch?: (filters: StationSearchFilters, options: StationSearchOptions) => void;
  onResultSelect?: (station: SearchResult) => void;
  currentLocation?: LocationInfo | null;
  initialFilters?: StationSearchFilters;
  loading?: boolean;
  results?: SearchResult[];
  total?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

interface SearchState {
  filters: StationSearchFilters;
  options: StationSearchOptions;
  showFilters: boolean;
  searchHistory: string[];
  quickFilters: Array<{
    label: string;
    filters: Partial<StationSearchFilters>;
  }>;
}

const StationSearch: React.FC<StationSearchProps> = ({
  visible = false,
  onClose,
  onSearch,
  onResultSelect,
  currentLocation,
  initialFilters = {},
  loading = false,
  results = [],
  total = 0,
  hasMore = false,
  onLoadMore
}) => {
  const [searchState, setSearchState] = useState<SearchState>({
    filters: {
      availability: 'available',
      distance: 5000,
      ...initialFilters
    },
    options: {
      page: 1,
      limit: 20,
      sortBy: 'distance',
      sortOrder: 'asc'
    },
    showFilters: false,
    searchHistory: [],
    quickFilters: [
      { label: '附近可用', filters: { availability: 'available', distance: 3000 } },
      { label: '快充站', filters: { powerRange: { min: 60, max: 1000 } } },
      { label: '高评分', filters: { rating: { min: 4.0 } } },
      { label: '有停车位', filters: { services: ['parking'] } },
      { label: '24小时', filters: {} }
    ]
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // 连接器类型选项
  const connectorTypes = [
    { label: 'GB/T', value: 'GB/T' },
    { label: 'CCS', value: 'CCS' },
    { label: 'CHAdeMO', value: 'CHAdeMO' },
    { label: 'Tesla', value: 'Tesla' },
    { label: 'Type2', value: 'Type2' }
  ];

  // 服务选项
  const serviceOptions = [
    { label: '停车场', value: 'parking' },
    { label: '餐厅', value: 'restaurant' },
    { label: '洗手间', value: 'restroom' },
    { label: 'WiFi', value: 'wifi' },
    { label: '商店', value: 'shop' },
    { label: '维修', value: 'repair' },
    { label: '洗车', value: 'car_wash' }
  ];

  // 运营商选项
  const operatorOptions = [
    '国家电网', '特来电', '星星充电', '小鹏超充', 
    '蔚来换电', '云快充', '万马爱充', '普天新能源'
  ];

  // 加载搜索历史
  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        const history = await TaroSafe.getStorageSync('station_search_history');
        if (history && Array.isArray(history)) {
          setSearchState(prev => ({
            ...prev,
            searchHistory: history.slice(0, 10)
          }));
        }
      } catch (error) {
        console.warn('⚠️ 加载搜索历史失败:', error);
      }
    };

    if (visible) {
      loadSearchHistory();
    }
  }, [visible]);

  // 保存搜索历史
  const saveSearchHistory = useCallback(async (keyword: string) => {
    if (!keyword.trim()) return;

    try {
      const newHistory = [
        keyword,
        ...searchState.searchHistory.filter(item => item !== keyword)
      ].slice(0, 10);

      await TaroSafe.setStorageSync('station_search_history', newHistory);
      setSearchState(prev => ({
        ...prev,
        searchHistory: newHistory
      }));
    } catch (error) {
      console.warn('⚠️ 保存搜索历史失败:', error);
    }
  }, [searchState.searchHistory]);

  // 执行搜索
  const performSearch = useCallback((newFilters?: Partial<StationSearchFilters>) => {
    const filters = { ...searchState.filters, ...newFilters };
    const options = { ...searchState.options, page: 1 }; // 重置页码

    setSearchState(prev => ({
      ...prev,
      filters,
      options
    }));

    onSearch?.(filters, options);

    // 保存搜索关键词到历史
    if (filters.keyword) {
      saveSearchHistory(filters.keyword);
    }
  }, [searchState.filters, searchState.options, onSearch, saveSearchHistory]);

  // 防抖搜索
  const handleSearchChange = useCallback((keyword: string) => {
    setSearchState(prev => ({
      ...prev,
      filters: { ...prev.filters, keyword }
    }));

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch({ keyword });
    }, parseInt(process.env.TARO_APP_SEARCH_DEBOUNCE_DELAY || '500'));
  }, [performSearch]);

  // 搜索确认
  const handleSearchConfirm = useCallback(() => {
    performSearch();
  }, [performSearch]);

  // 应用快速筛选
  const applyQuickFilter = useCallback((quickFilter: typeof searchState.quickFilters[0]) => {
    performSearch(quickFilter.filters);
    Toast.show({
      content: `已应用筛选：${quickFilter.label}`,
      type: 'success',
      duration: 1500
    });
  }, [performSearch]);

  // 更新筛选条件
  const updateFilters = useCallback((newFilters: Partial<StationSearchFilters>) => {
    setSearchState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters }
    }));
  }, []);

  // 更新排序选项
  const updateSortOptions = useCallback((newOptions: Partial<StationSearchOptions>) => {
    setSearchState(prev => ({
      ...prev,
      options: { ...prev.options, ...newOptions }
    }));
  }, []);

  // 应用筛选
  const applyFilters = useCallback(() => {
    performSearch();
    setSearchState(prev => ({ ...prev, showFilters: false }));
  }, [performSearch]);

  // 重置筛选
  const resetFilters = useCallback(() => {
    const defaultFilters: StationSearchFilters = {
      availability: 'available',
      distance: 5000
    };
    
    setSearchState(prev => ({
      ...prev,
      filters: defaultFilters
    }));
  }, []);

  // 清除搜索历史
  const clearSearchHistory = useCallback(async () => {
    try {
      await TaroSafe.removeStorageSync('station_search_history');
      setSearchState(prev => ({ ...prev, searchHistory: [] }));
      Toast.show({
        content: '已清除搜索历史',
        type: 'success',
        duration: 1500
      });
    } catch (error) {
      console.warn('⚠️ 清除搜索历史失败:', error);
    }
  }, []);

  // 选择搜索结果
  const handleResultSelect = useCallback((station: SearchResult) => {
    onResultSelect?.(station);
  }, [onResultSelect]);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      onLoadMore?.();
    }
  }, [hasMore, loading, onLoadMore]);

  // 格式化距离
  const formatDistance = useCallback((distance?: number) => {
    if (!distance) return '';
    if (distance < 1000) {
      return `${distance}m`;
    } else {
      return `${(distance / 1000).toFixed(1)}km`;
    }
  }, []);

  // 格式化价格
  const formatPrice = useCallback((priceRange: SearchResult['priceRange']) => {
    const min = priceRange.minServicePrice;
    const max = priceRange.maxServicePrice;
    if (min === max) {
      return `${min}元/kWh`;
    } else {
      return `${min}-${max}元/kWh`;
    }
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Popup
      visible={visible}
      position="top"
      closeable
      onClose={onClose}
      className="station-search-popup"
    >
      <View className="station-search">
        {/* 搜索栏 */}
        <View className="station-search__header">
          <SearchBar
            value={searchState.filters.keyword || ''}
            placeholder="搜索充电站名称、地址或运营商"
            onSearch={handleSearchConfirm}
            onChange={handleSearchChange}
            className="search-bar"
          />
          
          <NutButton
            type="primary"
            size="small"
            onClick={() => setSearchState(prev => ({ ...prev, showFilters: !prev.showFilters }))}
            className="filter-btn"
          >
            筛选
          </NutButton>
        </View>

        {/* 快速筛选 */}
        <View className="station-search__quick-filters">
          <ScrollView scrollX className="quick-filters-scroll">
            <View className="quick-filters-list">
              {searchState.quickFilters.map((filter, index) => (
                <Tag
                  key={index}
                  type="default"
                  size="small"
                  onClick={() => applyQuickFilter(filter)}
                  className="quick-filter-tag"
                >
                  {filter.label}
                </Tag>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* 筛选面板 */}
        {searchState.showFilters && (
          <View className="station-search__filters">
            <ScrollView className="filters-content" scrollY>
              {/* 可用性筛选 */}
              <View className="filter-section">
                <Text className="filter-title">可用性</Text>
                <RadioGroup
                  value={searchState.filters.availability}
                  onChange={(value) => updateFilters({ availability: value as any })}
                >
                  <Radio value="available">仅显示可用</Radio>
                  <Radio value="all">显示全部</Radio>
                </RadioGroup>
              </View>

              <Divider />

              {/* 距离筛选 */}
              {currentLocation && (
                <>
                  <View className="filter-section">
                    <Text className="filter-title">
                      搜索范围：{formatDistance(searchState.filters.distance)}
                    </Text>
                    <Range
                      value={[searchState.filters.distance || 5000]}
                      min={1000}
                      max={50000}
                      step={1000}
                      onChange={(value) => updateFilters({ distance: value[0] })}
                      className="distance-range"
                    />
                  </View>
                  <Divider />
                </>
              )}

              {/* 运营商筛选 */}
              <View className="filter-section">
                <Text className="filter-title">运营商</Text>
                <View className="operator-list">
                  {operatorOptions.map(operator => (
                    <Tag
                      key={operator}
                      type={searchState.filters.operator === operator ? 'primary' : 'default'}
                      size="small"
                      onClick={() => updateFilters({ 
                        operator: searchState.filters.operator === operator ? undefined : operator 
                      })}
                      className="operator-tag"
                    >
                      {operator}
                    </Tag>
                  ))}
                </View>
              </View>

              <Divider />

              {/* 接口类型筛选 */}
              <View className="filter-section">
                <Text className="filter-title">接口类型</Text>
                <CheckboxGroup
                  value={searchState.filters.connectorType || []}
                  onChange={(value) => updateFilters({ connectorType: value })}
                >
                  {connectorTypes.map(type => (
                    <Checkbox key={type.value} value={type.value}>
                      {type.label}
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              </View>

              <Divider />

              {/* 功率范围筛选 */}
              <View className="filter-section">
                <Text className="filter-title">
                  功率范围：{searchState.filters.powerRange?.min || 0}-{searchState.filters.powerRange?.max || 1000}kW
                </Text>
                <Range
                  value={[
                    searchState.filters.powerRange?.min || 0,
                    searchState.filters.powerRange?.max || 1000
                  ]}
                  min={0}
                  max={1000}
                  step={10}
                  range
                  onChange={(value) => updateFilters({ 
                    powerRange: { min: value[0], max: value[1] } 
                  })}
                  className="power-range"
                />
              </View>

              <Divider />

              {/* 价格范围筛选 */}
              <View className="filter-section">
                <Text className="filter-title">
                  价格范围：{searchState.filters.priceRange?.min || 0}-{searchState.filters.priceRange?.max || 5}元/kWh
                </Text>
                <Range
                  value={[
                    searchState.filters.priceRange?.min || 0,
                    searchState.filters.priceRange?.max || 5
                  ]}
                  min={0}
                  max={5}
                  step={0.1}
                  range
                  onChange={(value) => updateFilters({ 
                    priceRange: { min: value[0], max: value[1] } 
                  })}
                  className="price-range"
                />
              </View>

              <Divider />

              {/* 服务筛选 */}
              <View className="filter-section">
                <Text className="filter-title">服务设施</Text>
                <CheckboxGroup
                  value={searchState.filters.services || []}
                  onChange={(value) => updateFilters({ services: value })}
                >
                  {serviceOptions.map(service => (
                    <Checkbox key={service.value} value={service.value}>
                      {service.label}
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              </View>

              <Divider />

              {/* 评分筛选 */}
              <View className="filter-section">
                <Text className="filter-title">最低评分</Text>
                <RadioGroup
                  value={searchState.filters.rating?.min?.toString()}
                  onChange={(value) => updateFilters({ 
                    rating: value ? { min: parseFloat(value) } : undefined 
                  })}
                >
                  <Radio value="">不限</Radio>
                  <Radio value="3">3分以上</Radio>
                  <Radio value="4">4分以上</Radio>
                  <Radio value="4.5">4.5分以上</Radio>
                </RadioGroup>
              </View>
            </ScrollView>

            {/* 筛选操作按钮 */}
            <View className="filters-actions">
              <NutButton
                type="default"
                size="large"
                onClick={resetFilters}
                className="reset-btn"
              >
                重置
              </NutButton>
              <NutButton
                type="primary"
                size="large"
                onClick={applyFilters}
                className="apply-btn"
              >
                应用筛选
              </NutButton>
            </View>
          </View>
        )}

        {/* 搜索结果 */}
        <View className="station-search__content">
          {loading && results.length === 0 ? (
            // 加载状态
            <View className="search-loading">
              <Loading type="spinner" />
              <Text className="loading-text">搜索中...</Text>
            </View>
          ) : results.length > 0 ? (
            // 搜索结果列表
            <ScrollView 
              className="search-results" 
              scrollY
              onScrollToLower={handleLoadMore}
            >
              <View className="results-header">
                <Text className="results-count">找到 {total} 个充电站</Text>
                {/* 排序选择 */}
                <View className="sort-options">
                  <Tag
                    type={searchState.options.sortBy === 'distance' ? 'primary' : 'default'}
                    size="mini"
                    onClick={() => {
                      updateSortOptions({ sortBy: 'distance', sortOrder: 'asc' });
                      performSearch();
                    }}
                  >
                    距离
                  </Tag>
                  <Tag
                    type={searchState.options.sortBy === 'rating' ? 'primary' : 'default'}
                    size="mini"
                    onClick={() => {
                      updateSortOptions({ sortBy: 'rating', sortOrder: 'desc' });
                      performSearch();
                    }}
                  >
                    评分
                  </Tag>
                  <Tag
                    type={searchState.options.sortBy === 'price' ? 'primary' : 'default'}
                    size="mini"
                    onClick={() => {
                      updateSortOptions({ sortBy: 'price', sortOrder: 'asc' });
                      performSearch();
                    }}
                  >
                    价格
                  </Tag>
                </View>
              </View>

              {results.map(station => (
                <Cell
                  key={station.stationId}
                  title={station.name}
                  desc={
                    <View className="station-desc">
                      <Text className="station-address">{station.address}</Text>
                      <View className="station-info">
                        <Text className="station-operator">{station.operator.name}</Text>
                        <Text className="station-piles">
                          {station.availablePiles}/{station.totalPiles} 可用
                        </Text>
                        {station.distance && (
                          <Text className="station-distance">
                            {formatDistance(station.distance)}
                          </Text>
                        )}
                      </View>
                      <View className="station-tags">
                        <Tag size="mini" className="rating-tag">
                          ⭐ {station.rating.average.toFixed(1)}
                        </Tag>
                        <Tag size="mini" className="price-tag">
                          {formatPrice(station.priceRange)}
                        </Tag>
                        {station.services.slice(0, 2).map(service => (
                          <Tag key={service} size="mini" className="service-tag">
                            {serviceOptions.find(s => s.value === service)?.label || service}
                          </Tag>
                        ))}
                      </View>
                    </View>
                  }
                  onClick={() => handleResultSelect(station)}
                  className="result-item"
                />
              ))}

              {/* 加载更多 */}
              {hasMore && (
                <View className="load-more">
                  {loading ? (
                    <Loading type="spinner" />
                  ) : (
                    <NutButton
                      type="default"
                      size="small"
                      onClick={handleLoadMore}
                    >
                      加载更多
                    </NutButton>
                  )}
                </View>
              )}
            </ScrollView>
          ) : searchState.filters.keyword || Object.keys(searchState.filters).length > 2 ? (
            // 无搜索结果
            <Empty
              description="未找到符合条件的充电站"
              imageSize={80}
              className="search-empty"
            />
          ) : (
            // 搜索历史和提示
            <View className="search-history">
              {searchState.searchHistory.length > 0 && (
                <>
                  <View className="history-header">
                    <Text className="history-title">搜索历史</Text>
                    <NutButton
                      type="default"
                      size="mini"
                      onClick={clearSearchHistory}
                      className="clear-btn"
                    >
                      清除
                    </NutButton>
                  </View>
                  <View className="history-list">
                    {searchState.searchHistory.map((keyword, index) => (
                      <Tag
                        key={index}
                        type="default"
                        size="small"
                        onClick={() => handleSearchChange(keyword)}
                        className="history-tag"
                      >
                        {keyword}
                      </Tag>
                    ))}
                  </View>
                </>
              )}

              {/* 搜索提示 */}
              <View className="search-tips">
                <Text className="tips-title">搜索提示</Text>
                <Text className="tips-item">• 输入充电站名称、地址或运营商名称</Text>
                <Text className="tips-item">• 使用筛选功能精确查找</Text>
                <Text className="tips-item">• 开启定位获取附近充电站</Text>
              </View>
            </View>
          )}
        </View>

        {/* 位置提示 */}
        {!currentLocation && (
          <View className="station-search__tip">
            <Text className="tip-text">
              💡 开启定位后可搜索附近充电站并显示距离
            </Text>
          </View>
        )}
      </View>
    </Popup>
  );
};

export default StationSearch;